from django.shortcuts import get_object_or_404
from rest_framework.views import APIView

from apps.team import serializers as ser
from apps.team.models import AvailabilityHistory, TeamMember
from apps.team.services import update_availability
from common.permissions import IsActiveCRMMember
from common.responses import success_response


class TeamMemberListView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request):
        qs = TeamMember.objects.select_related("user").filter(is_active=True)
        if request.query_params.get("include_inactive") == "true":
            qs = TeamMember.objects.select_related("user").all()
        return success_response(ser.TeamMemberSerializer(qs, many=True).data)


class TeamMemberDetailView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request, member_id):
        member = get_object_or_404(TeamMember.objects.select_related("user"), id=member_id)
        return success_response(ser.TeamMemberSerializer(member).data)


class TeamAvailabilityUpdateView(APIView):
    permission_classes = [IsActiveCRMMember]

    def patch(self, request, member_id):
        member = get_object_or_404(TeamMember, id=member_id)
        serializer = ser.AvailabilityUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member = update_availability(
            actor=request.user,
            team_member=member,
            new_status=serializer.validated_data["availability_status"],
            notes=serializer.validated_data.get("notes", ""),
            request=request,
        )
        return success_response(
            ser.TeamMemberSerializer(member).data,
            message="Availability updated",
        )


class TeamAvailabilityHistoryView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request, member_id):
        history = AvailabilityHistory.objects.filter(team_member_id=member_id).select_related(
            "changed_by"
        )
        return success_response(ser.AvailabilityHistorySerializer(history, many=True).data)
