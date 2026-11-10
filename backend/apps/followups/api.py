from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.views import APIView

from apps.audit.services import write_audit_log
from apps.calls.models import CallOutcome
from apps.crm.models import Client
from apps.followups.models import FollowUp, FollowUpStatus
from common.permissions import IsActiveCRMMember
from common.responses import success_response


class FollowUpSerializer(serializers.ModelSerializer):
    class Meta:
        model = FollowUp
        fields = (
            "id",
            "client",
            "follow_up_date",
            "updated_by",
            "call_outcome",
            "notes",
            "next_action",
            "status",
            "created_at",
            "updated_at",
        )


class FollowUpWriteSerializer(serializers.Serializer):
    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all())
    follow_up_date = serializers.DateField()
    call_outcome = serializers.ChoiceField(choices=CallOutcome.choices, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    next_action = serializers.CharField(required=False, allow_blank=True, default="")
    status = serializers.ChoiceField(choices=FollowUpStatus.choices, required=False)


class FollowUpListCreateView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request):
        qs = FollowUp.objects.select_related("client", "updated_by")
        if client := request.query_params.get("client"):
            qs = qs.filter(client_id=client)
        return success_response(FollowUpSerializer(qs, many=True).data)

    @transaction.atomic
    def post(self, request):
        ser = FollowUpWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        followup = FollowUp.objects.create(updated_by=request.user, **ser.validated_data)
        write_audit_log(
            actor=request.user,
            action="followup_created",
            entity_type="FollowUp",
            entity_id=followup.id,
            client=followup.client,
            new_values={"follow_up_date": str(followup.follow_up_date), "status": followup.status},
            request=request,
        )
        return success_response(FollowUpSerializer(followup).data, status_code=status.HTTP_201_CREATED)


class FollowUpDetailView(APIView):
    permission_classes = [IsActiveCRMMember]

    @transaction.atomic
    def patch(self, request, followup_id):
        followup = get_object_or_404(FollowUp, id=followup_id)
        ser = FollowUpWriteSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        old = {"status": followup.status, "notes": followup.notes}
        for k, v in ser.validated_data.items():
            if k == "client":
                continue
            setattr(followup, k, v)
        followup.updated_by = request.user
        followup.save()
        write_audit_log(
            actor=request.user,
            action="followup_updated",
            entity_type="FollowUp",
            entity_id=followup.id,
            client=followup.client,
            old_values=old,
            new_values={"status": followup.status, "notes": followup.notes},
            request=request,
        )
        return success_response(FollowUpSerializer(followup).data)
