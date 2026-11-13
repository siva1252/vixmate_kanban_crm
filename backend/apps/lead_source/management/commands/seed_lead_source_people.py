"""Deprecated: do not seed fake Lead Source people."""

from __future__ import annotations

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "No-op — demo Lead Source people are disabled."

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.WARNING(
                "seed_lead_source_people is disabled (no dummy data). "
                "Add people from the Lead Source tab / API."
            )
        )
