from __future__ import annotations

from django.db import transaction

from apps.assignments.models import AssignmentHistory, LeadAssignment, ResponsibilityType
from apps.audit.services import write_audit_log
from apps.team.models import TeamMember
from common.validators import require_reason


@transaction.atomic
def assign_member(
    *,
    actor,
    client,
    responsibility_type: ResponsibilityType,
    team_member: TeamMember,
    reason: str = "",
    request=None,
) -> LeadAssignment:
    existing = LeadAssignment.objects.filter(
        client=client,
        responsibility_type=responsibility_type,
        team_member=team_member,
    ).first()
    if existing and existing.is_active:
        return existing

    # Reassignment if replacing a single previous active member for non-multi? Always allow multi.
    previous_active = LeadAssignment.objects.filter(
        client=client,
        responsibility_type=responsibility_type,
        is_active=True,
    ).exclude(team_member=team_member)

    # If this is adding/changing relative to existing assignees, reason required when any prior assignee differs
    if previous_active.exists() or (
        existing and not existing.is_active
    ):
        # Mandatory reason when reassignment (changing membership set)
        cleaned = require_reason(reason)
    else:
        cleaned = (reason or "").strip()

    if existing:
        existing.is_active = True
        existing.assigned_by = actor
        existing.save(update_fields=["is_active", "assigned_by", "updated_at"])
        assignment = existing
        previous_member = None
    else:
        previous_member = previous_active.first().team_member if previous_active.count() == 1 else None
        assignment = LeadAssignment.objects.create(
            client=client,
            responsibility_type=responsibility_type,
            team_member=team_member,
            assigned_by=actor,
            is_active=True,
        )

    if cleaned:
        AssignmentHistory.objects.create(
            client=client,
            responsibility_type=responsibility_type,
            previous_member=previous_member,
            new_member=team_member,
            assigned_by=actor,
            reason=cleaned or "Initial assignment",
        )

    write_audit_log(
        actor=actor,
        action="assignment_created",
        entity_type="LeadAssignment",
        entity_id=assignment.id,
        client=client,
        new_values={
            "responsibility": responsibility_type.slug,
            "team_member": str(team_member.id),
        },
        reason=cleaned,
        description=f"Assigned {team_member.display_name} to {responsibility_type.name}",
        request=request,
    )
    return assignment


@transaction.atomic
def reassign_member(
    *,
    actor,
    client,
    responsibility_type: ResponsibilityType,
    previous_member: TeamMember,
    new_member: TeamMember,
    reason: str,
    request=None,
) -> LeadAssignment:
    cleaned = require_reason(reason)
    old = LeadAssignment.objects.filter(
        client=client,
        responsibility_type=responsibility_type,
        team_member=previous_member,
        is_active=True,
    ).first()
    if old:
        old.is_active = False
        old.save(update_fields=["is_active", "updated_at"])

    assignment, _ = LeadAssignment.objects.update_or_create(
        client=client,
        responsibility_type=responsibility_type,
        team_member=new_member,
        defaults={"is_active": True, "assigned_by": actor},
    )
    AssignmentHistory.objects.create(
        client=client,
        responsibility_type=responsibility_type,
        previous_member=previous_member,
        new_member=new_member,
        assigned_by=actor,
        reason=cleaned,
    )
    write_audit_log(
        actor=actor,
        action="assignment_reassigned",
        entity_type="LeadAssignment",
        entity_id=assignment.id,
        client=client,
        old_values={"team_member": str(previous_member.id)},
        new_values={"team_member": str(new_member.id)},
        reason=cleaned,
        description=(
            f"{responsibility_type.name} reassigned from {previous_member.display_name} "
            f"to {new_member.display_name}"
        ),
        request=request,
    )
    return assignment
