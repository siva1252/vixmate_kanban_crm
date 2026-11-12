"""External Lead Source people — no CRM login; many people per lead."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from common.models import TimeStampedModel


class LeadSourcePerson(TimeStampedModel):
    """
    Outside person linked to leads (agency / freelancer / introducer).
    Not a User / TeamMember — zero CRM access.
    UI tab: Lead Source.
    Distinct from configuration.LeadSource (channel: LinkedIn, Google, …).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    display_name = models.CharField(max_length=255, db_index=True)
    phone = models.CharField(max_length=32, blank=True, default="", db_index=True)
    email = models.EmailField(blank=True, default="", db_index=True)
    role_label = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="e.g. Agency contact, Freelancer, Introducer",
    )
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="lead_source_people_created",
    )

    class Meta:
        ordering = ["display_name"]
        verbose_name = "Lead Source person"
        verbose_name_plural = "Lead Source people"

    def __str__(self) -> str:
        return self.display_name


class LeadSourceAttribution(TimeStampedModel):
    """Many Lead Source people can be linked to one lead (and vice versa)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        "crm.Client",
        on_delete=models.CASCADE,
        related_name="lead_source_attributions",
    )
    person = models.ForeignKey(
        LeadSourcePerson,
        on_delete=models.CASCADE,
        related_name="attributions",
    )
    note = models.CharField(max_length=255, blank=True, default="")
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="lead_source_attributions_assigned",
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["client", "person"],
                condition=models.Q(is_active=True),
                name="uniq_active_lead_source_attribution",
            )
        ]
        verbose_name = "Lead Source attribution"
        verbose_name_plural = "Lead Source attributions"

    def __str__(self) -> str:
        return f"{self.person_id} → {self.client_id}"
