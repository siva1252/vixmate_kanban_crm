"""Working-on-lead assignments (member + work note)."""

from __future__ import annotations

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.assignments.models import LeadWorking
from apps.audit.services import write_audit_log
from apps.realtime.broadcast import schedule_crm_broadcast
from common.validators import require_reason


@transaction.atomic
def assign_working(*, actor, client, team_member, work_note: str, request=None) -> LeadWorking:
    note = (work_note or "").strip()
    if not note:
        raise ValidationError({"work_note": "Enter what they are working on."})
    if LeadWorking.objects.filter(client=client, team_member=team_member, is_active=True).exists():
        raise ValidationError({"team_member": "That team member is already working on this lead."})

    row = LeadWorking.objects.create(
        client=client,
        team_member=team_member,
        work_note=note,
        assigned_by=actor,
        updated_by=actor,
        is_active=True,
    )
    write_audit_log(
        actor=actor,
        action="working_assigned",
        entity_type="LeadWorking",
        entity_id=row.id,
        client=client,
        new_values={
            "team_member_id": str(team_member.id),
            "team_member_name": team_member.display_name,
            "work_note": note,
        },
        description=f"Assigned {team_member.display_name} to work on {client.client_name}",
        request=request,
    )
    schedule_crm_broadcast(
        entity="working",
        action="assigned",
        entity_id=row.id,
        actor_id=getattr(actor, "id", None),
    )
    return row


@transaction.atomic
def update_working(*, actor, row: LeadWorking, data: dict, reason: str, request=None) -> LeadWorking:
    cleaned = require_reason(reason)
    old = {
        "team_member_id": str(row.team_member_id),
        "team_member_name": row.team_member.display_name,
        "work_note": row.work_note,
    }
    if "work_note" in data:
        note = (data["work_note"] or "").strip()
        if not note:
            raise ValidationError({"work_note": "Enter what they are working on."})
        row.work_note = note
    if "team_member" in data and data["team_member"] is not None:
        member = data["team_member"]
        if (
            LeadWorking.objects.filter(client=row.client, team_member=member, is_active=True)
            .exclude(id=row.id)
            .exists()
        ):
            raise ValidationError({"team_member": "That team member is already working on this lead."})
        row.team_member = member
    row.updated_by = actor
    row.save()
    write_audit_log(
        actor=actor,
        action="working_updated",
        entity_type="LeadWorking",
        entity_id=row.id,
        client=row.client,
        old_values=old,
        new_values={
            "team_member_id": str(row.team_member_id),
            "team_member_name": row.team_member.display_name,
            "work_note": row.work_note,
        },
        reason=cleaned,
        description=f"Updated working assignment on {row.client.client_name}",
        request=request,
    )
    schedule_crm_broadcast(
        entity="working",
        action="updated",
        entity_id=row.id,
        actor_id=getattr(actor, "id", None),
    )
    return row


@transaction.atomic
def remove_working(*, actor, row: LeadWorking, reason: str, request=None) -> LeadWorking:
    cleaned = require_reason(reason)
    old = {
        "team_member_name": row.team_member.display_name,
        "work_note": row.work_note,
    }
    row.is_active = False
    row.updated_by = actor
    row.save(update_fields=["is_active", "updated_by", "updated_at"])
    write_audit_log(
        actor=actor,
        action="working_removed",
        entity_type="LeadWorking",
        entity_id=row.id,
        client=row.client,
        old_values=old,
        new_values={"is_active": False},
        reason=cleaned,
        description=f"Removed {old['team_member_name']} from working on {row.client.client_name}",
        request=request,
    )
    schedule_crm_broadcast(
        entity="working",
        action="removed",
        entity_id=row.id,
        actor_id=getattr(actor, "id", None),
    )
    return row
