from rest_framework import serializers

from apps.audit.models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.full_name", read_only=True)
    client_name = serializers.CharField(source="client.client_name", read_only=True)

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor",
            "actor_name",
            "action",
            "entity_type",
            "entity_id",
            "client",
            "client_name",
            "old_values",
            "new_values",
            "description",
            "reason",
            "timestamp",
            "ip_address",
            "request_id",
        )
