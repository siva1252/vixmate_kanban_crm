"""Seed CRM team members (approved emails + passwords). No public signup."""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import ApprovedEmail, User
from apps.accounts.services.auth import create_team_user
from apps.team.models import TeamMember

COMMON_PASSWORD = "Viximate@high5"

TEAM_MEMBERS = [
    {"email": "gunwant@viximate.com", "full_name": "Gunwant", "job_title": "Team Lead"},
    {"email": "harsh@viximate.com", "full_name": "Harsh", "job_title": "Team Lead"},
    {"email": "jyotsna@viximate.com", "full_name": "Jyotsna", "job_title": "Team Lead"},
    {"email": "pratik@viximate.com", "full_name": "Pratik", "job_title": "Team Lead"},
    {"email": "siva@viximate.com", "full_name": "Siva", "job_title": "Team Lead"},
]


class Command(BaseCommand):
    help = "Seed / sync Viximate team members for CRM login (DB only)."

    @transaction.atomic
    def handle(self, *args, **options):
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
        ApprovedEmail.objects.update_or_create(
            email=admin.email,
            defaults={"is_active": True, "notes": "Internal admin"},
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
                ApprovedEmail.objects.update_or_create(
                    email=email,
                    defaults={"is_active": True, "notes": "Team lead", "created_by": admin},
                )
                TeamMember.objects.update_or_create(
                    user=user,
                    defaults={
                        "display_name": row["full_name"],
                        "job_title": row["job_title"],
                        "is_active": True,
                    },
                )
                self.stdout.write(self.style.WARNING(f"Synced {email}"))

            TeamMember.objects.filter(user=user).update(
                display_name=row["full_name"],
                job_title=row["job_title"],
                is_active=True,
            )

        self.stdout.write(self.style.SUCCESS("Team members ready."))
        self.stdout.write(f"Common password: {COMMON_PASSWORD}")
        self.stdout.write("Emails: " + ", ".join(m["email"] for m in TEAM_MEMBERS))
