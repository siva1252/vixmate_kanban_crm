from rest_framework import status
from rest_framework.views import APIView

from apps.assignments import serializers as ser
from apps.assignments.models import AssignmentHistory, LeadAssignment, ResponsibilityType
from apps.assignments.services import assign_member, reassign_member
from common.permissions import IsActiveCRMMember
from common.responses import success_response


class ResponsibilityTypeListView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request):
        qs = ResponsibilityType.objects.filter(is_active=True).order_by("display_order")
        return success_response(ser.ResponsibilityTypeSerializer(qs, many=True).data)


class AssignmentListCreateView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request):
        qs = LeadAssignment.objects.filter(is_active=True).select_related(
            "responsibility_type", "team_member", "client"
        )
        if client_id := request.query_params.get("client"):
            qs = qs.filter(client_id=client_id)
        return success_response(ser.LeadAssignmentSerializer(qs, many=True).data)

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

    def get(self, request):
        qs = AssignmentHistory.objects.select_related(
            "responsibility_type", "previous_member", "new_member", "client"
        )
        if client_id := request.query_params.get("client"):
            qs = qs.filter(client_id=client_id)
        return success_response(ser.AssignmentHistorySerializer(qs, many=True).data)
