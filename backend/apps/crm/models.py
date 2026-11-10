"""Clients / leads, kanban stages, and stage history."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from common.models import SoftDeleteModel, TimeStampedModel


class LeadStage(TimeStampedModel):
    """Kanban stages in fixed business order."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=64, unique=True)
    slug = models.SlugField(max_length=64, unique=True)
    display_order = models.PositiveIntegerField(unique=True)
    is_active = models.BooleanField(default=True)
    is_terminal = models.BooleanField(
        default=False,
        help_text="True for Won and Loss stages.",
    )

    class Meta:
        ordering = ["display_order"]

    def __str__(self) -> str:
        return self.name


class Client(TimeStampedModel, SoftDeleteModel):
    """CRM lead / client. Soft-deleted; audit history preserved."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client_name = models.CharField(max_length=255, db_index=True)
    primary_phone = models.CharField(max_length=32, db_index=True)
    alternate_phone = models.CharField(max_length=32, blank=True, default="")
    primary_email = models.EmailField(blank=True, default="", db_index=True)
    alternate_email = models.EmailField(blank=True, default="")

    lead_source = models.ForeignKey(
        "configuration.LeadSource",
        on_delete=models.PROTECT,
        related_name="clients",
    )
    lead_source_other = models.CharField(max_length=255, blank=True, default="")
    service = models.ForeignKey(
        "configuration.Service",
        on_delete=models.PROTECT,
        related_name="clients",
    )
    service_other = models.CharField(max_length=255, blank=True, default="")

    stage = models.ForeignKey(
        LeadStage,
        on_delete=models.PROTECT,
        related_name="clients",
    )

    # First-call workflow
    first_call_completed = models.BooleanField(default=False, db_index=True)
    first_call_completed_at = models.DateTimeField(null=True, blank=True)
    first_call_completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="first_calls_completed",
    )
    first_call_notes = models.TextField(blank=True, default="")

    # Post-call / business information (populated after first call)
    company_name = models.CharField(max_length=255, blank=True, default="", db_index=True)
    website = models.URLField(blank=True, default="")
    company_address = models.TextField(blank=True, default="")
    decision_maker_phone = models.CharField(max_length=32, blank=True, default="")
    decision_maker_alternate_phone = models.CharField(max_length=32, blank=True, default="")
    decision_maker_email = models.EmailField(blank=True, default="")
    decision_maker_alternate_email = models.EmailField(blank=True, default="")
    industry = models.ForeignKey(
        "configuration.Industry",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="clients",
    )
    estimated_deal_value = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
    )
    client_requirements = models.TextField(blank=True, default="")
    next_follow_up_date = models.DateField(null=True, blank=True, db_index=True)
    call_discussion_notes = models.TextField(blank=True, default="")
    agreed_project_scope = models.TextField(blank=True, default="")
    project_deadline = models.DateField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="clients_created",
    )

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["stage", "is_deleted"]),
            models.Index(fields=["lead_source", "is_deleted"]),
            models.Index(fields=["service", "is_deleted"]),
            models.Index(fields=["first_call_completed", "is_deleted"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["client_name", "primary_phone"]),
        ]

    def __str__(self) -> str:
        return self.client_name

    def soft_delete(self, *, actor=None, reason: str = "") -> None:
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.deleted_by = actor
        self.deletion_reason = reason
        self.save(
            update_fields=[
                "is_deleted",
                "deleted_at",
                "deleted_by",
                "deletion_reason",
                "updated_at",
            ]
        )

    def restore(self) -> None:
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.deletion_reason = ""
        self.save(
            update_fields=[
                "is_deleted",
                "deleted_at",
                "deleted_by",
                "deletion_reason",
                "updated_at",
            ]
        )


class LeadStageHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        Client,
        on_delete=models.CASCADE,
        related_name="stage_history",
    )
    previous_stage = models.ForeignKey(
        LeadStage,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    new_stage = models.ForeignKey(
        LeadStage,
        on_delete=models.PROTECT,
        related_name="+",
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="stage_changes",
    )
    changed_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-changed_at"]
        verbose_name_plural = "Lead stage histories"

    def __str__(self) -> str:
        prev = self.previous_stage.name if self.previous_stage else "None"
        return f"{self.client}: {prev} -> {self.new_stage.name}"
