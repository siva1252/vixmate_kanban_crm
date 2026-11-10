"""Authentication and OTP business logic."""

from __future__ import annotations

import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError


class LoginFailed(APIException):
    status_code = 401
    default_detail = "Invalid email or password."
    default_code = "authentication_failed"

from apps.accounts.models import ApprovedEmail, OTPPurpose, OTPVerification, User
from apps.audit.services import write_audit_log
from apps.team.models import TeamMember
from common.utilities.request import get_client_ip


GENERIC_RESET_MESSAGE = (
    "If an approved account exists for this email, an OTP has been sent."
)


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _is_email_approved(email: str) -> bool:
    return ApprovedEmail.objects.filter(email=email, is_active=True).exists()


def _generate_otp_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _create_otp(user: User, purpose: str, *, request=None) -> tuple[OTPVerification, str]:
    now = timezone.now()
    OTPVerification.objects.filter(
        user=user,
        purpose=purpose,
        is_used=False,
    ).update(is_used=True, used_at=now)

    code = _generate_otp_code()
    otp = OTPVerification.objects.create(
        user=user,
        purpose=purpose,
        code_hash=make_password(code),
        expires_at=now + timedelta(minutes=settings.OTP_EXPIRY_MINUTES),
        last_sent_at=now,
        resend_count=1,
    )
    send_mail(
        subject="Viximate CRM verification code",
        message=f"Your verification code is {code}. It expires in {settings.OTP_EXPIRY_MINUTES} minutes.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )
    write_audit_log(
        actor=user,
        action="otp_sent",
        entity_type="OTPVerification",
        entity_id=otp.id,
        description=f"OTP sent for {purpose}",
        new_values={"purpose": purpose},
        request=request,
    )
    return otp, code


@transaction.atomic
def create_team_user(
    *,
    actor: User,
    email: str,
    full_name: str,
    password: str,
    phone_number: str = "",
    is_active: bool = True,
    is_staff: bool = False,
    request=None,
) -> User:
    email = _normalize_email(email)
    if not email:
        raise ValidationError({"email": "Email is required."})
    if User.objects.filter(email=email).exists():
        raise ValidationError({"email": "A user with this email already exists."})

    ApprovedEmail.objects.update_or_create(
        email=email,
        defaults={"is_active": True, "created_by": actor},
    )
    user = User.objects.create_user(
        email=email,
        password=password,
        full_name=full_name,
        phone_number=phone_number or "",
        is_active=is_active,
        is_staff=is_staff,
    )
    TeamMember.objects.create(
        user=user,
        display_name=full_name,
        is_active=is_active,
    )
    write_audit_log(
        actor=actor,
        action="user_created",
        entity_type="User",
        entity_id=user.id,
        description=f"Created team member {user.email}",
        new_values={
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "is_staff": user.is_staff,
        },
        request=request,
    )
    return user


@transaction.atomic
def login_user(*, email: str, password: str, request=None) -> tuple[User, Token]:
    email = _normalize_email(email)
    ip = get_client_ip(request)

    def _fail(message: str = "Invalid email or password.") -> None:
        write_audit_log(
            actor=None,
            action="login_failed",
            entity_type="User",
            entity_id=email,
            description=message,
            new_values={"email": email},
            request=request,
        )
        raise LoginFailed(message)

    if not _is_email_approved(email):
        _fail()

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        _fail()

    if user.is_locked:
        write_audit_log(
            actor=user,
            action="login_failed",
            entity_type="User",
            entity_id=user.id,
            description="Account temporarily locked",
            request=request,
        )
        raise LoginFailed("Account is temporarily locked. Try again later.")

    if not user.is_active:
        _fail("Account is inactive.")

    if not user.check_password(password):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= settings.FAILED_LOGIN_MAX_ATTEMPTS:
            user.locked_until = timezone.now() + timedelta(
                minutes=settings.FAILED_LOGIN_LOCKOUT_MINUTES
            )
            user.failed_login_attempts = 0
        user.save(update_fields=["failed_login_attempts", "locked_until", "updated_at"])
        _fail()

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_ip = ip
    user.save(
        update_fields=["failed_login_attempts", "locked_until", "last_login_ip", "updated_at"]
    )
    token, _ = Token.objects.get_or_create(user=user)
    write_audit_log(
        actor=user,
        action="login",
        entity_type="User",
        entity_id=user.id,
        description="User logged in",
        request=request,
    )
    return user, token


@transaction.atomic
def logout_user(*, user: User, request=None) -> None:
    Token.objects.filter(user=user).delete()
    write_audit_log(
        actor=user,
        action="logout",
        entity_type="User",
        entity_id=user.id,
        description="User logged out",
        request=request,
    )


@transaction.atomic
def forgot_password(*, email: str, request=None) -> str:
    email = _normalize_email(email)
    # Always return the same message to prevent enumeration.
    if _is_email_approved(email):
        user = User.objects.filter(email=email, is_active=True).first()
        if user:
            _create_otp(user, OTPPurpose.PASSWORD_RESET, request=request)
            write_audit_log(
                actor=user,
                action="password_reset_requested",
                entity_type="User",
                entity_id=user.id,
                description="Password reset OTP requested",
                request=request,
            )
    return GENERIC_RESET_MESSAGE


def _get_active_otp(user: User, purpose: str) -> OTPVerification:
    otp = (
        OTPVerification.objects.filter(user=user, purpose=purpose, is_used=False)
        .order_by("-created_at")
        .first()
    )
    if otp is None:
        raise ValidationError({"otp": "No active OTP found. Request a new code."})
    if otp.is_expired:
        raise ValidationError({"otp": "OTP has expired. Request a new code."})
    return otp


@transaction.atomic
def verify_otp(*, email: str, purpose: str, otp_code: str, request=None) -> dict:
    email = _normalize_email(email)
    user = User.objects.filter(email=email).first()
    if user is None:
        # Enumeration-safe message
        raise ValidationError({"otp": "Invalid or expired OTP."})

    otp = _get_active_otp(user, purpose)
    if otp.attempt_count >= settings.OTP_MAX_ATTEMPTS:
        raise ValidationError({"otp": "Maximum verification attempts exceeded."})

    if not check_password(otp_code, otp.code_hash):
        otp.attempt_count += 1
        otp.save(update_fields=["attempt_count"])
        write_audit_log(
            actor=user,
            action="otp_verify_failed",
            entity_type="OTPVerification",
            entity_id=otp.id,
            description="OTP verification failed",
            request=request,
        )
        raise ValidationError({"otp": "Invalid or expired OTP."})

    otp.is_used = True
    otp.used_at = timezone.now()
    otp.save(update_fields=["is_used", "used_at"])
    write_audit_log(
        actor=user,
        action="otp_verified",
        entity_type="OTPVerification",
        entity_id=otp.id,
        description=f"OTP verified for {purpose}",
        new_values={"purpose": purpose},
        request=request,
    )
    # Issue a short-lived verification token via unused OTP marker / password reset token pattern:
    # Return a one-time reset token stored as a new used-purpose marker using Token is not ideal.
    # Use a signed Django token-less approach: create a dedicated used OTP record id as proof.
    return {"email": user.email, "purpose": purpose, "verification_id": str(otp.id)}


@transaction.atomic
def resend_otp(*, email: str, purpose: str, request=None) -> str:
    email = _normalize_email(email)
    message = GENERIC_RESET_MESSAGE
    if not _is_email_approved(email):
        return message
    user = User.objects.filter(email=email, is_active=True).first()
    if user is None:
        return message

    now = timezone.now()
    latest = (
        OTPVerification.objects.filter(user=user, purpose=purpose)
        .order_by("-created_at")
        .first()
    )
    if latest and latest.last_sent_at:
        elapsed = (now - latest.last_sent_at).total_seconds()
        if elapsed < settings.OTP_RESEND_COOLDOWN_SECONDS:
            raise ValidationError(
                {"otp": f"Please wait {settings.OTP_RESEND_COOLDOWN_SECONDS} seconds before resending."}
            )

    hour_ago = now - timedelta(hours=1)
    recent_resends = OTPVerification.objects.filter(
        user=user,
        purpose=purpose,
        created_at__gte=hour_ago,
    ).count()
    if recent_resends >= settings.OTP_MAX_RESENDS_PER_HOUR:
        raise ValidationError({"otp": "OTP resend limit reached. Try again later."})

    _create_otp(user, purpose, request=request)
    return message


@transaction.atomic
def reset_password(
    *,
    email: str,
    verification_id: str,
    new_password: str,
    request=None,
) -> None:
    email = _normalize_email(email)
    user = User.objects.filter(email=email, is_active=True).first()
    if user is None:
        raise ValidationError({"email": "Unable to reset password."})

    otp = OTPVerification.objects.filter(
        id=verification_id,
        user=user,
        purpose=OTPPurpose.PASSWORD_RESET,
        is_used=True,
    ).first()
    if otp is None or otp.used_at is None:
        raise ValidationError({"verification_id": "Invalid verification."})
    # verification_id must have been used recently
    if otp.used_at < timezone.now() - timedelta(minutes=settings.OTP_EXPIRY_MINUTES):
        raise ValidationError({"verification_id": "Verification expired. Restart reset flow."})

    user.set_password(new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    user.save(update_fields=["password", "failed_login_attempts", "locked_until", "updated_at"])
    Token.objects.filter(user=user).delete()
    write_audit_log(
        actor=user,
        action="password_reset",
        entity_type="User",
        entity_id=user.id,
        description="Password reset completed",
        request=request,
    )


@transaction.atomic
def change_password_request(*, user: User, request=None) -> str:
    _create_otp(user, OTPPurpose.PASSWORD_CHANGE, request=request)
    return "If permitted, an OTP has been sent to your email."


@transaction.atomic
def change_password_confirm(
    *,
    user: User,
    otp_code: str,
    current_password: str,
    new_password: str,
    request=None,
) -> None:
    if not user.check_password(current_password):
        raise ValidationError({"current_password": "Current password is incorrect."})

    otp = _get_active_otp(user, OTPPurpose.PASSWORD_CHANGE)
    if otp.attempt_count >= settings.OTP_MAX_ATTEMPTS:
        raise ValidationError({"otp": "Maximum verification attempts exceeded."})
    if not check_password(otp_code, otp.code_hash):
        otp.attempt_count += 1
        otp.save(update_fields=["attempt_count"])
        raise ValidationError({"otp": "Invalid or expired OTP."})

    otp.is_used = True
    otp.used_at = timezone.now()
    otp.save(update_fields=["is_used", "used_at"])
    user.set_password(new_password)
    user.save(update_fields=["password", "updated_at"])
    Token.objects.filter(user=user).delete()
    Token.objects.create(user=user)
    write_audit_log(
        actor=user,
        action="password_changed",
        entity_type="User",
        entity_id=user.id,
        description="Password changed with OTP verification",
        request=request,
    )


@transaction.atomic
def activate_user(*, actor: User, user: User, request=None) -> User:
    if not actor.is_staff:
        raise PermissionDenied("Only technical administrators can activate accounts.")
    user.is_active = True
    user.save(update_fields=["is_active", "updated_at"])
    if hasattr(user, "team_member"):
        user.team_member.is_active = True
        user.team_member.save(update_fields=["is_active", "updated_at"])
    write_audit_log(
        actor=actor,
        action="user_activated",
        entity_type="User",
        entity_id=user.id,
        description=f"Activated {user.email}",
        request=request,
    )
    return user


@transaction.atomic
def deactivate_user(*, actor: User, user: User, request=None) -> User:
    if not actor.is_staff:
        raise PermissionDenied("Only technical administrators can deactivate accounts.")
    if actor.id == user.id:
        raise ValidationError({"user": "You cannot deactivate your own account."})
    user.is_active = False
    user.save(update_fields=["is_active", "updated_at"])
    Token.objects.filter(user=user).delete()
    if hasattr(user, "team_member"):
        user.team_member.is_active = False
        user.team_member.save(update_fields=["is_active", "updated_at"])
    write_audit_log(
        actor=actor,
        action="user_deactivated",
        entity_type="User",
        entity_id=user.id,
        description=f"Deactivated {user.email}",
        request=request,
    )
    return user
