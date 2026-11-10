from rest_framework import serializers

from apps.configuration.models import Industry, LeadSource, Service
from apps.crm.models import Client, LeadStage, LeadStageHistory
from apps.team.models import TeamMember


class LeadStageSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadStage
        fields = ("id", "name", "slug", "display_order", "is_terminal", "is_active")


class ClientListSerializer(serializers.ModelSerializer):
    stage = LeadStageSerializer(read_only=True)
    lead_source_name = serializers.CharField(source="lead_source.name", read_only=True)
    service_name = serializers.CharField(source="service.name", read_only=True)
    assignees = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = (
            "id",
            "client_name",
            "primary_phone",
            "primary_email",
            "stage",
            "lead_source",
            "lead_source_name",
            "lead_source_other",
            "service",
            "service_name",
            "service_other",
            "first_call_completed",
            "created_at",
            "updated_at",
            "assignees",
        )

    def get_assignees(self, obj):
        assignments = getattr(obj, "prefetched_assignments", None)
        if assignments is None:
            assignments = obj.assignments.filter(is_active=True).select_related("team_member")
        return [
            {
                "responsibility": a.responsibility_type.name,
                "member": a.team_member.display_name,
                "member_id": str(a.team_member_id),
            }
            for a in assignments
        ]


class ClientDetailSerializer(ClientListSerializer):
    class Meta(ClientListSerializer.Meta):
        fields = ClientListSerializer.Meta.fields + (
            "alternate_phone",
            "alternate_email",
            "company_name",
            "website",
            "company_address",
            "decision_maker_phone",
            "decision_maker_alternate_phone",
            "decision_maker_email",
            "decision_maker_alternate_email",
            "industry",
            "estimated_deal_value",
            "client_requirements",
            "next_follow_up_date",
            "call_discussion_notes",
            "first_call_notes",
            "first_call_completed_at",
            "agreed_project_scope",
            "project_deadline",
        )


class ClientCreateSerializer(serializers.Serializer):
    client_name = serializers.CharField(max_length=255)
    primary_phone = serializers.CharField(max_length=32)
    alternate_phone = serializers.CharField(required=False, allow_blank=True, default="")
    primary_email = serializers.EmailField(required=False, allow_blank=True, default="")
    alternate_email = serializers.EmailField(required=False, allow_blank=True, default="")
    lead_source = serializers.PrimaryKeyRelatedField(queryset=LeadSource.objects.filter(is_active=True))
    lead_source_other = serializers.CharField(required=False, allow_blank=True, default="")
    service = serializers.PrimaryKeyRelatedField(queryset=Service.objects.filter(is_active=True))
    service_other = serializers.CharField(required=False, allow_blank=True, default="")
    first_call_completed = serializers.BooleanField(default=False)
    # post-call optional
    decision_maker_phone = serializers.CharField(required=False, allow_blank=True)
    decision_maker_alternate_phone = serializers.CharField(required=False, allow_blank=True)
    decision_maker_email = serializers.EmailField(required=False, allow_blank=True)
    decision_maker_alternate_email = serializers.EmailField(required=False, allow_blank=True)
    industry = serializers.PrimaryKeyRelatedField(
        queryset=Industry.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    estimated_deal_value = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True
    )
    client_requirements = serializers.CharField(required=False, allow_blank=True)
    next_follow_up_date = serializers.DateField(required=False, allow_null=True)
    call_discussion_notes = serializers.CharField(required=False, allow_blank=True)
    first_call_notes = serializers.CharField(required=False, allow_blank=True)


class ClientUpdateSerializer(ClientCreateSerializer):
    reason = serializers.CharField(required=False, allow_blank=True)
    company_name = serializers.CharField(required=False, allow_blank=True)
    website = serializers.URLField(required=False, allow_blank=True)
    company_address = serializers.CharField(required=False, allow_blank=True)
    agreed_project_scope = serializers.CharField(required=False, allow_blank=True)
    project_deadline = serializers.DateField(required=False, allow_null=True)


class StageMoveSerializer(serializers.Serializer):
    stage = serializers.PrimaryKeyRelatedField(queryset=LeadStage.objects.filter(is_active=True))


class ReasonSerializer(serializers.Serializer):
    reason = serializers.CharField()


class FirstCallCompleteSerializer(serializers.Serializer):
    decision_maker_phone = serializers.CharField(required=False, allow_blank=True)
    decision_maker_alternate_phone = serializers.CharField(required=False, allow_blank=True)
    decision_maker_email = serializers.EmailField(required=False, allow_blank=True)
    decision_maker_alternate_email = serializers.EmailField(required=False, allow_blank=True)
    industry = serializers.PrimaryKeyRelatedField(
        queryset=Industry.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    estimated_deal_value = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True
    )
    client_requirements = serializers.CharField(required=False, allow_blank=True)
    next_follow_up_date = serializers.DateField(required=False, allow_null=True)
    call_discussion_notes = serializers.CharField(required=False, allow_blank=True)
    first_call_notes = serializers.CharField(required=False, allow_blank=True)
    next_action = serializers.CharField(required=False, allow_blank=True)
    company_name = serializers.CharField(required=False, allow_blank=True)


class LeadStageHistorySerializer(serializers.ModelSerializer):
    previous_stage = LeadStageSerializer(read_only=True)
    new_stage = LeadStageSerializer(read_only=True)
    changed_by_name = serializers.CharField(source="changed_by.full_name", read_only=True)

    class Meta:
        model = LeadStageHistory
        fields = (
            "id",
            "previous_stage",
            "new_stage",
            "changed_by",
            "changed_by_name",
            "changed_at",
        )


class DashboardFilterSerializer(serializers.Serializer):
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    stage = serializers.PrimaryKeyRelatedField(
        queryset=LeadStage.objects.all(), required=False
    )
    source = serializers.PrimaryKeyRelatedField(
        queryset=LeadSource.objects.all(), required=False
    )
    team_member = serializers.PrimaryKeyRelatedField(
        queryset=TeamMember.objects.all(), required=False
    )
