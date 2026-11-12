from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import status
from rest_framework.views import APIView

from apps.contacts import serializers as ser
from apps.contacts.models import ContactPerson
from apps.contacts.services import create_contact, delete_contact, update_contact
from common.permissions import IsActiveCRMMember
from common.responses import success_response


class ContactListCreateView(APIView):
    permission_classes = [IsActiveCRMMember]

    @extend_schema(
        tags=["clients"],
        summary="List contacts",
        parameters=[
            OpenApiParameter("client", OpenApiTypes.UUID, OpenApiParameter.QUERY, required=False),
        ],
    )
    def get(self, request):
        qs = ContactPerson.objects.select_related("client")
        if client := request.query_params.get("client"):
            qs = qs.filter(client_id=client)
        return success_response(ser.ContactPersonSerializer(qs, many=True).data)

    @extend_schema(tags=["clients"], summary="Create contact", request=ser.ContactCreateSerializer)
    def post(self, request):
        serializer = ser.ContactCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        client = data.pop("client")
        contact = create_contact(actor=request.user, client=client, data=data, request=request)
        return success_response(
            ser.ContactPersonSerializer(contact).data,
            status_code=status.HTTP_201_CREATED,
            message="Contact created",
        )


class ContactDetailView(APIView):
    permission_classes = [IsActiveCRMMember]

    @extend_schema(tags=["clients"], summary="Get contact")
    def get(self, request, contact_id):
        contact = get_object_or_404(ContactPerson, id=contact_id)
        return success_response(ser.ContactPersonSerializer(contact).data)

    @extend_schema(tags=["clients"], summary="Update contact", request=ser.ContactCreateSerializer)
    def patch(self, request, contact_id):
        contact = get_object_or_404(ContactPerson, id=contact_id)
        serializer = ser.ContactCreateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        data.pop("client", None)
        contact = update_contact(actor=request.user, contact=contact, data=data, request=request)
        return success_response(ser.ContactPersonSerializer(contact).data, message="Contact updated")

    @extend_schema(tags=["clients"], summary="Delete contact", request=None)
    def delete(self, request, contact_id):
        contact = get_object_or_404(ContactPerson, id=contact_id)
        delete_contact(actor=request.user, contact=contact, request=request)
        return success_response(message="Contact deleted")
