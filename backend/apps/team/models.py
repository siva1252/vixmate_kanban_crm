"""Team member profiles and availability history."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from common.models import TimeStampedModel


class AvailabilityStatus(models.TextChoices):
    AVAILABLE = "available", "Available"
    BUSY = "busy", "Busy"
    ON_LEAVE = "on_leave", "On Leave"


class TeamMember(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="team_member",
    )
    display_name = models.CharField(max_length=255)
    job_title = models.CharField(max_length=128, blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)
    availability_status = models.CharField(
        max_length=32,
        choices=AvailabilityStatus.choices,
        default=AvailabilityStatus.AVAILABLE,
        db_index=True,
    )

    class Meta:
        ordering = ["display_name"]
        indexes = [
            models.Index(fields=["is_active", "availability_status"]),
        ]

    def __str__(self) -> str:
        return self.display_name


class AvailabilityHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team_member = models.ForeignKey(
        TeamMember,
        on_delete=models.CASCADE,
        related_name="availability_history",
    )
    previous_status = models.CharField(
        max_length=32,
        choices=AvailabilityStatus.choices,
        blank=True,
        default="",
    )
    new_status = models.CharField(max_length=32, choices=AvailabilityStatus.choices)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="availability_changes",
    )
    changed_at = models.DateTimeField(auto_now_add=True, db_index=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-changed_at"]
        verbose_name_plural = "Availability histories"

    def __str__(self) -> str:
        return f"{self.team_member}: {self.previous_status} -> {self.new_status}"
