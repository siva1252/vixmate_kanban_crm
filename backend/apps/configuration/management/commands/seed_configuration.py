"""Seed Kanban stages, lead sources, services, industries, and responsibilities."""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from apps.assignments.models import ResponsibilityType
from apps.configuration.models import Industry, LeadSource, Service
from apps.crm.models import LeadStage


STAGES = [
    ("New Lead", "new-lead", 1, False),
    ("Call Back", "call-back", 2, False),
    ("In Progress", "in-progress", 3, False),
    ("Qualified", "qualified", 4, False),
    ("Meeting", "meeting", 5, False),
    ("Negotiation", "negotiation", 6, False),
    ("Loss", "loss", 7, True),
    ("Won", "won", 8, True),
]

SOURCES = [
    ("LinkedIn", False),
    ("Instagram", False),
    ("Facebook", False),
    ("Google", False),
    ("Referral", False),
    ("Cold Calling", False),
    ("Email", False),
    ("Website Inquiry", False),
    ("Other", True),
]

SERVICES = [
    ("App Development", False),
    ("E-commerce", False),
    ("Automation", False),
    ("Social Media", False),
    ("AI/ML Solutions", False),
    ("Web Development", False),
    ("Digital Marketing", False),
    ("Other", True),
]

INDUSTRIES = [
    "Technology",
    "Healthcare",
    "Finance",
    "Education",
    "Retail",
    "Manufacturing",
    "Real Estate",
    "Other",
]

RESPONSIBILITIES = [
    ("Lead Creation", "lead-creation", 1, True),
    ("Technical Management", "technical-management", 2, True),
    ("Meetings", "meetings", 3, True),
    ("Communication", "communication", 4, True),
    ("Follow-up", "follow-up", 5, True),
]


class Command(BaseCommand):
    help = "Seed default CRM configuration (stages, sources, services, responsibilities)."

    @transaction.atomic
    def handle(self, *args, **options):
        for name, slug, order, terminal in STAGES:
            LeadStage.objects.update_or_create(
                slug=slug,
                defaults={
                    "name": name,
                    "display_order": order,
                    "is_terminal": terminal,
                    "is_active": True,
                },
            )

        for index, (name, allows_other) in enumerate(SOURCES, start=1):
            LeadSource.objects.update_or_create(
                slug=slugify(name),
                defaults={
                    "name": name,
                    "display_order": index,
                    "is_active": True,
                    "allows_other_text": allows_other,
                },
            )

        for index, (name, allows_other) in enumerate(SERVICES, start=1):
            Service.objects.update_or_create(
                slug=slugify(name),
                defaults={
                    "name": name,
                    "display_order": index,
                    "is_active": True,
                    "allows_other_text": allows_other,
                },
            )

        for index, name in enumerate(INDUSTRIES, start=1):
            Industry.objects.update_or_create(
                slug=slugify(name),
                defaults={
                    "name": name,
                    "display_order": index,
                    "is_active": True,
                    "allows_other_text": name == "Other",
                },
            )

        for name, slug, order, multi in RESPONSIBILITIES:
            ResponsibilityType.objects.update_or_create(
                slug=slug,
                defaults={
                    "name": name,
                    "display_order": order,
                    "is_active": True,
                    "allows_multiple_members": multi,
                },
            )

        self.stdout.write(self.style.SUCCESS("Configuration seeded successfully."))
