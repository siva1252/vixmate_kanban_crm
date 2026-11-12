from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.crm.models import Client
from apps.crm.serializers import ClientListSerializer
from apps.lead_source import serializers as ser
from apps.lead_source.models import LeadSourceAttribution, LeadSourcePerson
from apps.lead_source.services import (
    assign_lead_to_person,
    assign_people_to_lead,
    create_person,
    person_stats,
    remove_attribution,
    update_person,
)
from common.permissions import IsActiveCRMMember
from common.responses import success_response


class LeadSourcePersonListCreateView(APIView):
    permission_classes = [IsActiveCRMMember]

    @extend_schema(
        tags=["lead-source"],
        summary="List Lead Source people",
        parameters=[
            OpenApiParameter("search", OpenApiTypes.STR, OpenApiParameter.QUERY, required=False),
            OpenApiParameter("include_inactive", OpenApiTypes.BOOL, OpenApiParameter.QUERY, required=False),
            OpenApiParameter("status", OpenApiTypes.STR, OpenApiParameter.QUERY, required=False, description="active|inactive|all"),
            OpenApiParameter("has_leads", OpenApiTypes.STR, OpenApiParameter.QUERY, required=False, description="true|false"),
            OpenApiParameter("client", OpenApiTypes.UUID, OpenApiParameter.QUERY, required=False),
            OpenApiParameter("stage", OpenApiTypes.UUID, OpenApiParameter.QUERY, required=False),
            OpenApiParameter("channel", OpenApiTypes.UUID, OpenApiParameter.QUERY, required=False, description="configuration lead_source id"),
            OpenApiParameter("role", OpenApiTypes.STR, OpenApiParameter.QUERY, required=False),
            OpenApiParameter("first_call", OpenApiTypes.STR, OpenApiParameter.QUERY, required=False, description="yes|no"),
        ],
    )
    def get(self, request):
        qs = LeadSourcePerson.objects.annotate(
            active_lead_count=Count(
                "attributions",
                filter=Q(attributions__is_active=True, attributions__client__is_deleted=False),
            )
        )
        status_filter = (request.query_params.get("status") or "").strip().lower()
        include_inactive = request.query_params.get("include_inactive") == "true"
        if status_filter == "inactive":
            qs = qs.filter(is_active=False)
        elif status_filter == "all" or include_inactive:
            pass
        else:
            qs = qs.filter(is_active=True)
        if search := request.query_params.get("search"):
            qs = qs.filter(
                Q(display_name__icontains=search)
                | Q(phone__icontains=search)
                | Q(email__icontains=search)
                | Q(role_label__icontains=search)
                | Q(notes__icontains=search)
            )
        if role := request.query_params.get("role"):
            qs = qs.filter(role_label__iexact=role.strip())
        has_leads = request.query_params.get("has_leads")
        if has_leads == "true":
            qs = qs.filter(active_lead_count__gt=0)
        elif has_leads == "false":
            qs = qs.filter(active_lead_count=0)
        if client_id := request.query_params.get("client"):
            qs = qs.filter(
                attributions__client_id=client_id,
                attributions__is_active=True,
            ).distinct()
        if stage_id := request.query_params.get("stage"):
            qs = qs.filter(
                attributions__is_active=True,
                attributions__client__is_deleted=False,
                attributions__client__stage_id=stage_id,
            ).distinct()
        if channel_id := request.query_params.get("channel"):
            qs = qs.filter(
                attributions__is_active=True,
                attributions__client__is_deleted=False,
                attributions__client__lead_source_id=channel_id,
            ).distinct()
        first_call = (request.query_params.get("first_call") or "").strip().lower()
        if first_call == "yes":
            qs = qs.filter(
                attributions__is_active=True,
                attributions__client__is_deleted=False,
                attributions__client__first_call_completed=True,
            ).distinct()
        elif first_call == "no":
            qs = qs.filter(
                attributions__is_active=True,
                attributions__client__is_deleted=False,
                attributions__client__first_call_completed=False,
            ).distinct()
        return success_response(ser.LeadSourcePersonSerializer(qs, many=True).data)

    @extend_schema(
        tags=["lead-source"],
        summary="Create Lead Source person",
        request=ser.LeadSourcePersonWriteSerializer,
    )
    def post(self, request):
        serializer = ser.LeadSourcePersonWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        person = create_person(actor=request.user, data=serializer.validated_data, request=request)
        return success_response(
            ser.LeadSourcePersonSerializer(person).data,
            message="Lead Source person created",
            status_code=status.HTTP_201_CREATED,
        )


class LeadSourcePersonDetailView(APIView):
    permission_classes = [IsActiveCRMMember]

    @extend_schema(tags=["lead-source"], summary="Lead Source person detail + stats")
    def get(self, request, person_id):
        person = get_object_or_404(LeadSourcePerson, id=person_id)
        attributions = (
            LeadSourceAttribution.objects.filter(person=person, is_active=True, client__is_deleted=False)
            .select_related("client", "client__stage", "person")
        )
        return success_response(
            {
                "person": ser.LeadSourcePersonSerializer(person).data,
                "stats": person_stats(person),
                "attributions": ser.LeadSourceAttributionSerializer(attributions, many=True).data,
            }
        )

    @extend_schema(
        tags=["lead-source"],
        summary="Update Lead Source person",
        request=ser.LeadSourcePersonUpdateSerializer,
    )
    def patch(self, request, person_id):
        person = get_object_or_404(LeadSourcePerson, id=person_id)
        serializer = ser.LeadSourcePersonUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        person = update_person(
            actor=request.user,
            person=person,
            data=serializer.validated_data,
            request=request,
        )
        return success_response(
            ser.LeadSourcePersonSerializer(person).data,
            message="Lead Source person updated",
        )


class LeadSourcePersonLeadsView(APIView):
    permission_classes = [IsActiveCRMMember]

    @extend_schema(tags=["lead-source"], summary="Leads linked to this person")
    def get(self, request, person_id):
        person = get_object_or_404(LeadSourcePerson, id=person_id)
        client_ids = LeadSourceAttribution.objects.filter(
            person=person, is_active=True, client__is_deleted=False
        ).values_list("client_id", flat=True)
        qs = Client.objects.filter(id__in=client_ids).select_related("stage", "lead_source", "service")
        if stage := request.query_params.get("stage"):
            qs = qs.filter(stage_id=stage)
        if search := request.query_params.get("search"):
            qs = qs.filter(
                Q(client_name__icontains=search)
                | Q(primary_phone__icontains=search)
                | Q(primary_email__icontains=search)
            )
        return success_response(ClientListSerializer(qs, many=True).data)

    @extend_schema(
        tags=["lead-source"],
        summary="Assign a lead to this Lead Source person",
        request=ser.AssignLeadSerializer,
    )
    def post(self, request, person_id):
        person = get_object_or_404(LeadSourcePerson, id=person_id)
        serializer = ser.AssignLeadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        row = assign_lead_to_person(
            actor=request.user,
            person=person,
            client=serializer.validated_data["client"],
            note=serializer.validated_data.get("note", ""),
            request=request,
        )
        return success_response(
            ser.LeadSourceAttributionSerializer(row).data,
            message="Lead assigned to Lead Source person",
            status_code=status.HTTP_201_CREATED,
        )


class LeadSourceAssignPeopleView(APIView):
    """Assign multiple Lead Source people to one lead (Lead Source tab)."""

    permission_classes = [IsActiveCRMMember]

    @extend_schema(
        tags=["lead-source"],
        summary="Assign multiple Lead Source people to a lead",
        request=ser.AssignPersonToLeadSerializer,
    )
    def post(self, request):
        serializer = ser.AssignPersonToLeadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rows = assign_people_to_lead(
            actor=request.user,
            client=serializer.validated_data["client"],
            people=list(serializer.validated_data["people"]),
            note=serializer.validated_data.get("note", ""),
            request=request,
        )
        return success_response(
            ser.LeadSourceAttributionSerializer(rows, many=True).data,
            message="Lead Source people assigned",
            status_code=status.HTTP_201_CREATED,
        )


class LeadSourceAttributionDetailView(APIView):
    permission_classes = [IsActiveCRMMember]

    @extend_schema(
        tags=["lead-source"],
        summary="Remove Lead Source person from a lead",
        request=ser.RemoveAttributionSerializer,
    )
    def delete(self, request, attribution_id):
        row = get_object_or_404(
            LeadSourceAttribution.objects.select_related("person", "client"),
            id=attribution_id,
            is_active=True,
        )
        serializer = ser.RemoveAttributionSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        remove_attribution(
            actor=request.user,
            row=row,
            reason=serializer.validated_data.get("reason", ""),
            request=request,
        )
        return success_response(message="Lead Source person unlinked from lead")


class ClientLeadSourcePeopleView(APIView):
    """Read-only list of Lead Source people on a lead (for lead details)."""

    permission_classes = [IsActiveCRMMember]

    @extend_schema(tags=["lead-source"], summary="Lead Source people on a lead (read-only)")
    def get(self, request, client_id):
        client = get_object_or_404(Client, id=client_id, is_deleted=False)
        rows = LeadSourceAttribution.objects.filter(
            client=client, is_active=True
        ).select_related("person", "client", "client__stage")
        return success_response(ser.LeadSourceAttributionSerializer(rows, many=True).data)
