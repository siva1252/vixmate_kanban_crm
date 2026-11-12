"""Seed demo leads using real configuration FKs (for Swagger / local testing)."""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User
from apps.configuration.models import Industry, LeadSource, Service
from apps.crm.models import Client, LeadStage
from apps.crm.services import clients as client_services


DEMO_LEADS = [
    {
        "client_name": "Acme Retail",
        "primary_phone": "9001001001",
        "primary_email": "ops@acmeretail.example",
        "source_name": "LinkedIn",
        "service_name": "Web Development",
        "industry_name": "Retail",
        "stage_slug": "new-lead",
        "first_call_completed": False,
    },
    {
        "client_name": "HealthPlus Clinics",
        "primary_phone": "9001001002",
        "primary_email": "it@healthplus.example",
        "source_name": "Referral",
        "service_name": "App Development",
        "industry_name": "Healthcare",
        "stage_slug": "in-progress",
        "first_call_completed": True,
        "decision_maker_phone": "9001001099",
    },
    {
        "client_name": "FinServe India",
        "primary_phone": "9001001003",
        "primary_email": "growth@finserve.example",
        "source_name": "Google",
        "service_name": "AI/ML Solutions",
        "industry_name": "Finance",
        "stage_slug": "qualified",
        "first_call_completed": True,
    },
]


class Command(BaseCommand):
    help = "Seed demo leads with valid lead_source / service / industry IDs."

    @transaction.atomic
    def handle(self, *args, **options):
        actor = (
            User.objects.filter(email="siva@viximate.local").first()
            or User.objects.filter(is_staff=True).first()
            or User.objects.first()
        )
        if actor is None:
            self.stderr.write(
                self.style.ERROR("No users found. Run seed_demo_users first.")
            )
            return

        source_map = {s.name: s for s in LeadSource.objects.filter(is_active=True)}
        service_map = {s.name: s for s in Service.objects.filter(is_active=True)}
        industry_map = {i.name: i for i in Industry.objects.filter(is_active=True)}
        stage_map = {s.slug: s for s in LeadStage.objects.filter(is_active=True)}

        if not source_map or not service_map or not stage_map:
            self.stderr.write(
                self.style.ERROR("Configuration missing. Run seed_configuration first.")
            )
            return

        created = 0
        for item in DEMO_LEADS:
            if Client.objects.filter(client_name=item["client_name"], is_deleted=False).exists():
                self.stdout.write(f"Skip existing lead: {item['client_name']}")
                continue

            source = source_map.get(item["source_name"]) or next(iter(source_map.values()))
            service = service_map.get(item["service_name"]) or next(iter(service_map.values()))
            industry = industry_map.get(item.get("industry_name", ""))
            stage = stage_map.get(item["stage_slug"]) or stage_map.get("new-lead")

            data = {
                "client_name": item["client_name"],
                "primary_phone": item["primary_phone"],
                "primary_email": item.get("primary_email", ""),
                "lead_source": source,
                "service": service,
                "industry": industry,
                "first_call_completed": item.get("first_call_completed", False),
                "stage": stage,
            }
            if item.get("decision_maker_phone"):
                data["decision_maker_phone"] = item["decision_maker_phone"]
            if item.get("first_call_completed"):
                data["client_requirements"] = "Demo seeded requirements"
                data["call_discussion_notes"] = "Demo first-call notes"

            client = client_services.create_client(actor=actor, data=data)
            # create_client always starts at New Lead; move if needed
            if stage and client.stage_id != stage.id:
                client_services.move_client_stage(
                    actor=actor, client=client, new_stage=stage
                )
            created += 1
            self.stdout.write(
                self.style.SUCCESS(
                    f"Created lead {client.client_name} "
                    f"(source={source.id}, service={service.id})"
                )
            )

        self.stdout.write(self.style.SUCCESS(f"Demo leads ready ({created} created)."))
