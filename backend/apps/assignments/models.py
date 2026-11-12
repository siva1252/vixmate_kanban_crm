from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from common.models import TimeStampedModel


class ResponsibilityType(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=128, unique=True)
    slug = models.SlugField(max_length=128, unique=True)
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    allows_multiple_members = models.BooleanField(default=True)
    description = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["display_order", "name"]

    def __str__(self) -> str:
        return self.name


class LeadAssignment(TimeStampedModel):
    """Assignment of a team member to a responsibility for a client."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        "crm.Client",
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    responsibility_type = models.ForeignKey(
        ResponsibilityType,
        on_delete=models.PROTECT,
        related_name="assignments",
    )
    team_member = models.ForeignKey(
        "team.TeamMember",
        on_delete=models.CASCADE,
        related_name="lead_assignments",
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assignments_made",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["responsibility_type__display_order", "team_member__display_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["client", "responsibility_type", "team_member"],
                name="uniq_client_responsibility_member",
            ),
        ]
        indexes = [
            models.Index(fields=["client", "responsibility_type", "is_active"]),
        ]

    def __str__(self) -> str:
        return f"{self.client} / {self.responsibility_type}: {self.team_member}"


class LeadWorking(TimeStampedModel):
    """Who is working on a lead and what they are working on (work note)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        "crm.Client",
        on_delete=models.CASCADE,
        related_name="working_assignments",
    )
    team_member = models.ForeignKey(
        "team.TeamMember",
        on_delete=models.CASCADE,
        related_name="working_on_leads",
    )
    work_note = models.TextField(help_text="What this member is working on for the lead.")
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="working_assignments_made",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="working_assignments_updated",
    )
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["client", "team_member"],
                condition=models.Q(is_active=True),
                name="uniq_active_working_per_client_member",
            ),
        ]
        indexes = [
            models.Index(fields=["client", "is_active"]),
        ]

    def __str__(self) -> str:
        return f"{self.team_member} on {self.client}"


class AssignmentHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        "crm.Client",
        on_delete=models.CASCADE,
        related_name="assignment_history",
    )
    responsibility_type = models.ForeignKey(
        ResponsibilityType,
        on_delete=models.PROTECT,
        related_name="assignment_history",
    )
    previous_member = models.ForeignKey(
        "team.TeamMember",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    new_member = models.ForeignKey(
        "team.TeamMember",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assignment_history_entries",
    )
    reason = models.TextField()
    assigned_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-assigned_at"]
        verbose_name_plural = "Assignment histories"

    def __str__(self) -> str:
        return f"{self.responsibility_type} reassignment for {self.client}"
