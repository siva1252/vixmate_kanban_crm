"""Configurable lead sources, services, industries, and system settings."""

from __future__ import annotations

import uuid

from django.db import models

from common.models import TimeStampedModel


class ConfigurableItem(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=128)
    slug = models.SlugField(max_length=128)
    is_active = models.BooleanField(default=True, db_index=True)
    display_order = models.PositiveIntegerField(default=0)
    allows_other_text = models.BooleanField(default=False)

    class Meta:
        abstract = True
        ordering = ["display_order", "name"]

    def __str__(self) -> str:
        return self.name


class LeadSource(ConfigurableItem):
    class Meta(ConfigurableItem.Meta):
        verbose_name = "Lead source"
        verbose_name_plural = "Lead sources"
        constraints = [
            models.UniqueConstraint(fields=["slug"], name="uniq_lead_source_slug"),
            models.UniqueConstraint(fields=["name"], name="uniq_lead_source_name"),
        ]


class Service(ConfigurableItem):
    class Meta(ConfigurableItem.Meta):
        verbose_name = "Service"
        verbose_name_plural = "Services"
        constraints = [
            models.UniqueConstraint(fields=["slug"], name="uniq_service_slug"),
            models.UniqueConstraint(fields=["name"], name="uniq_service_name"),
        ]


class Industry(ConfigurableItem):
    class Meta(ConfigurableItem.Meta):
        verbose_name = "Industry"
        verbose_name_plural = "Industries"
        constraints = [
            models.UniqueConstraint(fields=["slug"], name="uniq_industry_slug"),
            models.UniqueConstraint(fields=["name"], name="uniq_industry_name"),
        ]


class SystemSetting(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    key = models.SlugField(max_length=128, unique=True)
    value = models.JSONField(default=dict, blank=True)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["key"]

    def __str__(self) -> str:
        return self.key
