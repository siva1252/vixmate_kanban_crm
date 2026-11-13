"""Seed / sync the 5 Viximate CRM admins. Removes old .local demo team users."""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import connection, transaction

from apps.accounts.models import ApprovedEmail, OTPVerification, User
from apps.accounts.services.auth import create_team_user
from apps.audit.models import AuditLog
from apps.team.models import TeamMember

COMMON_PASSWORD = "Viximate@high5"

TEAM_MEMBERS = [
    {"email": "gunwant@viximate.com", "full_name": "Gunwant", "job_title": "Admin"},
    {"email": "harsh@viximate.com", "full_name": "Harsh", "job_title": "Admin"},
    {"email": "jyotsna@viximate.com", "full_name": "Jyotsna", "job_title": "Admin"},
    {"email": "pratik@viximate.com", "full_name": "Pratik", "job_title": "Admin"},
    {"email": "siva@viximate.com", "full_name": "Siva", "job_title": "Admin"},
]

KEEP_EMAILS = {m["email"].lower() for m in TEAM_MEMBERS} | {"admin@viximate.local"}


def _hard_delete_user(user: User) -> None:
    """Clear PROTECT / token rows, then delete the user."""
    AuditLog.objects.filter(actor=user).delete()
    TeamMember.objects.filter(user=user).delete()
    OTPVerification.objects.filter(user=user).delete()
    ApprovedEmail.objects.filter(email=user.email).delete()

    # Legacy authtoken table may exist even when the app is not installed.
    with connection.cursor() as cursor:
        cursor.execute("DELETE FROM authtoken_token WHERE user_id = %s", [str(user.pk)])

    try:
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

        OutstandingToken.objects.filter(user=user).delete()
    except Exception:
        pass

    try:
        from apps.calls.models import CallHistory

        CallHistory.objects.filter(called_by=user).delete()
    except Exception:
        pass

    try:
        from apps.comments.models import Comment

        Comment.objects.filter(author=user).delete()
    except Exception:
        pass

    user.delete()


class Command(BaseCommand):
    help = "Sync 5 Admin team members; remove dummy .local team users; optional --purge-logs."

    def add_arguments(self, parser):
        parser.add_argument(
            "--purge-logs",
            action="store_true",
            help="Delete all audit / Active Logs rows.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options.get("purge_logs"):
            count, _ = AuditLog.objects.all().delete()
            self.stdout.write(self.style.SUCCESS(f"Purged audit logs: {count}"))

        admin, created = User.objects.get_or_create(
            email="admin@viximate.local",
            defaults={
                "full_name": "Admin",
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )
        if created:
            admin.set_password(COMMON_PASSWORD)
            admin.save(update_fields=["password"])
        else:
            admin.is_staff = True
            admin.is_superuser = True
            admin.is_active = True
            admin.save(update_fields=["is_staff", "is_superuser", "is_active", "updated_at"])
        # Staff-only account — never show on Teams list
        TeamMember.objects.filter(user=admin).delete()
        ApprovedEmail.objects.update_or_create(
            email=admin.email,
            defaults={"is_active": True, "notes": "Internal Django admin (not CRM team card)"},
        )

        for row in TEAM_MEMBERS:
            email = row["email"].lower()
            user = User.objects.filter(email=email).first()
            if user is None:
                user = create_team_user(
                    actor=admin,
                    email=email,
                    full_name=row["full_name"],
                    password=COMMON_PASSWORD,
                    is_active=True,
                )
                self.stdout.write(self.style.SUCCESS(f"Created {email}"))
            else:
                user.full_name = row["full_name"]
                user.is_active = True
                user.set_password(COMMON_PASSWORD)
                user.failed_login_attempts = 0
                user.locked_until = None
                user.save(
                    update_fields=[
                        "full_name",
                        "is_active",
                        "password",
                        "failed_login_attempts",
                        "locked_until",
                        "updated_at",
                    ]
                )
                self.stdout.write(self.style.WARNING(f"Synced {email}"))

            ApprovedEmail.objects.update_or_create(
                email=email,
                defaults={"is_active": True, "notes": "CRM Admin", "created_by": admin},
            )
            TeamMember.objects.update_or_create(
                user=user,
                defaults={
                    "display_name": row["full_name"],
                    "job_title": "Admin",
                    "is_active": True,
                },
            )

        # Remove dummy / legacy team users (keep only the 5 + staff admin user)
        for user in list(User.objects.exclude(email__in=KEEP_EMAILS)):
            email = user.email
            try:
                _hard_delete_user(user)
                self.stdout.write(self.style.WARNING(f"Removed dummy user {email}"))
            except Exception as exc:
                user.is_active = False
                user.save(update_fields=["is_active", "updated_at"])
                TeamMember.objects.filter(user=user).update(is_active=False)
                self.stdout.write(self.style.WARNING(f"Deactivated dummy user {email}: {exc}"))

        if options.get("purge_logs"):
            # Clear any logs created while syncing / removing users
            count, _ = AuditLog.objects.all().delete()
            self.stdout.write(self.style.SUCCESS(f"Final audit log purge: {count}"))

        active_team = TeamMember.objects.filter(is_active=True).count()
        self.stdout.write(self.style.SUCCESS(f"Active team cards: {active_team} (expect 5)"))
        self.stdout.write(self.style.SUCCESS("Team members ready — all job_title=Admin."))
        self.stdout.write(f"Common password: {COMMON_PASSWORD}")
        self.stdout.write("Emails: " + ", ".join(m["email"] for m in TEAM_MEMBERS))
