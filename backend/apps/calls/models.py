from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from common.models import TimeStampedModel


class CallOutcome(models.TextChoices):
    CONNECTED = "connected", "Connected"
    NO_ANSWER = "no_answer", "No Answer"
    BUSY = "busy", "Busy"
    CALL_BACK_REQUESTED = "call_back_requested", "Call Back Requested"
    NOT_INTERESTED = "not_interested", "Not Interested"
    OTHER = "other", "Other"


class CallHistory(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        "crm.Client",
        on_delete=models.CASCADE,
        related_name="call_history",
    )
    call_datetime = models.DateTimeField(db_index=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    called_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="calls_made",
    )
    outcome = models.CharField(max_length=32, choices=CallOutcome.choices)
    outcome_other = models.CharField(max_length=255, blank=True, default="")
    discussion_notes = models.TextField(blank=True, default="")
    next_action = models.TextField(blank=True, default="")
    follow_up_date = models.DateField(null=True, blank=True)
    is_first_call = models.BooleanField(default=False)

    class Meta:
        ordering = ["-call_datetime"]
        verbose_name_plural = "Call histories"
        indexes = [
            models.Index(fields=["client", "call_datetime"]),
            models.Index(fields=["outcome"]),
        ]

    def __str__(self) -> str:
        return f"Call {self.client} @ {self.call_datetime}"
