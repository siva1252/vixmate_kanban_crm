from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from common.models import TimeStampedModel


class MeetingType(models.TextChoices):
    ONLINE = "online", "Online"
    OFFLINE = "offline", "Offline"


class MeetingStatus(models.TextChoices):
    SCHEDULED = "scheduled", "Scheduled"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"
    RESCHEDULED = "rescheduled", "Rescheduled"


class Meeting(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        "crm.Client",
        on_delete=models.CASCADE,
        related_name="meetings",
    )
    title = models.CharField(max_length=255)
    meeting_date = models.DateField(db_index=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    coordinator = models.ForeignKey(
        "team.TeamMember",
        on_delete=models.PROTECT,
        related_name="meetings_coordinated",
    )
    meeting_type = models.CharField(max_length=16, choices=MeetingType.choices)
    meeting_link = models.URLField(blank=True, default="")
    location = models.CharField(max_length=255, blank=True, default="")
    agenda = models.TextField(blank=True, default="")
    discussion_notes = models.TextField(blank=True, default="")
    outcome = models.TextField(blank=True, default="")
    next_action = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=32,
        choices=MeetingStatus.choices,
        default=MeetingStatus.SCHEDULED,
        db_index=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="meetings_created",
    )

    class Meta:
        ordering = ["-meeting_date", "-start_time"]
        indexes = [
            models.Index(fields=["client", "status"]),
            models.Index(fields=["meeting_date", "status"]),
        ]

    def __str__(self) -> str:
        return self.title


class MeetingParticipant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    meeting = models.ForeignKey(
        Meeting,
        on_delete=models.CASCADE,
        related_name="participants",
    )
    team_member = models.ForeignKey(
        "team.TeamMember",
        on_delete=models.CASCADE,
        related_name="meeting_participations",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["meeting", "team_member"],
                name="uniq_meeting_participant",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.team_member} @ {self.meeting}"


class MeetingHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    meeting = models.ForeignKey(Meeting, on_delete=models.CASCADE, related_name="history")
    action = models.CharField(max_length=64)
    old_values = models.JSONField(default=dict, blank=True)
    new_values = models.JSONField(default=dict, blank=True)
    reason = models.TextField(blank=True, default="")
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-changed_at"]
        verbose_name_plural = "Meeting histories"
