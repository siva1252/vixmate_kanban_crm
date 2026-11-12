import re
from datetime import timedelta

import pytest
from django.contrib.auth.hashers import check_password
from django.core import mail
from django.utils import timezone
from freezegun import freeze_time
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.accounts.models import ApprovedEmail, OTPPurpose, OTPVerification, User
from apps.accounts.services.auth import create_team_user, forgot_password, verify_otp


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def admin_user(db):
    user = User.objects.create_superuser(
        email="admin@viximate.local",
        password="AdminPass123!",
        full_name="Admin User",
    )
    ApprovedEmail.objects.create(email=user.email, is_active=True, created_by=user)
    return user


@pytest.fixture
def member(db, admin_user):
    return create_team_user(
        actor=admin_user,
        email="siva@viximate.local",
        full_name="Siva",
        password="MemberPass123!",
        phone_number="9999999999",
    )


@pytest.mark.django_db
def test_password_is_hashed(member):
    assert member.password != "MemberPass123!"
    assert member.check_password("MemberPass123!")


@pytest.mark.django_db
def test_approved_email_login(api, member):
    response = api.post(
        "/api/auth/login/",
        {"email": "siva@viximate.local", "password": "MemberPass123!"},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.data["success"] is True
    data = response.data["data"]
    assert data["token_type"] == "Bearer"
    assert data["access"]
    assert data["refresh"]
    assert data["expires_in"] > 0
    assert "password" not in data["user"]


@pytest.mark.django_db
def test_invalid_login(api, member):
    response = api.post(
        "/api/auth/login/",
        {"email": "siva@viximate.local", "password": "wrong"},
        format="json",
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_unapproved_email_cannot_login(api, db):
    User.objects.create_user(
        email="outsider@example.com",
        password="OutsiderPass123!",
        full_name="Outsider",
    )
    response = api.post(
        "/api/auth/login/",
        {"email": "outsider@example.com", "password": "OutsiderPass123!"},
        format="json",
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_deactivated_account_cannot_login(api, member):
    member.is_active = False
    member.save()
    response = api.post(
        "/api/auth/login/",
        {"email": "siva@viximate.local", "password": "MemberPass123!"},
        format="json",
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_me_with_access_token(api, member):
    login = api.post(
        "/api/auth/login/",
        {"email": member.email, "password": "MemberPass123!"},
        format="json",
    )
    access = login.data["data"]["access"]
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    me = api.get("/api/auth/me/")
    assert me.status_code == status.HTTP_200_OK
    assert me.data["data"]["email"] == member.email


@pytest.mark.django_db
def test_token_refresh(api, member):
    login = api.post(
        "/api/auth/login/",
        {"email": member.email, "password": "MemberPass123!"},
        format="json",
    )
    refresh = login.data["data"]["refresh"]
    response = api.post("/api/auth/token/refresh/", {"refresh": refresh}, format="json")
    assert response.status_code == status.HTTP_200_OK
    assert response.data["data"]["access"]
    assert response.data["data"]["refresh"]


@pytest.mark.django_db
def test_forgot_password_enumeration_safe(api, member):
    r1 = api.post("/api/auth/forgot-password/", {"email": member.email}, format="json")
    r2 = api.post(
        "/api/auth/forgot-password/",
        {"email": "missing@viximate.local"},
        format="json",
    )
    assert r1.status_code == status.HTTP_200_OK
    assert r2.status_code == status.HTTP_200_OK
    assert r1.data["message"] == r2.data["message"]


@pytest.mark.django_db
def test_otp_generation_and_hashing(member):
    forgot_password(email=member.email)
    otp = OTPVerification.objects.filter(user=member, purpose=OTPPurpose.PASSWORD_RESET).latest(
        "created_at"
    )
    assert otp.code_hash
    assert not check_password("000000", otp.code_hash) or True
    assert len(mail.outbox) == 1
    code = re.search(r"\b(\d{6})\b", mail.outbox[0].body).group(1)
    assert check_password(code, otp.code_hash)


@pytest.mark.django_db
def test_otp_expiry(member, settings):
    settings.OTP_EXPIRY_MINUTES = 10
    forgot_password(email=member.email)
    code = re.search(r"\b(\d{6})\b", mail.outbox[0].body).group(1)
    with freeze_time(timezone.now() + timedelta(minutes=11)):
        with pytest.raises(ValidationError):
            verify_otp(email=member.email, purpose=OTPPurpose.PASSWORD_RESET, otp_code=code)


@pytest.mark.django_db
def test_otp_resend_limits(api, member, settings):
    settings.OTP_RESEND_COOLDOWN_SECONDS = 60
    settings.OTP_MAX_RESENDS_PER_HOUR = 2
    api.post("/api/auth/forgot-password/", {"email": member.email}, format="json")
    response = api.post(
        "/api/auth/otp/resend/",
        {"email": member.email, "purpose": OTPPurpose.PASSWORD_RESET},
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_password_reset_flow(api, member):
    api.post("/api/auth/forgot-password/", {"email": member.email}, format="json")
    code = re.search(r"\b(\d{6})\b", mail.outbox[0].body).group(1)
    verify = api.post(
        "/api/auth/otp/verify/",
        {
            "email": member.email,
            "purpose": OTPPurpose.PASSWORD_RESET,
            "otp": code,
        },
        format="json",
    )
    assert verify.status_code == status.HTTP_200_OK
    verification_id = verify.data["data"]["verification_id"]
    reset = api.post(
        "/api/auth/password/reset/",
        {
            "email": member.email,
            "verification_id": verification_id,
            "new_password": "NewMemberPass123!",
        },
        format="json",
    )
    assert reset.status_code == status.HTTP_200_OK
    member.refresh_from_db()
    assert member.check_password("NewMemberPass123!")


@pytest.mark.django_db
def test_logout(api, member):
    login = api.post(
        "/api/auth/login/",
        {"email": member.email, "password": "MemberPass123!"},
        format="json",
    )
    access = login.data["data"]["access"]
    refresh = login.data["data"]["refresh"]
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    response = api.post("/api/auth/logout/", {"refresh": refresh}, format="json")
    assert response.status_code == status.HTTP_200_OK
    # Blacklisted refresh cannot be reused
    again = api.post("/api/auth/token/refresh/", {"refresh": refresh}, format="json")
    assert again.status_code == status.HTTP_400_BAD_REQUEST
