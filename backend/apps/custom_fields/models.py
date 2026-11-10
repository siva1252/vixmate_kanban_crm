from __future__ import annotations

import uuid

from django.db import models

from common.models import TimeStampedModel


class CustomFieldType(models.TextChoices):
    TEXT = "text", "Text"
    TEXTAREA = "textarea", "Textarea"
    NUMBER = "number", "Number"
    DECIMAL = "decimal", "Decimal"
    DATE = "date", "Date"
    DATETIME = "datetime", "DateTime"
    DROPDOWN = "dropdown", "Dropdown"
    MULTI_SELECT = "multi_select", "Multi-select"
    CHECKBOX = "checkbox", "Checkbox"
    BOOLEAN = "boolean", "Boolean"
    EMAIL = "email", "Email"
    PHONE = "phone", "Phone"


class CustomFieldDefinition(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    label = models.CharField(max_length=128)
    key = models.SlugField(max_length=64, unique=True)
    field_type = models.CharField(max_length=32, choices=CustomFieldType.choices)
    is_required = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True, db_index=True)
    display_order = models.PositiveIntegerField(default=0)
    choices = models.JSONField(
        default=list,
        blank=True,
        help_text="Dropdown / multi-select choices as a list of strings.",
    )
    validation_rules = models.JSONField(default=dict, blank=True)
    show_on_initial_form = models.BooleanField(default=False)
    show_on_post_first_call = models.BooleanField(default=False)
    show_on_lead_details = models.BooleanField(default=True)

    class Meta:
        ordering = ["display_order", "label"]

    def __str__(self) -> str:
        return self.label


class CustomFieldValue(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        "crm.Client",
        on_delete=models.CASCADE,
        related_name="custom_field_values",
    )
    definition = models.ForeignKey(
        CustomFieldDefinition,
        on_delete=models.CASCADE,
        related_name="values",
    )
    value = models.JSONField(default=None, null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["client", "definition"],
                name="uniq_client_custom_field",
            ),
        ]
        indexes = [
            models.Index(fields=["client", "definition"]),
        ]

    def __str__(self) -> str:
        return f"{self.definition.key}={self.value}"
