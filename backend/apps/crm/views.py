from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.views import APIView

from apps.assignments.models import LeadAssignment
from apps.crm import serializers as ser
from apps.crm.models import Client, LeadStage, LeadStageHistory
from apps.crm.services import clients as client_services
from apps.crm.services.dashboard import get_dashboard_metrics
from common.permissions import IsActiveCRMMember
from common.responses import success_response


class ClientListCreateView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request):
        qs = Client.objects.select_related(
            "stage", "lead_source", "service", "industry"
        ).prefetch_related(
            Prefetch(
                "assignments",
                queryset=LeadAssignment.objects.filter(is_active=True).select_related(
                    "team_member", "responsibility_type"
                ),
                to_attr="prefetched_assignments",
            )
        )

        search = request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(client_name__icontains=search)
                | Q(primary_phone__icontains=search)
                | Q(alternate_phone__icontains=search)
                | Q(primary_email__icontains=search)
                | Q(alternate_email__icontains=search)
                | Q(company_name__icontains=search)
                | Q(contacts__name__icontains=search)
                | Q(contacts__primary_phone__icontains=search)
                | Q(contacts__primary_email__icontains=search)
            ).distinct()

        if stage := request.query_params.get("stage"):
            qs = qs.filter(stage_id=stage)
        if source := request.query_params.get("source"):
            qs = qs.filter(lead_source_id=source)
        if service := request.query_params.get("service"):
            qs = qs.filter(service_id=service)
        if member := request.query_params.get("team_member"):
            qs = qs.filter(
                assignments__team_member_id=member,
                assignments__is_active=True,
            ).distinct()
        if request.query_params.get("first_call_completed") in {"true", "false"}:
            qs = qs.filter(
                first_call_completed=request.query_params.get("first_call_completed") == "true"
            )
        if date_from := request.query_params.get("date_from"):
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to := request.query_params.get("date_to"):
            qs = qs.filter(created_at__date__lte=date_to)

        page = self.paginate(request, qs)
        return success_response(ser.ClientListSerializer(page, many=True).data)

    def post(self, request):
        serializer = ser.ClientCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        client = client_services.create_client(
            actor=request.user,
            data=serializer.validated_data,
            request=request,
        )
        return success_response(
            ser.ClientDetailSerializer(client).data,
            message="Client created",
            status_code=status.HTTP_201_CREATED,
        )

    def paginate(self, request, qs):
        from common.pagination import StandardResultsSetPagination

        paginator = StandardResultsSetPagination()
        return paginator.paginate_queryset(qs, request) or qs


class ClientDetailView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get_object(self, client_id):
        return get_object_or_404(
            Client.objects.select_related(
                "stage", "lead_source", "service", "industry"
            ),
            id=client_id,
        )

    def get(self, request, client_id):
        client = self.get_object(client_id)
        return success_response(ser.ClientDetailSerializer(client).data)

    def patch(self, request, client_id):
        client = self.get_object(client_id)
        serializer = ser.ClientUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        reason = data.pop("reason", "")
        client = client_services.update_client(
            actor=request.user,
            client=client,
            data=data,
            reason=reason,
            request=request,
        )
        return success_response(ser.ClientDetailSerializer(client).data, message="Client updated")

    def delete(self, request, client_id):
        client = self.get_object(client_id)
        serializer = ser.ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        client_services.soft_delete_client(
            actor=request.user,
            client=client,
            reason=serializer.validated_data["reason"],
            request=request,
        )
        return success_response(message="Client deleted")


class ClientRestoreView(APIView):
    permission_classes = [IsActiveCRMMember]

    def post(self, request, client_id):
        client = get_object_or_404(Client.all_objects, id=client_id, is_deleted=True)
        client = client_services.restore_client(
            actor=request.user, client=client, request=request
        )
        return success_response(ser.ClientDetailSerializer(client).data, message="Client restored")


class ClientFirstCallView(APIView):
    permission_classes = [IsActiveCRMMember]

    def post(self, request, client_id):
        client = get_object_or_404(Client, id=client_id)
        serializer = ser.FirstCallCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        client = client_services.mark_first_call_complete(
            actor=request.user,
            client=client,
            data=serializer.validated_data,
            request=request,
        )
        return success_response(
            ser.ClientDetailSerializer(client).data,
            message="First call marked complete",
        )


class ClientStageMoveView(APIView):
    permission_classes = [IsActiveCRMMember]

    def post(self, request, client_id):
        client = get_object_or_404(Client, id=client_id)
        serializer = ser.StageMoveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        client = client_services.move_client_stage(
            actor=request.user,
            client=client,
            new_stage=serializer.validated_data["stage"],
            request=request,
        )
        return success_response(ser.ClientDetailSerializer(client).data, message="Stage updated")


class ClientStageHistoryView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request, client_id):
        history = LeadStageHistory.objects.filter(client_id=client_id).select_related(
            "previous_stage", "new_stage", "changed_by"
        )
        return success_response(ser.LeadStageHistorySerializer(history, many=True).data)


class KanbanBoardView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request):
        stages = LeadStage.objects.filter(is_active=True).order_by("display_order")
        clients = Client.objects.select_related(
            "stage", "lead_source", "service"
        ).prefetch_related(
            Prefetch(
                "assignments",
                queryset=LeadAssignment.objects.filter(is_active=True).select_related(
                    "team_member", "responsibility_type"
                ),
                to_attr="prefetched_assignments",
            )
        )

        search = request.query_params.get("search")
        if search:
            clients = clients.filter(
                Q(client_name__icontains=search)
                | Q(primary_phone__icontains=search)
                | Q(primary_email__icontains=search)
            )
        if member := request.query_params.get("team_member"):
            clients = clients.filter(
                assignments__team_member_id=member, assignments__is_active=True
            ).distinct()
        if source := request.query_params.get("source"):
            clients = clients.filter(lead_source_id=source)
        if service := request.query_params.get("service"):
            clients = clients.filter(service_id=service)
        if date_from := request.query_params.get("date_from"):
            clients = clients.filter(created_at__date__gte=date_from)
        if date_to := request.query_params.get("date_to"):
            clients = clients.filter(created_at__date__lte=date_to)
        if stage := request.query_params.get("stage"):
            clients = clients.filter(stage_id=stage)

        by_stage = {str(s.id): [] for s in stages}
        for client in clients:
            by_stage.setdefault(str(client.stage_id), []).append(
                ser.ClientListSerializer(client).data
            )

        board = [
            {
                "stage": ser.LeadStageSerializer(stage).data,
                "cards": by_stage.get(str(stage.id), []),
            }
            for stage in stages
        ]
        return success_response(board)


class LeadStageListView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request):
        stages = LeadStage.objects.filter(is_active=True).order_by("display_order")
        return success_response(ser.LeadStageSerializer(stages, many=True).data)


class DashboardView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request):
        serializer = ser.DashboardFilterSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        data = get_dashboard_metrics(filters=serializer.validated_data)
        return success_response(data)
