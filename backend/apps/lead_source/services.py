"""Lead Source person + multi-member lead attribution."""

from __future__ import annotations

from django.db import transaction
from django.db.models import Count, Q, Sum
from rest_framework.exceptions import ValidationError

from apps.audit.services import write_audit_log
from apps.crm.models import Client
from apps.lead_source.models import LeadSourceAttribution, LeadSourcePerson


@transaction.atomic
def create_person(*, actor, data: dict, request=None) -> LeadSourcePerson:
    name = (data.get("display_name") or "").strip()
    if not name:
        raise ValidationError({"display_name": "Name is required."})
    person = LeadSourcePerson.objects.create(
        display_name=name,
        phone=(data.get("phone") or "").strip(),
        email=(data.get("email") or "").strip().lower(),
        role_label=(data.get("role_label") or "").strip(),
        notes=(data.get("notes") or "").strip(),
        is_active=bool(data.get("is_active", True)),
        created_by=actor,
    )
    write_audit_log(
        actor=actor,
        action="lead_source_person_created",
        entity_type="LeadSourcePerson",
        entity_id=person.id,
        description=f"Created Lead Source person {person.display_name}",
        new_values={
            "display_name": person.display_name,
            "phone": person.phone,
            "email": person.email,
            "role_label": person.role_label,
            "is_active": person.is_active,
        },
        request=request,
    )
    return person


@transaction.atomic
def update_person(*, actor, person: LeadSourcePerson, data: dict, request=None) -> LeadSourcePerson:
    old = {
        "display_name": person.display_name,
        "phone": person.phone,
        "email": person.email,
        "role_label": person.role_label,
        "is_active": person.is_active,
    }
    for field in ("display_name", "phone", "email", "role_label", "notes", "is_active"):
        if field in data and data[field] is not None:
            value = data[field]
            if field in {"display_name", "phone", "role_label", "notes"} and isinstance(value, str):
                value = value.strip()
            if field == "email" and isinstance(value, str):
                value = value.strip().lower()
            setattr(person, field, value)
    if not person.display_name:
        raise ValidationError({"display_name": "Name is required."})
    became_inactive = old["is_active"] and not person.is_active
    became_active = (not old["is_active"]) and person.is_active
    reason = (data.get("reason") or "").strip()
    if became_inactive and len(reason) < 3:
        raise ValidationError({"reason": "Reason is required to deactivate (min 3 characters)."})
    person.save()

    unassigned_count = 0
    if became_inactive and bool(data.get("unassign_leads")):
        active_rows = list(
            LeadSourceAttribution.objects.filter(person=person, is_active=True).select_related(
                "client"
            )
        )
        for row in active_rows:
            row.is_active = False
            row.save(update_fields=["is_active", "updated_at"])
            write_audit_log(
                actor=actor,
                action="lead_source_unassigned",
                entity_type="LeadSourceLink",
                entity_id=row.id,
                client=row.client,
                description=(
                    f"Unassigned {person.display_name} from {row.client.client_name} "
                    f"(person deactivated)"
                ),
                reason=reason or "Person deactivated — remove leads",
                old_values={"person": person.display_name, "client": row.client.client_name},
                new_values={"is_active": False},
                request=request,
            )
            unassigned_count += 1

    if became_inactive:
        action = "lead_source_person_deactivated"
        description = f"Deactivated Lead Source person {person.display_name}"
        if unassigned_count:
            description += f" — removed from {unassigned_count} lead(s)"
    elif became_active:
        action = "lead_source_person_activated"
        description = f"Activated Lead Source person {person.display_name}"
    else:
        action = "lead_source_person_updated"
        description = f"Updated Lead Source person {person.display_name}"
    write_audit_log(
        actor=actor,
        action=action,
        entity_type="LeadSourcePerson",
        entity_id=person.id,
        description=description,
        old_values=old,
        new_values={
            "display_name": person.display_name,
            "phone": person.phone,
            "email": person.email,
            "role_label": person.role_label,
            "is_active": person.is_active,
            "leads_unassigned": unassigned_count if became_inactive else None,
        },
        reason=reason,
        request=request,
    )
    return person


def person_stats(person: LeadSourcePerson) -> dict:
    client_ids = LeadSourceAttribution.objects.filter(
        person=person, is_active=True, client__is_deleted=False
    ).values_list("client_id", flat=True)
    qs = Client.objects.filter(id__in=client_ids)
    aggregates = qs.aggregate(
        total_leads=Count("id"),
        won=Count("id", filter=Q(stage__slug="won")),
        lost=Count("id", filter=Q(stage__slug="loss")),
        estimated_value_won=Sum("estimated_deal_value", filter=Q(stage__slug="won")),
    )
    total = aggregates["total_leads"] or 0
    won = aggregates["won"] or 0
    lost = aggregates["lost"] or 0
    by_stage = list(
        qs.values("stage__id", "stage__name", "stage__slug")
        .annotate(count=Count("id"))
        .order_by("stage__display_order")
    )
    return {
        "total_leads": total,
        "open_leads": max(total - won - lost, 0),
        "won": won,
        "lost": lost,
        "estimated_value_won": (
            str(aggregates["estimated_value_won"])
            if aggregates["estimated_value_won"] is not None
            else None
        ),
        "by_stage": [
            {
                "stage_id": str(row["stage__id"]),
                "stage_name": row["stage__name"],
                "stage_slug": row["stage__slug"],
                "count": row["count"],
            }
            for row in by_stage
        ],
    }


@transaction.atomic
def assign_lead_to_person(
    *,
    actor,
    person: LeadSourcePerson,
    client: Client,
    note: str = "",
    request=None,
) -> LeadSourceAttribution:
    if not person.is_active:
        raise ValidationError({"person": "Lead Source person is inactive."})
    existing = LeadSourceAttribution.objects.filter(
        client=client, person=person, is_active=True
    ).first()
    if existing:
        if note and note != existing.note:
            existing.note = note.strip()
            existing.save(update_fields=["note", "updated_at"])
        return existing

    row = LeadSourceAttribution.objects.create(
        client=client,
        person=person,
        note=(note or "").strip(),
        assigned_by=actor,
        is_active=True,
    )
    write_audit_log(
        actor=actor,
        action="lead_source_assigned",
        entity_type="LeadSourceAttribution",
        entity_id=row.id,
        client=client,
        description=f"Linked {person.display_name} to {client.client_name}",
        new_values={
            "person": str(person.id),
            "personName": person.display_name,
            "client": str(client.id),
            "clientName": client.client_name,
            "note": row.note,
        },
        request=request,
    )
    return row


@transaction.atomic
def assign_people_to_lead(
    *,
    actor,
    client: Client,
    people: list[LeadSourcePerson],
    note: str = "",
    request=None,
) -> list[LeadSourceAttribution]:
    if not people:
        raise ValidationError({"people": "Select at least one Lead Source person."})
    rows = []
    for person in people:
        rows.append(
            assign_lead_to_person(
                actor=actor,
                person=person,
                client=client,
                note=note,
                request=request,
            )
        )
    return rows


@transaction.atomic
def remove_attribution(
    *,
    actor,
    row: LeadSourceAttribution,
    reason: str = "",
    request=None,
) -> None:
    cleaned_reason = (reason or "").strip()
    if len(cleaned_reason) < 3:
        raise ValidationError({"reason": "Reason is required to unlink (min 3 characters)."})
    if not row.is_active:
        return
    row.is_active = False
    row.save(update_fields=["is_active", "updated_at"])
    write_audit_log(
        actor=actor,
        action="lead_source_unassigned",
        entity_type="LeadSourceAttribution",
        entity_id=row.id,
        client=row.client,
        description=f"Unlinked {row.person.display_name} from {row.client.client_name}",
        old_values={
            "person": str(row.person_id),
            "personName": row.person.display_name,
            "client": str(row.client_id),
            "clientName": row.client.client_name,
        },
        reason=cleaned_reason,
        request=request,
    )
