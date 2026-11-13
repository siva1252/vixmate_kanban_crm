"""Deprecated: do not seed fake leads. Use the CRM UI / API to create real leads."""

from __future__ import annotations

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "No-op — demo leads are disabled. Create leads via the API/UI."

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.WARNING(
                "seed_demo_leads is disabled (no dummy data). "
                "Create leads from the CRM or POST /api/clients/."
            )
        )
