from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.views import APIView

from apps.audit.services import write_audit_log
from apps.calls.models import CallHistory, CallOutcome
from apps.crm.models import Client
from common.permissions import IsActiveCRMMember
from common.responses import success_response


class CallSerializer(serializers.ModelSerializer):
    class Meta:
        model = CallHistory
        fields = (
            "id",
            "client",
            "call_datetime",
            "duration_seconds",
            "called_by",
            "outcome",
            "outcome_other",
            "discussion_notes",
            "next_action",
            "follow_up_date",
            "is_first_call",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "called_by", "is_first_call", "created_at", "updated_at")


class CallWriteSerializer(serializers.Serializer):
    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all())
    call_datetime = serializers.DateTimeField()
    duration_seconds = serializers.IntegerField(required=False, allow_null=True)
    outcome = serializers.ChoiceField(choices=CallOutcome.choices)
    outcome_other = serializers.CharField(required=False, allow_blank=True, default="")
    discussion_notes = serializers.CharField(required=False, allow_blank=True, default="")
    next_action = serializers.CharField(required=False, allow_blank=True, default="")
    follow_up_date = serializers.DateField(required=False, allow_null=True)


class CallListCreateView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request):
        qs = CallHistory.objects.select_related("client", "called_by")
        if client := request.query_params.get("client"):
            qs = qs.filter(client_id=client)
        return success_response(CallSerializer(qs, many=True).data)

    @transaction.atomic
    def post(self, request):
        ser = CallWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        call = CallHistory.objects.create(called_by=request.user, **ser.validated_data)
        write_audit_log(
            actor=request.user,
            action="call_created",
            entity_type="CallHistory",
            entity_id=call.id,
            client=call.client,
            new_values={"outcome": call.outcome},
            request=request,
        )
        return success_response(CallSerializer(call).data, status_code=status.HTTP_201_CREATED)


class CallDetailView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request, call_id):
        call = get_object_or_404(CallHistory, id=call_id)
        return success_response(CallSerializer(call).data)

    @transaction.atomic
    def patch(self, request, call_id):
        call = get_object_or_404(CallHistory, id=call_id)
        ser = CallWriteSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        old = {"outcome": call.outcome, "discussion_notes": call.discussion_notes}
        for k, v in ser.validated_data.items():
            if k != "client":
                setattr(call, k, v)
        call.save()
        write_audit_log(
            actor=request.user,
            action="call_updated",
            entity_type="CallHistory",
            entity_id=call.id,
            client=call.client,
            old_values=old,
            new_values={"outcome": call.outcome},
            request=request,
        )
        return success_response(CallSerializer(call).data)

    @transaction.atomic
    def delete(self, request, call_id):
        call = get_object_or_404(CallHistory, id=call_id)
        client = call.client
        cid = call.id
        call.delete()
        write_audit_log(
            actor=request.user,
            action="call_deleted",
            entity_type="CallHistory",
            entity_id=cid,
            client=client,
            request=request,
        )
        return success_response(message="Call deleted")
