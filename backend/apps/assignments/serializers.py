from rest_framework import serializers

from apps.assignments.models import AssignmentHistory, LeadAssignment, ResponsibilityType
from apps.crm.models import Client
from apps.team.models import TeamMember


class ResponsibilityTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResponsibilityType
        fields = (
            "id",
            "name",
            "slug",
            "display_order",
            "is_active",
            "allows_multiple_members",
            "description",
        )


class LeadAssignmentSerializer(serializers.ModelSerializer):
    responsibility_name = serializers.CharField(source="responsibility_type.name", read_only=True)
    member_name = serializers.CharField(source="team_member.display_name", read_only=True)

    class Meta:
        model = LeadAssignment
        fields = (
            "id",
            "client",
            "responsibility_type",
            "responsibility_name",
            "team_member",
            "member_name",
            "assigned_by",
            "is_active",
            "created_at",
            "updated_at",
        )


class AssignSerializer(serializers.Serializer):
    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all())
    responsibility_type = serializers.PrimaryKeyRelatedField(
        queryset=ResponsibilityType.objects.filter(is_active=True)
    )
    team_member = serializers.PrimaryKeyRelatedField(
        queryset=TeamMember.objects.filter(is_active=True)
    )
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class ReassignSerializer(serializers.Serializer):
    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all())
    responsibility_type = serializers.PrimaryKeyRelatedField(
        queryset=ResponsibilityType.objects.filter(is_active=True)
    )
    previous_member = serializers.PrimaryKeyRelatedField(
        queryset=TeamMember.objects.all()
    )
    new_member = serializers.PrimaryKeyRelatedField(
        queryset=TeamMember.objects.filter(is_active=True)
    )
    reason = serializers.CharField()


class AssignmentHistorySerializer(serializers.ModelSerializer):
    responsibility_name = serializers.CharField(source="responsibility_type.name", read_only=True)
    previous_member_name = serializers.CharField(
        source="previous_member.display_name", read_only=True
    )
    new_member_name = serializers.CharField(source="new_member.display_name", read_only=True)

    class Meta:
        model = AssignmentHistory
        fields = (
            "id",
            "client",
            "responsibility_type",
            "responsibility_name",
            "previous_member",
            "previous_member_name",
            "new_member",
            "new_member_name",
            "assigned_by",
            "reason",
            "assigned_at",
        )
