from django.db.models import Q
from rest_framework.views import APIView

from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer
from common.pagination import StandardResultsSetPagination
from common.permissions import IsActiveCRMMember
from common.responses import success_response


class ActivityLogListView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request):
        qs = AuditLog.objects.select_related("actor", "client").all()
        if actor := request.query_params.get("team_member"):
            qs = qs.filter(actor_id=actor)
        if client := request.query_params.get("client"):
            qs = qs.filter(client_id=client)
        if action := request.query_params.get("action"):
            qs = qs.filter(action=action)
        if date_from := request.query_params.get("date_from"):
            qs = qs.filter(timestamp__date__gte=date_from)
        if date_to := request.query_params.get("date_to"):
            qs = qs.filter(timestamp__date__lte=date_to)
        if stage := request.query_params.get("stage"):
            qs = qs.filter(
                Q(new_values__stage=stage) | Q(client__stage_id=stage)
            )
        if task_status := request.query_params.get("task_status"):
            qs = qs.filter(entity_type="Task", new_values__status=task_status)
        if meeting_status := request.query_params.get("meeting_status"):
            qs = qs.filter(entity_type="Meeting", new_values__status=meeting_status)

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(qs, request)
        return success_response(AuditLogSerializer(page or qs, many=True).data)
