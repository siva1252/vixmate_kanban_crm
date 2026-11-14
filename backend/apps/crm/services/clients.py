"""Client / lead business operations."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.services import write_audit_log
from apps.calls.models import CallHistory, CallOutcome
from apps.crm.models import Client, LeadStage, LeadStageHistory
from apps.realtime.broadcast import schedule_crm_broadcast
from common.validators import require_reason


def _validate_other_fields(*, source, source_other, service, service_other) -> None:
    if source.allows_other_text and not (source_other or "").strip():
        raise ValidationError({"lead_source_other": "Please specify the lead source."})
    if service.allows_other_text and not (service_other or "").strip():
        raise ValidationError({"service_other": "Please specify the service."})


def _default_new_lead_stage() -> LeadStage:
    stage = LeadStage.objects.filter(slug="new-lead", is_active=True).first()
    if stage is None:
        raise ValidationError({"stage": "Default 'New Lead' stage is not configured."})
    return stage


def _snapshot(client: Client, *, compact: bool = False) -> dict:
    """Audit snapshot. compact=True keeps only meaningful filled fields (for create logs)."""
    raw = {
        "client_name": client.client_name,
        "primary_phone": client.primary_phone,
        "alternate_phone": client.alternate_phone,
        "primary_email": client.primary_email,
        "alternate_email": client.alternate_email,
        "stage": client.stage.slug if client.stage_id else None,
        "lead_source": client.lead_source.slug if client.lead_source_id else None,
        "service": client.service.slug if client.service_id else None,
        "first_call_completed": client.first_call_completed,
        "estimated_deal_value": str(client.estimated_deal_value)
        if client.estimated_deal_value is not None
        else None,
        "project_deadline": str(client.project_deadline) if client.project_deadline else None,
        "agreed_project_scope": client.agreed_project_scope,
    }
    if not compact:
        return raw
    # Create / summary: drop blanks and default false first_call
    out = {}
    for key, value in raw.items():
        if value is None or value == "":
            continue
        if key == "first_call_completed" and value is False:
            continue
        out[key] = value
    return out


@transaction.atomic
def create_client(*, actor, data: dict, request=None) -> Client:
    source = data["lead_source"]
    service = data["service"]
    source_other = data.get("lead_source_other", "")
    service_other = data.get("service_other", "")
    _validate_other_fields(
        source=source,
        source_other=source_other,
        service=service,
        service_other=service_other,
    )

    first_call_completed = bool(data.get("first_call_completed", False))
    stage = data.get("stage") or _default_new_lead_stage()

    client = Client(
        client_name=data["client_name"],
        primary_phone=data["primary_phone"],
        alternate_phone=data.get("alternate_phone", ""),
        primary_email=data.get("primary_email", ""),
        alternate_email=data.get("alternate_email", ""),
        lead_source=source,
        lead_source_other=source_other,
        service=service,
        service_other=service_other,
        stage=stage,
        first_call_completed=first_call_completed,
        created_by=actor,
    )

    if first_call_completed:
        for field in (
            "decision_maker_phone",
            "decision_maker_alternate_phone",
            "decision_maker_email",
            "decision_maker_alternate_email",
            "client_requirements",
            "call_discussion_notes",
            "first_call_notes",
            "company_name",
            "website",
            "company_address",
            "agreed_project_scope",
        ):
            if field in data and data[field] is not None:
                setattr(client, field, data[field])
        if data.get("industry") is not None:
            client.industry = data["industry"]
        if data.get("estimated_deal_value") is not None:
            client.estimated_deal_value = data["estimated_deal_value"]
        if data.get("next_follow_up_date") is not None:
            client.next_follow_up_date = data["next_follow_up_date"]
        if data.get("project_deadline") is not None:
            client.project_deadline = data["project_deadline"]
        client.first_call_completed_at = timezone.now()
        client.first_call_completed_by = actor

    client.save()

    LeadStageHistory.objects.create(
        client=client,
        previous_stage=None,
        new_stage=stage,
        changed_by=actor,
    )

    if first_call_completed:
        CallHistory.objects.create(
            client=client,
            call_datetime=timezone.now(),
            called_by=actor,
            outcome=CallOutcome.CONNECTED,
            discussion_notes=data.get("call_discussion_notes", "")
            or data.get("first_call_notes", ""),
            is_first_call=True,
            follow_up_date=data.get("next_follow_up_date"),
        )

    write_audit_log(
        actor=actor,
        action="client_created",
        entity_type="Client",
        entity_id=client.id,
        client=client,
        new_values=_snapshot(client, compact=True),
        description=f"Created lead {client.client_name}",
        request=request,
    )
    schedule_crm_broadcast(
        entity="client",
        action="created",
        entity_id=client.id,
        actor_id=getattr(actor, "id", None),
    )
    return client


@transaction.atomic
def update_client(*, actor, client: Client, data: dict, reason: str = "", request=None) -> Client:
    old = _snapshot(client)
    # Every lead detail edit requires a reason (matches frontend Edit → reason → Save flow).
    cleaned_reason = require_reason(reason or data.get("reason"))

    source = data.get("lead_source", client.lead_source)
    service = data.get("service", client.service)
    source_other = data.get("lead_source_other", client.lead_source_other)
    service_other = data.get("service_other", client.service_other)
    _validate_other_fields(
        source=source,
        source_other=source_other,
        service=service,
        service_other=service_other,
    )

    updatable = [
        "client_name",
        "primary_phone",
        "alternate_phone",
        "primary_email",
        "alternate_email",
        "lead_source_other",
        "service_other",
        "decision_maker_phone",
        "decision_maker_alternate_phone",
        "decision_maker_email",
        "decision_maker_alternate_email",
        "client_requirements",
        "call_discussion_notes",
        "first_call_notes",
        "company_name",
        "website",
        "company_address",
        "agreed_project_scope",
        "estimated_deal_value",
        "next_follow_up_date",
        "project_deadline",
    ]
    for field in updatable:
        if field in data:
            setattr(client, field, data[field])
    if "lead_source" in data:
        client.lead_source = source
    if "service" in data:
        client.service = service
    if "industry" in data:
        client.industry = data["industry"]

    client.save()
    write_audit_log(
        actor=actor,
        action="client_updated",
        entity_type="Client",
        entity_id=client.id,
        client=client,
        old_values=old,
        new_values=_snapshot(client),
        reason=cleaned_reason,
        description=f"Updated client {client.client_name}",
        request=request,
    )
    schedule_crm_broadcast(
        entity="client",
        action="updated",
        entity_id=client.id,
        actor_id=getattr(actor, "id", None),
    )
    return client


@transaction.atomic
def mark_first_call_complete(*, actor, client: Client, data: dict, request=None) -> Client:
    if client.first_call_completed:
        raise ValidationError({"first_call_completed": "First call is already completed."})

    old = _snapshot(client)
    client.first_call_completed = True
    client.first_call_completed_at = timezone.now()
    client.first_call_completed_by = actor
    for field in (
        "decision_maker_phone",
        "decision_maker_alternate_phone",
        "decision_maker_email",
        "decision_maker_alternate_email",
        "client_requirements",
        "call_discussion_notes",
        "first_call_notes",
        "company_name",
        "estimated_deal_value",
        "next_follow_up_date",
    ):
        if field in data and data[field] is not None:
            setattr(client, field, data[field])
    if data.get("industry") is not None:
        client.industry = data["industry"]
    client.save()

    CallHistory.objects.create(
        client=client,
        call_datetime=timezone.now(),
        called_by=actor,
        outcome=data.get("outcome") or CallOutcome.CONNECTED,
        discussion_notes=data.get("call_discussion_notes", "")
        or data.get("first_call_notes", ""),
        next_action=data.get("next_action", ""),
        follow_up_date=data.get("next_follow_up_date"),
        is_first_call=True,
    )

    write_audit_log(
        actor=actor,
        action="first_call_completed",
        entity_type="Client",
        entity_id=client.id,
        client=client,
        old_values=old,
        new_values=_snapshot(client),
        description=f"First call completed for {client.client_name}",
        request=request,
    )
    schedule_crm_broadcast(
        entity="client",
        action="updated",
        entity_id=client.id,
        actor_id=getattr(actor, "id", None),
    )
    return client


@transaction.atomic
def move_client_stage(*, actor, client: Client, new_stage: LeadStage, request=None) -> Client:
    if client.stage_id == new_stage.id:
        return client
    previous = client.stage
    client.stage = new_stage
    client.save(update_fields=["stage", "updated_at"])
    LeadStageHistory.objects.create(
        client=client,
        previous_stage=previous,
        new_stage=new_stage,
        changed_by=actor,
    )
    write_audit_log(
        actor=actor,
        action="stage_changed",
        entity_type="Client",
        entity_id=client.id,
        client=client,
        old_values={"stage": previous.slug if previous else None},
        new_values={"stage": new_stage.slug},
        description=f"Stage changed {previous} -> {new_stage}",
        request=request,
    )
    schedule_crm_broadcast(
        entity="client",
        action="stage_changed",
        entity_id=client.id,
        actor_id=getattr(actor, "id", None),
    )
    return client


@transaction.atomic
def soft_delete_client(*, actor, client: Client, reason: str, request=None) -> Client:
    cleaned = require_reason(reason)
    client_name = client.client_name
    client.soft_delete(actor=actor, reason=cleaned)
    # Keep audit compact — only what the user did, not a full field dump.
    write_audit_log(
        actor=actor,
        action="client_deleted",
        entity_type="Client",
        entity_id=client.id,
        client=client,
        old_values={"client_name": client_name},
        new_values={"status": "deleted"},
        reason=cleaned,
        description=f"Deleted lead {client_name}",
        request=request,
    )
    schedule_crm_broadcast(
        entity="client",
        action="deleted",
        entity_id=client.id,
        actor_id=getattr(actor, "id", None),
    )
    return client


@transaction.atomic
def restore_client(*, actor, client: Client, request=None) -> Client:
    # client may come from all_objects
    client.restore()
    write_audit_log(
        actor=actor,
        action="client_restored",
        entity_type="Client",
        entity_id=client.id,
        client=client,
        new_values={"is_deleted": False},
        description=f"Restored client {client.client_name}",
        request=request,
    )
    schedule_crm_broadcast(
        entity="client",
        action="restored",
        entity_id=client.id,
        actor_id=getattr(actor, "id", None),
    )
    return client
