"""Dashboard aggregation queries."""

from __future__ import annotations

from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from apps.crm.models import Client
from apps.meetings.models import Meeting, MeetingStatus
from apps.tasks.models import Task, TaskStatus
from apps.audit.models import AuditLog


def get_dashboard_metrics(*, filters: dict | None = None) -> dict:
    filters = filters or {}
    clients = Client.objects.select_related("stage", "lead_source", "service")

    if filters.get("date_from"):
        clients = clients.filter(created_at__date__gte=filters["date_from"])
    if filters.get("date_to"):
        clients = clients.filter(created_at__date__lte=filters["date_to"])
    if filters.get("stage"):
        clients = clients.filter(stage=filters["stage"])
    if filters.get("source"):
        clients = clients.filter(lead_source=filters["source"])
    if filters.get("team_member"):
        clients = clients.filter(
            assignments__team_member=filters["team_member"],
            assignments__is_active=True,
        ).distinct()

    stage_counts = {
        row["stage__slug"]: row["total"]
        for row in clients.values("stage__slug").annotate(total=Count("id"))
    }

    now = timezone.now()
    upcoming_meetings = (
        Meeting.objects.filter(
            status=MeetingStatus.SCHEDULED,
            meeting_date__gte=now.date(),
        )
        .select_related("client", "coordinator")
        .order_by("meeting_date", "start_time")[:10]
    )
    pending_tasks = Task.objects.filter(status=TaskStatus.PENDING).count()
    completed_tasks = Task.objects.filter(status=TaskStatus.COMPLETED).count()
    recent_activities = (
        AuditLog.objects.select_related("actor", "client")
        .order_by("-timestamp")[:20]
    )
    recently_updated = clients.order_by("-updated_at")[:10]

    team_activity = (
        AuditLog.objects.filter(timestamp__gte=now - timedelta(days=7))
        .exclude(actor=None)
        .values("actor__full_name", "actor_id")
        .annotate(total=Count("id"))
        .order_by("-total")[:10]
    )

    return {
        "totals": {
            "leads": clients.count(),
            "new_leads": stage_counts.get("new-lead", 0),
            "call_back": stage_counts.get("call-back", 0),
            "in_progress": stage_counts.get("in-progress", 0),
            "qualified": stage_counts.get("qualified", 0),
            "meetings": stage_counts.get("meeting", 0),
            "negotiations": stage_counts.get("negotiation", 0),
            "won": stage_counts.get("won", 0),
            "lost": stage_counts.get("loss", 0),
            "pending_tasks": pending_tasks,
            "completed_tasks": completed_tasks,
        },
        "stage_counts": stage_counts,
        "upcoming_meetings": [
            {
                "id": str(m.id),
                "title": m.title,
                "client": m.client.client_name,
                "date": str(m.meeting_date),
                "start_time": str(m.start_time),
                "coordinator": m.coordinator.display_name,
            }
            for m in upcoming_meetings
        ],
        "recently_updated_clients": [
            {
                "id": str(c.id),
                "client_name": c.client_name,
                "stage": c.stage.name,
                "updated_at": c.updated_at.isoformat(),
            }
            for c in recently_updated
        ],
        "recent_activities": [
            {
                "id": str(a.id),
                "actor": a.actor.full_name if a.actor else None,
                "action": a.action,
                "entity_type": a.entity_type,
                "client": a.client.client_name if a.client else None,
                "timestamp": a.timestamp.isoformat(),
                "reason": a.reason,
            }
            for a in recent_activities
        ],
        "team_activity_summary": list(team_activity),
    }
