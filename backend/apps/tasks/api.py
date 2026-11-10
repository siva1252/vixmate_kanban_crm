from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.views import APIView

from apps.audit.services import write_audit_log
from apps.crm.models import Client
from apps.tasks.models import Task, TaskHistory, TaskPriority, TaskStatus
from apps.team.models import TeamMember
from common.permissions import IsActiveCRMMember
from common.responses import success_response
from common.validators import require_reason


class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = (
            "id",
            "client",
            "title",
            "description",
            "assigned_to",
            "created_by",
            "start_date",
            "due_date",
            "priority",
            "status",
            "completion_date",
            "completion_notes",
            "created_at",
            "updated_at",
        )


class TaskWriteSerializer(serializers.Serializer):
    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all())
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    assigned_to = serializers.PrimaryKeyRelatedField(
        queryset=TeamMember.objects.filter(is_active=True), required=False, allow_null=True
    )
    start_date = serializers.DateField(required=False, allow_null=True)
    due_date = serializers.DateField(required=False, allow_null=True)
    priority = serializers.ChoiceField(choices=TaskPriority.choices, default=TaskPriority.MEDIUM)
    status = serializers.ChoiceField(choices=TaskStatus.choices, required=False)
    completion_notes = serializers.CharField(required=False, allow_blank=True, default="")
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class TaskListCreateView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request):
        qs = Task.objects.select_related("client", "assigned_to")
        if client := request.query_params.get("client"):
            qs = qs.filter(client_id=client)
        if status_q := request.query_params.get("status"):
            qs = qs.filter(status=status_q)
        return success_response(TaskSerializer(qs, many=True).data)

    @transaction.atomic
    def post(self, request):
        ser = TaskWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = dict(ser.validated_data)
        data.pop("reason", None)
        data.pop("status", None)
        task = Task.objects.create(created_by=request.user, **data)
        TaskHistory.objects.create(
            task=task,
            action="created",
            new_values={"title": task.title},
            changed_by=request.user,
        )
        write_audit_log(
            actor=request.user,
            action="task_created",
            entity_type="Task",
            entity_id=task.id,
            client=task.client,
            new_values={"title": task.title, "status": task.status},
            request=request,
        )
        return success_response(TaskSerializer(task).data, status_code=status.HTTP_201_CREATED)


class TaskDetailView(APIView):
    permission_classes = [IsActiveCRMMember]

    @transaction.atomic
    def patch(self, request, task_id):
        task = get_object_or_404(Task, id=task_id)
        ser = TaskWriteSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        data = dict(ser.validated_data)
        reason = data.pop("reason", "")
        old = {"status": task.status, "assigned_to": str(task.assigned_to_id)}
        for k, v in data.items():
            if k == "client":
                continue
            setattr(task, k, v)
        if task.status == TaskStatus.COMPLETED and not task.completion_date:
            task.completion_date = timezone.now()
        task.save()
        TaskHistory.objects.create(
            task=task,
            action="updated",
            old_values=old,
            new_values={"status": task.status, "assigned_to": str(task.assigned_to_id)},
            reason=reason,
            changed_by=request.user,
        )
        write_audit_log(
            actor=request.user,
            action="task_updated",
            entity_type="Task",
            entity_id=task.id,
            client=task.client,
            old_values=old,
            new_values={"status": task.status},
            reason=reason,
            request=request,
        )
        return success_response(TaskSerializer(task).data)

    @transaction.atomic
    def delete(self, request, task_id):
        task = get_object_or_404(Task, id=task_id)
        reason = require_reason(request.data.get("reason"))
        task.is_deleted = True
        task.deletion_reason = reason
        task.deleted_at = timezone.now()
        task.deleted_by = request.user
        task.save(
            update_fields=[
                "is_deleted",
                "deletion_reason",
                "deleted_at",
                "deleted_by",
                "updated_at",
            ]
        )
        TaskHistory.objects.create(
            task=task, action="deleted", reason=reason, changed_by=request.user
        )
        write_audit_log(
            actor=request.user,
            action="task_deleted",
            entity_type="Task",
            entity_id=task.id,
            client=task.client,
            reason=reason,
            request=request,
        )
        return success_response(message="Task deleted")
