from rest_framework import serializers

from apps.assignments.models import AssignmentHistory, LeadAssignment, LeadWorking, ResponsibilityType
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


class LeadWorkingSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source="team_member.display_name", read_only=True)
    job_title = serializers.CharField(source="team_member.job_title", read_only=True)
    assigned_by_name = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = LeadWorking
        fields = (
            "id",
            "client",
            "team_member",
            "member_name",
            "job_title",
            "work_note",
            "assigned_by",
            "assigned_by_name",
            "updated_by",
            "updated_by_name",
            "is_active",
            "created_at",
            "updated_at",
        )

    def get_assigned_by_name(self, obj):
        if not obj.assigned_by_id:
            return None
        member = getattr(obj.assigned_by, "team_member", None)
        return member.display_name if member else obj.assigned_by.get_full_name() or obj.assigned_by.email

    def get_updated_by_name(self, obj):
        if not obj.updated_by_id:
            return None
        member = getattr(obj.updated_by, "team_member", None)
        return member.display_name if member else obj.updated_by.get_full_name() or obj.updated_by.email


class WorkingAssignSerializer(serializers.Serializer):
    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all())
    team_member = serializers.PrimaryKeyRelatedField(
        queryset=TeamMember.objects.filter(is_active=True)
    )
    work_note = serializers.CharField()


class WorkingUpdateSerializer(serializers.Serializer):
    team_member = serializers.PrimaryKeyRelatedField(
        queryset=TeamMember.objects.filter(is_active=True),
        required=False,
    )
    work_note = serializers.CharField(required=False)
    reason = serializers.CharField(min_length=3)


class WorkingRemoveSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=3)


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
