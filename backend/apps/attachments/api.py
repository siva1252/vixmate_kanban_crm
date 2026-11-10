import os

from django.conf import settings
from django.db import transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.views import APIView

from apps.attachments.models import Attachment
from apps.audit.services import write_audit_log
from apps.crm.models import Client
from common.permissions import IsActiveCRMMember
from common.responses import success_response
from common.validators import require_reason


class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = (
            "id",
            "client",
            "original_filename",
            "file_type",
            "file_size",
            "uploaded_by",
            "created_at",
            "is_deleted",
        )


class AttachmentUploadSerializer(serializers.Serializer):
    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all())
    file = serializers.FileField()


def _validate_file(uploaded):
    name = uploaded.name or ""
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    allowed = set(settings.ATTACHMENT_ALLOWED_EXTENSIONS)
    if ext not in allowed:
        raise serializers.ValidationError({"file": f"File type .{ext} is not allowed."})
    max_bytes = settings.ATTACHMENT_MAX_SIZE_MB * 1024 * 1024
    if uploaded.size > max_bytes:
        raise serializers.ValidationError(
            {"file": f"File exceeds {settings.ATTACHMENT_MAX_SIZE_MB}MB limit."}
        )


class AttachmentListCreateView(APIView):
    permission_classes = [IsActiveCRMMember]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        qs = Attachment.objects.filter(is_deleted=False)
        if client := request.query_params.get("client"):
            qs = qs.filter(client_id=client)
        return success_response(AttachmentSerializer(qs, many=True).data)

    @transaction.atomic
    def post(self, request):
        ser = AttachmentUploadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        uploaded = ser.validated_data["file"]
        _validate_file(uploaded)
        attachment = Attachment.objects.create(
            client=ser.validated_data["client"],
            original_filename=uploaded.name,
            file=uploaded,
            file_type=getattr(uploaded, "content_type", "") or "",
            file_size=uploaded.size,
            uploaded_by=request.user,
        )
        write_audit_log(
            actor=request.user,
            action="attachment_uploaded",
            entity_type="Attachment",
            entity_id=attachment.id,
            client=attachment.client,
            new_values={"filename": attachment.original_filename, "size": attachment.file_size},
            request=request,
        )
        return success_response(
            AttachmentSerializer(attachment).data, status_code=status.HTTP_201_CREATED
        )


class AttachmentDownloadView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request, attachment_id):
        attachment = get_object_or_404(Attachment, id=attachment_id, is_deleted=False)
        write_audit_log(
            actor=request.user,
            action="attachment_downloaded",
            entity_type="Attachment",
            entity_id=attachment.id,
            client=attachment.client,
            request=request,
        )
        return FileResponse(
            attachment.file.open("rb"),
            as_attachment=True,
            filename=attachment.original_filename,
        )


class AttachmentDeleteView(APIView):
    permission_classes = [IsActiveCRMMember]

    @transaction.atomic
    def delete(self, request, attachment_id):
        attachment = get_object_or_404(Attachment, id=attachment_id, is_deleted=False)
        reason = require_reason(request.data.get("reason"))
        attachment.is_deleted = True
        attachment.deleted_at = timezone.now()
        attachment.deleted_by = request.user
        attachment.deletion_reason = reason
        attachment.save(
            update_fields=["is_deleted", "deleted_at", "deleted_by", "deletion_reason", "updated_at"]
        )
        write_audit_log(
            actor=request.user,
            action="attachment_deleted",
            entity_type="Attachment",
            entity_id=attachment.id,
            client=attachment.client,
            reason=reason,
            request=request,
        )
        return success_response(message="Attachment deleted")
