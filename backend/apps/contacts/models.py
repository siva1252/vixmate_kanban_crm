from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from common.models import TimeStampedModel


class ContactPerson(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        "crm.Client",
        on_delete=models.CASCADE,
        related_name="contacts",
    )
    name = models.CharField(max_length=255, db_index=True)
    designation = models.CharField(max_length=128, blank=True, default="")
    primary_phone = models.CharField(max_length=32, blank=True, default="", db_index=True)
    alternate_phone = models.CharField(max_length=32, blank=True, default="")
    primary_email = models.EmailField(blank=True, default="", db_index=True)
    alternate_email = models.EmailField(blank=True, default="")
    notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="contacts_created",
    )

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["client", "name"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.client})"
