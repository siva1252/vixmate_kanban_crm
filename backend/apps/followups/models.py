from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from apps.calls.models import CallOutcome
from common.models import TimeStampedModel


class FollowUpStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    COMPLETED = "completed", "Completed"
    SKIPPED = "skipped", "Skipped"


class FollowUp(TimeStampedModel):
    """Manual follow-up records only. No automated reminders in this phase."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        "crm.Client",
        on_delete=models.CASCADE,
        related_name="followups",
    )
    follow_up_date = models.DateField(db_index=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="followups_updated",
    )
    call_outcome = models.CharField(
        max_length=32,
        choices=CallOutcome.choices,
        blank=True,
        default="",
    )
    notes = models.TextField(blank=True, default="")
    next_action = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=32,
        choices=FollowUpStatus.choices,
        default=FollowUpStatus.PENDING,
        db_index=True,
    )

    class Meta:
        ordering = ["-follow_up_date", "-updated_at"]
        indexes = [
            models.Index(fields=["client", "status"]),
        ]

    def __str__(self) -> str:
        return f"Follow-up {self.client} on {self.follow_up_date}"
