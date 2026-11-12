"""Seed Kanban stages, lead sources, services, industries, and responsibilities."""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from apps.assignments.models import ResponsibilityType
from apps.configuration.models import Industry, LeadSource, Service
from apps.crm.models import LeadStage


STAGES = [
    # name, slug, order, terminal, color
    ("New Lead", "new-lead", 1, False, "#3b82f6"),
    ("Call Back", "call-back", 2, False, "#f97316"),
    ("In Progress", "in-progress", 3, False, "#14b8a6"),
    ("Qualified", "qualified", 4, False, "#22c55e"),
    ("Meeting", "meeting", 5, False, "#a855f7"),
    ("Negotiation", "negotiation", 6, False, "#eab308"),
    ("Loss", "loss", 7, True, "#ef4444"),
    ("Won", "won", 8, True, "#0f766e"),
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
        for name, slug, order, terminal, color in STAGES:
            LeadStage.objects.update_or_create(
                slug=slug,
                defaults={
                    "name": name,
                    "display_order": order,
                    "is_terminal": terminal,
                    "is_active": True,
                    "color": color,
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
        self.stdout.write("Lead sources:")
        for row in LeadSource.objects.filter(is_active=True).order_by("display_order"):
            self.stdout.write(f"  {row.name}: {row.id}")
        self.stdout.write("Services:")
        for row in Service.objects.filter(is_active=True).order_by("display_order"):
            self.stdout.write(f"  {row.name}: {row.id}")
        self.stdout.write("Industries:")
        for row in Industry.objects.filter(is_active=True).order_by("display_order"):
            self.stdout.write(f"  {row.name}: {row.id}")
        self.stdout.write("Stages:")
        for row in LeadStage.objects.filter(is_active=True).order_by("display_order"):
            self.stdout.write(f"  {row.name}: {row.id}")
