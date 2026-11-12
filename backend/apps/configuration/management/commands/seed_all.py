"""Run full local seed: configuration → demo users → demo leads."""

from __future__ import annotations

import json

from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.configuration.models import Industry, LeadSource, Service


class Command(BaseCommand):
    help = "Seed configuration, demo users, and demo leads for Swagger testing."

    def handle(self, *args, **options):
        call_command("seed_configuration")
        call_command("seed_demo_users")
        # Demo leads / sample Lead Source people are optional — do not invent dummy CRM data here.

        source = LeadSource.objects.filter(is_active=True).order_by("display_order").first()
        service = Service.objects.filter(is_active=True).order_by("display_order").first()
        industry = Industry.objects.filter(is_active=True).order_by("display_order").first()

        if not source or not service:
            self.stderr.write(self.style.ERROR("Seed incomplete — missing source/service."))
            return

        sample = {
            "client_name": "Example Lead",
            "primary_phone": "9888777666",
            "primary_email": "lead@example.com",
            "lead_source": str(source.id),
            "service": str(service.id),
            "industry": str(industry.id) if industry else None,
            "first_call_completed": False,
        }

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=== Example POST /api/clients/ body (real config IDs) ==="))
        self.stdout.write(json.dumps(sample, indent=2))
        self.stdout.write("")
        self.stdout.write("Login: siva@viximate.com / Viximate@high5")
        self.stdout.write("Authorize with JWT access from POST /api/auth/login/")
        self.stdout.write(self.style.SUCCESS("seed_all complete."))
