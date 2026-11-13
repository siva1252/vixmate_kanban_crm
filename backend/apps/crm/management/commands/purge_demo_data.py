"""Remove demo CRM data + audit logs. Keeps the 5 real team users and configuration."""

from __future__ import annotations

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.audit.models import AuditLog
from apps.crm.models import Client
from apps.lead_source.models import LeadSourceAttribution, LeadSourcePerson


class Command(BaseCommand):
    help = "Delete leads, Lead Source people, and audit logs; re-sync 5 Admin users."

    @transaction.atomic
    def handle(self, *args, **options):
        log_count, _ = AuditLog.objects.all().delete()
        attr_count, _ = LeadSourceAttribution.objects.all().delete()
        people_count, _ = LeadSourcePerson.objects.all().delete()
        client_count, _ = Client.objects.all().delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Purged: clients={client_count}, lead_source_people={people_count}, "
                f"attributions={attr_count}, audit_logs={log_count}"
            )
        )
        call_command("seed_demo_users", purge_logs=True)
