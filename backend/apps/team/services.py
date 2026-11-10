from __future__ import annotations

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.audit.services import write_audit_log
from apps.team.models import AvailabilityHistory, AvailabilityStatus, TeamMember


@transaction.atomic
def update_availability(*, actor, team_member: TeamMember, new_status: str, notes: str = "", request=None) -> TeamMember:
    if new_status not in AvailabilityStatus.values:
        raise ValidationError({"availability_status": "Invalid status."})
    previous = team_member.availability_status
    if previous == new_status:
        return team_member
    team_member.availability_status = new_status
    team_member.save(update_fields=["availability_status", "updated_at"])
    AvailabilityHistory.objects.create(
        team_member=team_member,
        previous_status=previous,
        new_status=new_status,
        changed_by=actor,
        notes=notes or "",
    )
    write_audit_log(
        actor=actor,
        action="availability_changed",
        entity_type="TeamMember",
        entity_id=team_member.id,
        old_values={"availability_status": previous},
        new_values={"availability_status": new_status},
        description=f"Availability changed for {team_member.display_name}",
        request=request,
    )
    return team_member
