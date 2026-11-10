from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.views import APIView

from apps.audit.services import write_audit_log
from apps.crm.models import Client
from apps.meetings.models import Meeting, MeetingHistory, MeetingParticipant, MeetingStatus, MeetingType
from apps.team.models import TeamMember
from common.permissions import IsActiveCRMMember
from common.responses import success_response


class MeetingSerializer(serializers.ModelSerializer):
    participant_ids = serializers.SerializerMethodField()

    class Meta:
        model = Meeting
        fields = (
            "id",
            "client",
            "title",
            "meeting_date",
            "start_time",
            "end_time",
            "coordinator",
            "meeting_type",
            "meeting_link",
            "location",
            "agenda",
            "discussion_notes",
            "outcome",
            "next_action",
            "status",
            "participant_ids",
            "created_at",
            "updated_at",
        )

    def get_participant_ids(self, obj):
        return [str(p.team_member_id) for p in obj.participants.all()]


class MeetingWriteSerializer(serializers.Serializer):
    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all())
    title = serializers.CharField(max_length=255)
    meeting_date = serializers.DateField()
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
    coordinator = serializers.PrimaryKeyRelatedField(queryset=TeamMember.objects.filter(is_active=True))
    meeting_type = serializers.ChoiceField(choices=MeetingType.choices)
    meeting_link = serializers.URLField(required=False, allow_blank=True, default="")
    location = serializers.CharField(required=False, allow_blank=True, default="")
    agenda = serializers.CharField(required=False, allow_blank=True, default="")
    discussion_notes = serializers.CharField(required=False, allow_blank=True, default="")
    outcome = serializers.CharField(required=False, allow_blank=True, default="")
    next_action = serializers.CharField(required=False, allow_blank=True, default="")
    status = serializers.ChoiceField(choices=MeetingStatus.choices, required=False)
    participant_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )
    reason = serializers.CharField(required=False, allow_blank=True, default="")


def _set_participants(meeting, participant_ids):
    MeetingParticipant.objects.filter(meeting=meeting).delete()
    members = TeamMember.objects.filter(id__in=participant_ids)
    MeetingParticipant.objects.bulk_create(
        [MeetingParticipant(meeting=meeting, team_member=m) for m in members]
    )


class MeetingListCreateView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request):
        qs = Meeting.objects.select_related("client", "coordinator").prefetch_related("participants")
        if client := request.query_params.get("client"):
            qs = qs.filter(client_id=client)
        return success_response(MeetingSerializer(qs, many=True).data)

    @transaction.atomic
    def post(self, request):
        ser = MeetingWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = dict(ser.validated_data)
        participant_ids = data.pop("participant_ids", [])
        data.pop("reason", None)
        data.pop("status", None)
        meeting = Meeting.objects.create(created_by=request.user, **data)
        _set_participants(meeting, participant_ids)
        MeetingHistory.objects.create(
            meeting=meeting, action="created", changed_by=request.user, new_values={"title": meeting.title}
        )
        write_audit_log(
            actor=request.user,
            action="meeting_created",
            entity_type="Meeting",
            entity_id=meeting.id,
            client=meeting.client,
            new_values={"title": meeting.title, "status": meeting.status},
            request=request,
        )
        meeting = Meeting.objects.prefetch_related("participants").get(id=meeting.id)
        return success_response(MeetingSerializer(meeting).data, status_code=status.HTTP_201_CREATED)


class MeetingDetailView(APIView):
    permission_classes = [IsActiveCRMMember]

    @transaction.atomic
    def patch(self, request, meeting_id):
        meeting = get_object_or_404(Meeting, id=meeting_id)
        ser = MeetingWriteSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        data = dict(ser.validated_data)
        reason = data.pop("reason", "")
        participant_ids = data.pop("participant_ids", None)
        old = {"status": meeting.status, "meeting_date": str(meeting.meeting_date)}
        for k, v in data.items():
            if k == "client":
                continue
            setattr(meeting, k, v)
        meeting.save()
        if participant_ids is not None:
            _set_participants(meeting, participant_ids)
        MeetingHistory.objects.create(
            meeting=meeting,
            action="updated",
            old_values=old,
            new_values={"status": meeting.status, "meeting_date": str(meeting.meeting_date)},
            reason=reason,
            changed_by=request.user,
        )
        write_audit_log(
            actor=request.user,
            action="meeting_updated",
            entity_type="Meeting",
            entity_id=meeting.id,
            client=meeting.client,
            old_values=old,
            new_values={"status": meeting.status},
            reason=reason,
            request=request,
        )
        meeting = Meeting.objects.prefetch_related("participants").get(id=meeting.id)
        return success_response(MeetingSerializer(meeting).data)
