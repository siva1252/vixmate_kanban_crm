from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from common.models import TimeStampedModel


def attachment_upload_to(instance, filename: str) -> str:
    return f"attachments/{instance.client_id}/{uuid.uuid4().hex}_{filename}"


class Attachment(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        "crm.Client",
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    original_filename = models.CharField(max_length=255)
    file = models.FileField(upload_to=attachment_upload_to)
    file_type = models.CharField(max_length=128, blank=True, default="")
    file_size = models.PositiveBigIntegerField(default=0)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="attachments_uploaded",
    )
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    deletion_reason = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["client", "is_deleted"]),
        ]

    def __str__(self) -> str:
        return self.original_filename
