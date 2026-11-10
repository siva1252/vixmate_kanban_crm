from rest_framework import serializers

from apps.team.models import AvailabilityHistory, AvailabilityStatus, TeamMember


class TeamMemberSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = TeamMember
        fields = (
            "id",
            "display_name",
            "job_title",
            "is_active",
            "availability_status",
            "email",
            "full_name",
            "created_at",
            "updated_at",
        )


class AvailabilityUpdateSerializer(serializers.Serializer):
    availability_status = serializers.ChoiceField(choices=AvailabilityStatus.choices)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class AvailabilityHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source="changed_by.full_name", read_only=True)

    class Meta:
        model = AvailabilityHistory
        fields = (
            "id",
            "previous_status",
            "new_status",
            "changed_by",
            "changed_by_name",
            "changed_at",
            "notes",
        )
