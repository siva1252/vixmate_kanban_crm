from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.views import APIView

from apps.audit.services import write_audit_log
from apps.comments.models import Comment, CommentEditHistory
from apps.crm.models import Client
from common.permissions import IsActiveCRMMember
from common.responses import success_response


class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.full_name", read_only=True)

    class Meta:
        model = Comment
        fields = (
            "id",
            "client",
            "author",
            "author_name",
            "body",
            "created_at",
            "updated_at",
            "is_deleted",
        )
        read_only_fields = fields


class CommentWriteSerializer(serializers.Serializer):
    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all())
    body = serializers.CharField()


class CommentListCreateView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request):
        qs = Comment.objects.filter(is_deleted=False).select_related("author", "client")
        if client := request.query_params.get("client"):
            qs = qs.filter(client_id=client)
        return success_response(CommentSerializer(qs, many=True).data)

    @transaction.atomic
    def post(self, request):
        ser = CommentWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        comment = Comment.objects.create(
            author=request.user,
            client=ser.validated_data["client"],
            body=ser.validated_data["body"],
        )
        write_audit_log(
            actor=request.user,
            action="comment_created",
            entity_type="Comment",
            entity_id=comment.id,
            client=comment.client,
            request=request,
        )
        return success_response(CommentSerializer(comment).data, status_code=status.HTTP_201_CREATED)


class CommentDetailView(APIView):
    permission_classes = [IsActiveCRMMember]

    @transaction.atomic
    def patch(self, request, comment_id):
        comment = get_object_or_404(Comment, id=comment_id, is_deleted=False)
        body = (request.data.get("body") or "").strip()
        if not body:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"body": "Comment body is required."})
        previous = comment.body
        comment.body = body
        comment.save(update_fields=["body", "updated_at"])
        CommentEditHistory.objects.create(
            comment=comment,
            previous_body=previous,
            new_body=body,
            edited_by=request.user,
        )
        write_audit_log(
            actor=request.user,
            action="comment_updated",
            entity_type="Comment",
            entity_id=comment.id,
            client=comment.client,
            old_values={"body": previous},
            new_values={"body": body},
            request=request,
        )
        return success_response(CommentSerializer(comment).data)

    @transaction.atomic
    def delete(self, request, comment_id):
        comment = get_object_or_404(Comment, id=comment_id, is_deleted=False)
        comment.soft_delete()
        write_audit_log(
            actor=request.user,
            action="comment_deleted",
            entity_type="Comment",
            entity_id=comment.id,
            client=comment.client,
            request=request,
        )
        return success_response(message="Comment deleted")
