"""Kanban column / LeadStage business operations."""

from __future__ import annotations

from django.db import transaction
from django.db.models import F, Max
from django.utils.text import slugify
from rest_framework.exceptions import ValidationError

from apps.audit.services import write_audit_log
from apps.crm.models import Client, LeadStage
from common.validators import require_reason


def _unique_slug(name: str, *, exclude_id=None) -> str:
    base = slugify(name) or "column"
    slug = base
    n = 2
    while LeadStage.objects.filter(slug=slug).exclude(id=exclude_id).exists():
        slug = f"{base}-{n}"
        n += 1
    return slug


@transaction.atomic
def create_stage(*, actor, name: str, color: str = "#3b82f6", is_terminal: bool = False, request=None) -> LeadStage:
    trimmed = (name or "").strip()
    if not trimmed:
        raise ValidationError({"name": "Column name is required."})
    if LeadStage.objects.filter(name__iexact=trimmed).exists():
        raise ValidationError({"name": "A column with this name already exists."})

    max_order = LeadStage.objects.aggregate(m=Max("display_order"))["m"] or 0
    stage = LeadStage.objects.create(
        name=trimmed,
        slug=_unique_slug(trimmed),
        display_order=max_order + 1,
        is_terminal=is_terminal,
        color=color or "#3b82f6",
        is_active=True,
    )
    write_audit_log(
        actor=actor,
        action="column_created",
        entity_type="LeadStage",
        entity_id=stage.id,
        new_values={"name": stage.name, "color": stage.color, "display_order": stage.display_order},
        description=f"Added board column {stage.name}",
        request=request,
    )
    return stage


@transaction.atomic
def update_stage(*, actor, stage: LeadStage, data: dict, request=None) -> LeadStage:
    old = {"name": stage.name, "color": stage.color, "is_terminal": stage.is_terminal, "is_active": stage.is_active}
    if "name" in data and data["name"] is not None:
        trimmed = data["name"].strip()
        if not trimmed:
            raise ValidationError({"name": "Column name is required."})
        if LeadStage.objects.filter(name__iexact=trimmed).exclude(id=stage.id).exists():
            raise ValidationError({"name": "A column with this name already exists."})
        stage.name = trimmed
        stage.slug = _unique_slug(trimmed, exclude_id=stage.id)
    if "color" in data and data["color"] is not None:
        stage.color = data["color"]
    if "is_terminal" in data and data["is_terminal"] is not None:
        stage.is_terminal = data["is_terminal"]
    if "is_active" in data and data["is_active"] is not None:
        stage.is_active = data["is_active"]
    stage.save()
    write_audit_log(
        actor=actor,
        action="column_updated",
        entity_type="LeadStage",
        entity_id=stage.id,
        old_values=old,
        new_values={"name": stage.name, "color": stage.color, "is_terminal": stage.is_terminal, "is_active": stage.is_active},
        description=f"Updated board column {stage.name}",
        request=request,
    )
    return stage


@transaction.atomic
def reorder_stages(*, actor, ordered_ids: list, request=None) -> list[LeadStage]:
    stages = list(LeadStage.objects.filter(id__in=ordered_ids))
    by_id = {str(s.id): s for s in stages}
    if len(by_id) != len(ordered_ids):
        raise ValidationError({"ordered_ids": "One or more column ids are invalid."})

    # Temporary offset to avoid unique display_order collisions
    LeadStage.objects.filter(id__in=ordered_ids).update(display_order=F("display_order") + 10000)
    for index, stage_id in enumerate(ordered_ids, start=1):
        stage = by_id[str(stage_id)]
        stage.display_order = index
        stage.save(update_fields=["display_order", "updated_at"])

    ordered = list(LeadStage.objects.filter(is_active=True).order_by("display_order"))
    write_audit_log(
        actor=actor,
        action="column_reordered",
        entity_type="LeadStage",
        entity_id="board",
        new_values={"order": [s.name for s in ordered]},
        description="Reordered board columns",
        request=request,
    )
    return ordered


@transaction.atomic
def delete_stage(*, actor, stage: LeadStage, reason: str, request=None) -> dict:
    cleaned = require_reason(reason)
    active_count = LeadStage.objects.filter(is_active=True).count()
    if active_count <= 1:
        raise ValidationError({"detail": "At least one active column is required."})

    fallback = (
        LeadStage.objects.filter(is_active=True)
        .exclude(id=stage.id)
        .order_by("display_order")
        .first()
    )
    if fallback is None:
        raise ValidationError({"detail": "No fallback column available."})

    moved = Client.objects.filter(stage=stage).update(stage=fallback)
    old = {"name": stage.name, "color": stage.color, "display_order": stage.display_order}
    stage.is_active = False
    stage.save(update_fields=["is_active", "updated_at"])

    # Compact display_order among active stages
    for index, row in enumerate(LeadStage.objects.filter(is_active=True).order_by("display_order"), start=1):
        if row.display_order != index:
            row.display_order = index + 10000
            row.save(update_fields=["display_order"])
    for index, row in enumerate(LeadStage.objects.filter(is_active=True).order_by("display_order"), start=1):
        row.display_order = index
        row.save(update_fields=["display_order", "updated_at"])

    write_audit_log(
        actor=actor,
        action="column_deleted",
        entity_type="LeadStage",
        entity_id=stage.id,
        old_values=old,
        new_values={"moved_leads": moved, "fallback_column": fallback.name},
        reason=cleaned,
        description=f"Deleted board column {old['name']}",
        request=request,
    )
    return {"removed": old, "moved": moved, "fallback": {"id": str(fallback.id), "name": fallback.name}}
