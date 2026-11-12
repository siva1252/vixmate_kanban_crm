from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.assignments.models import LeadAssignment, LeadWorking
from apps.crm import serializers as ser
from apps.crm.models import Client, LeadStage, LeadStageHistory
from apps.crm.services import clients as client_services
from apps.crm.services import stages as stage_services
from apps.crm.services.dashboard import get_dashboard_metrics
from common.permissions import IsActiveCRMMember
from common.responses import success_response


class ClientListCreateView(APIView):
    permission_classes = [IsActiveCRMMember]

    @extend_schema(tags=["clients"], summary="List clients")
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
            ),
            Prefetch(
                "working_assignments",
                queryset=LeadWorking.objects.filter(is_active=True).select_related("team_member"),
                to_attr="prefetched_working",
            ),
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

    @extend_schema(tags=["clients"], summary="Create client", request=ser.ClientCreateSerializer)
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

    @extend_schema(tags=["clients"], summary="Get client", responses={200: ser.ClientDetailSerializer})
    def get(self, request, client_id):
        client = self.get_object(client_id)
        return success_response(ser.ClientDetailSerializer(client).data)

    @extend_schema(tags=["clients"], summary="Update client", request=ser.ClientUpdateSerializer)
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

    @extend_schema(
        tags=["clients"],
        summary="Delete client",
        description="Soft-delete. JSON body must include reason.",
        request=ser.ReasonSerializer,
        examples=[
            OpenApiExample(
                "Delete with reason",
                value={"reason": "Duplicate lead / wrong contact"},
                request_only=True,
            )
        ],
    )
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

    @extend_schema(tags=["clients"], summary="Restore client", request=None)
    def post(self, request, client_id):
        client = get_object_or_404(Client.all_objects, id=client_id, is_deleted=True)
        client = client_services.restore_client(
            actor=request.user, client=client, request=request
        )
        return success_response(ser.ClientDetailSerializer(client).data, message="Client restored")


class ClientFirstCallView(APIView):
    permission_classes = [IsActiveCRMMember]

    @extend_schema(tags=["clients"], summary="Mark first call complete", request=ser.FirstCallCompleteSerializer)
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

    @extend_schema(tags=["clients"], summary="Move client stage", request=ser.StageMoveSerializer)
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
            ),
            Prefetch(
                "working_assignments",
                queryset=LeadWorking.objects.filter(is_active=True).select_related("team_member"),
                to_attr="prefetched_working",
            ),
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


class LeadStageListCreateView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request):
        include_inactive = request.query_params.get("include_inactive") == "true"
        stages = LeadStage.objects.all().order_by("display_order")
        if not include_inactive:
            stages = stages.filter(is_active=True)
        return success_response(ser.LeadStageSerializer(stages, many=True).data)

    @extend_schema(tags=["stages"], summary="Create column", request=ser.LeadStageCreateSerializer)
    def post(self, request):
        serializer = ser.LeadStageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        stage = stage_services.create_stage(
            actor=request.user,
            request=request,
            **serializer.validated_data,
        )
        return success_response(
            ser.LeadStageSerializer(stage).data,
            message="Column created",
            status_code=status.HTTP_201_CREATED,
        )


class LeadStageDetailView(APIView):
    permission_classes = [IsActiveCRMMember]

    @extend_schema(tags=["stages"], summary="Update column", request=ser.LeadStageUpdateSerializer)
    def patch(self, request, stage_id):
        stage = get_object_or_404(LeadStage, id=stage_id)
        serializer = ser.LeadStageUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        stage = stage_services.update_stage(
            actor=request.user,
            stage=stage,
            data=serializer.validated_data,
            request=request,
        )
        return success_response(ser.LeadStageSerializer(stage).data, message="Column updated")

    @extend_schema(
        tags=["stages"],
        summary="Delete column",
        description="JSON body must include reason.",
        request=ser.LeadStageDeleteSerializer,
        examples=[
            OpenApiExample(
                "Delete column with reason",
                value={"reason": "Column no longer used"},
                request_only=True,
            )
        ],
    )
    def delete(self, request, stage_id):
        stage = get_object_or_404(LeadStage, id=stage_id, is_active=True)
        serializer = ser.LeadStageDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = stage_services.delete_stage(
            actor=request.user,
            stage=stage,
            reason=serializer.validated_data["reason"],
            request=request,
        )
        return success_response(result, message="Column deleted")


class LeadStageReorderView(APIView):
    permission_classes = [IsActiveCRMMember]

    @extend_schema(tags=["stages"], summary="Reorder columns", request=ser.LeadStageReorderSerializer)
    def post(self, request):
        serializer = ser.LeadStageReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        stages = stage_services.reorder_stages(
            actor=request.user,
            ordered_ids=serializer.validated_data["ordered_ids"],
            request=request,
        )
        return success_response(
            ser.LeadStageSerializer(stages, many=True).data,
            message="Columns reordered",
        )


class DashboardView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request):
        serializer = ser.DashboardFilterSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        data = get_dashboard_metrics(filters=serializer.validated_data)
        return success_response(data)
