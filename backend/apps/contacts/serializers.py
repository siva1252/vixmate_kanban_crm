from rest_framework import serializers

from apps.contacts.models import ContactPerson
from apps.crm.models import Client


class ContactPersonSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactPerson
        fields = (
            "id",
            "client",
            "name",
            "designation",
            "primary_phone",
            "alternate_phone",
            "primary_email",
            "alternate_email",
            "notes",
            "created_by",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_by", "created_at", "updated_at")


class ContactCreateSerializer(serializers.ModelSerializer):
    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all())

    class Meta:
        model = ContactPerson
        fields = (
            "client",
            "name",
            "designation",
            "primary_phone",
            "alternate_phone",
            "primary_email",
            "alternate_email",
            "notes",
        )
