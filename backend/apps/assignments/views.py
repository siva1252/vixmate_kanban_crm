from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.assignments import serializers as ser
from apps.assignments.models import AssignmentHistory, LeadAssignment, LeadWorking, ResponsibilityType
from apps.assignments.services import assign_member, reassign_member
from apps.assignments.services_working import assign_working, remove_working, update_working
from common.permissions import IsActiveCRMMember
from common.responses import success_response


class ResponsibilityTypeListView(APIView):
    permission_classes = [IsActiveCRMMember]

    @extend_schema(tags=["assignments"], summary="List responsibility types")
    def get(self, request):
        qs = ResponsibilityType.objects.filter(is_active=True).order_by("display_order")
        return success_response(ser.ResponsibilityTypeSerializer(qs, many=True).data)


class AssignmentListCreateView(APIView):
    permission_classes = [IsActiveCRMMember]

    @extend_schema(
        tags=["assignments"],
        summary="List responsibility assignments",
        parameters=[
            OpenApiParameter("client", OpenApiTypes.UUID, OpenApiParameter.QUERY, required=False),
        ],
    )
    def get(self, request):
        qs = LeadAssignment.objects.filter(is_active=True).select_related(
            "responsibility_type", "team_member", "client"
        )
        if client_id := request.query_params.get("client"):
            qs = qs.filter(client_id=client_id)
        return success_response(ser.LeadAssignmentSerializer(qs, many=True).data)

    @extend_schema(
        tags=["assignments"],
        summary="Assign responsibility",
        description="Responsibility roles (Lead Creation, Technical Management, etc.) — not the Lead Working tab.",
        request=ser.AssignSerializer,
    )
    def post(self, request):
        serializer = ser.AssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = assign_member(
            actor=request.user,
            client=serializer.validated_data["client"],
            responsibility_type=serializer.validated_data["responsibility_type"],
            team_member=serializer.validated_data["team_member"],
            reason=serializer.validated_data.get("reason", ""),
            request=request,
        )
        return success_response(
            ser.LeadAssignmentSerializer(assignment).data,
            message="Assignment saved",
            status_code=status.HTTP_201_CREATED,
        )


class AssignmentReassignView(APIView):
    permission_classes = [IsActiveCRMMember]

    @extend_schema(
        tags=["assignments"],
        summary="Reassign responsibility",
        description="Requires reason. Swaps the member on a responsibility role.",
        request=ser.ReassignSerializer,
    )
    def post(self, request):
        serializer = ser.ReassignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = reassign_member(
            actor=request.user,
            request=request,
            **serializer.validated_data,
        )
        return success_response(
            ser.LeadAssignmentSerializer(assignment).data,
            message="Responsibility reassigned",
        )


class AssignmentHistoryListView(APIView):
    permission_classes = [IsActiveCRMMember]

    @extend_schema(
        tags=["assignments"],
        summary="Responsibility assignment history",
        parameters=[
            OpenApiParameter("client", OpenApiTypes.UUID, OpenApiParameter.QUERY, required=False),
        ],
    )
    def get(self, request):
        qs = AssignmentHistory.objects.select_related(
            "responsibility_type", "previous_member", "new_member", "client"
        )
        if client_id := request.query_params.get("client"):
            qs = qs.filter(client_id=client_id)
        return success_response(ser.AssignmentHistorySerializer(qs, many=True).data)


class WorkingListCreateView(APIView):
    permission_classes = [IsActiveCRMMember]

    @extend_schema(
        tags=["assignments"],
        summary="List lead working assignments",
        description="Lead detail → Working tab. Who is working on the lead + work note.",
        parameters=[
            OpenApiParameter("client", OpenApiTypes.UUID, OpenApiParameter.QUERY, required=False),
        ],
    )
    def get(self, request):
        qs = LeadWorking.objects.filter(is_active=True).select_related(
            "team_member",
            "client",
            "assigned_by",
            "updated_by",
            "assigned_by__team_member",
            "updated_by__team_member",
        )
        if client_id := request.query_params.get("client"):
            qs = qs.filter(client_id=client_id)
        return success_response(ser.LeadWorkingSerializer(qs, many=True).data)

    @extend_schema(
        tags=["assignments"],
        summary="Assign to Working tab",
        description="Creates a Lead Working row (member + work note). This is what the frontend Working tab uses.",
        request=ser.WorkingAssignSerializer,
    )
    def post(self, request):
        serializer = ser.WorkingAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        row = assign_working(
            actor=request.user,
            client=serializer.validated_data["client"],
            team_member=serializer.validated_data["team_member"],
            work_note=serializer.validated_data["work_note"],
            request=request,
        )
        return success_response(
            ser.LeadWorkingSerializer(row).data,
            message="Working assignment created",
            status_code=status.HTTP_201_CREATED,
        )


class WorkingDetailView(APIView):
    permission_classes = [IsActiveCRMMember]

    @extend_schema(
        tags=["assignments"],
        summary="Update Working assignment",
        description="Requires reason. Updates member and/or work note.",
        request=ser.WorkingUpdateSerializer,
    )
    def patch(self, request, working_id):
        row = get_object_or_404(
            LeadWorking.objects.select_related("team_member", "client"),
            id=working_id,
            is_active=True,
        )
        serializer = ser.WorkingUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        reason = data.pop("reason")
        row = update_working(
            actor=request.user,
            row=row,
            data=data,
            reason=reason,
            request=request,
        )
        return success_response(ser.LeadWorkingSerializer(row).data, message="Working assignment updated")

    @extend_schema(
        tags=["assignments"],
        summary="Remove from Working",
        description="Requires reason in JSON body: {\"reason\": \"...\"}",
        request=ser.WorkingRemoveSerializer,
    )
    def delete(self, request, working_id):
        row = get_object_or_404(LeadWorking, id=working_id, is_active=True)
        serializer = ser.WorkingRemoveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        remove_working(
            actor=request.user,
            row=row,
            reason=serializer.validated_data["reason"],
            request=request,
        )
        return success_response(message="Working assignment removed")
