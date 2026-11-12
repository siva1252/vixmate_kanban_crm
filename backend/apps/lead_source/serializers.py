from rest_framework import serializers

from apps.crm.models import Client
from apps.lead_source.models import LeadSourceAttribution, LeadSourcePerson


class LeadSourcePersonSerializer(serializers.ModelSerializer):
    lead_count = serializers.SerializerMethodField()

    class Meta:
        model = LeadSourcePerson
        fields = (
            "id",
            "display_name",
            "phone",
            "email",
            "role_label",
            "notes",
            "is_active",
            "lead_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "lead_count", "created_at", "updated_at")

    def get_lead_count(self, obj):
        return obj.attributions.filter(is_active=True, client__is_deleted=False).count()


class LeadSourcePersonWriteSerializer(serializers.Serializer):
    display_name = serializers.CharField(max_length=255, min_length=2)
    phone = serializers.CharField(required=False, allow_blank=True, default="", max_length=15)
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    role_label = serializers.CharField(required=False, allow_blank=True, default="", max_length=128)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    is_active = serializers.BooleanField(required=False, default=True)

    def validate_display_name(self, value: str) -> str:
        cleaned = (value or "").strip()
        if len(cleaned) < 2:
            raise serializers.ValidationError("Name must be at least 2 characters.")
        return cleaned

    def validate_phone(self, value: str) -> str:
        digits = "".join(ch for ch in (value or "") if ch.isdigit())
        if not digits:
            return ""
        if len(digits) < 8 or len(digits) > 15:
            raise serializers.ValidationError("Phone must be 8–15 digits.")
        return digits

    def validate_email(self, value: str) -> str:
        return (value or "").strip().lower()


class LeadSourcePersonUpdateSerializer(LeadSourcePersonWriteSerializer):
    display_name = serializers.CharField(max_length=255, min_length=2, required=False)
    reason = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        # Deactivate requires a reason (min 3 chars).
        if attrs.get("is_active") is False:
            reason = (attrs.get("reason") or "").strip()
            if len(reason) < 3:
                raise serializers.ValidationError(
                    {"reason": "Reason is required to deactivate (min 3 characters)."}
                )
        return attrs


class LeadSourceAttributionSerializer(serializers.ModelSerializer):
    person_name = serializers.CharField(source="person.display_name", read_only=True)
    client_name = serializers.CharField(source="client.client_name", read_only=True)
    stage_name = serializers.CharField(source="client.stage.name", read_only=True)

    class Meta:
        model = LeadSourceAttribution
        fields = (
            "id",
            "client",
            "client_name",
            "person",
            "person_name",
            "stage_name",
            "note",
            "assigned_by",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class AssignLeadSerializer(serializers.Serializer):
    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.filter(is_deleted=False))
    note = serializers.CharField(required=False, allow_blank=True, default="")


class AssignPersonToLeadSerializer(serializers.Serializer):
    """Assign one or more Lead Source people to a lead (from Lead Source UI)."""

    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.filter(is_deleted=False))
    people = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=LeadSourcePerson.objects.filter(is_active=True),
    )
    note = serializers.CharField(required=False, allow_blank=True, default="")


class RemoveAttributionSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True, allow_blank=False, min_length=3, max_length=500)
