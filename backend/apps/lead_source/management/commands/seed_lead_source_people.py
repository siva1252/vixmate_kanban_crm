"""Seed demo Lead Source people + multi-member attributions."""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import User
from apps.crm.models import Client
from apps.lead_source.models import LeadSourceAttribution, LeadSourcePerson
from apps.lead_source.services import assign_lead_to_person


DEMO = [
    {
        "display_name": "Ravi Agency",
        "phone": "9800010001",
        "email": "ravi@agency.example",
        "role_label": "Agency contact",
        "notes": "Brings retail leads; no CRM access.",
    },
    {
        "display_name": "Meena Introducer",
        "phone": "9800010002",
        "email": "meena@intro.example",
        "role_label": "Introducer",
        "notes": "Referral partner — track attributed leads only.",
    },
]


class Command(BaseCommand):
    help = "Seed external Lead Source people and sample multi-member lead links."

    @transaction.atomic
    def handle(self, *args, **options):
        actor = User.objects.filter(is_staff=True).first() or User.objects.first()
        people = []
        for item in DEMO:
            person, created = LeadSourcePerson.objects.get_or_create(
                display_name=item["display_name"],
                defaults={**item, "created_by": actor, "is_active": True},
            )
            people.append(person)
            self.stdout.write(
                self.style.SUCCESS(f"{'Created' if created else 'Exists'}: {person.display_name}")
            )

        clients = list(Client.objects.filter(is_deleted=False).order_by("created_at")[:3])
        if clients and people:
            # First lead: both people (multiple members on one lead)
            for person in people:
                assign_lead_to_person(
                    actor=actor,
                    person=person,
                    client=clients[0],
                    note="Demo multi-member attribution",
                )
            self.stdout.write(
                self.style.SUCCESS(
                    f"Linked {clients[0].client_name} → {', '.join(p.display_name for p in people)}"
                )
            )
            if len(clients) > 1:
                assign_lead_to_person(
                    actor=actor,
                    person=people[0],
                    client=clients[1],
                    note="Demo single attribution",
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Attributions active: {LeadSourceAttribution.objects.filter(is_active=True).count()}"
            )
        )
