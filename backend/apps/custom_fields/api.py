from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView

from apps.audit.services import write_audit_log
from apps.crm.models import Client
from apps.custom_fields.models import CustomFieldDefinition, CustomFieldType, CustomFieldValue
from common.permissions import IsActiveCRMMember
from common.responses import success_response


class CustomFieldDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomFieldDefinition
        fields = (
            "id",
            "label",
            "key",
            "field_type",
            "is_required",
            "is_active",
            "display_order",
            "choices",
            "validation_rules",
            "show_on_initial_form",
            "show_on_post_first_call",
            "show_on_lead_details",
        )


class CustomFieldValueSerializer(serializers.ModelSerializer):
    key = serializers.CharField(source="definition.key", read_only=True)
    label = serializers.CharField(source="definition.label", read_only=True)

    class Meta:
        model = CustomFieldValue
        fields = ("id", "client", "definition", "key", "label", "value", "updated_at")


def validate_custom_value(definition: CustomFieldDefinition, value):
    if definition.is_required and (value is None or value == "" or value == []):
        raise ValidationError({definition.key: "This field is required."})
    if value is None or value == "":
        return value

    t = definition.field_type
    if t == CustomFieldType.NUMBER and not isinstance(value, int):
        try:
            value = int(value)
        except (TypeError, ValueError) as exc:
            raise ValidationError({definition.key: "Must be a number."}) from exc
    if t == CustomFieldType.DECIMAL:
        try:
            value = float(value)
        except (TypeError, ValueError) as exc:
            raise ValidationError({definition.key: "Must be a decimal."}) from exc
    if t == CustomFieldType.BOOLEAN and not isinstance(value, bool):
        if str(value).lower() in {"true", "1"}:
            value = True
        elif str(value).lower() in {"false", "0"}:
            value = False
        else:
            raise ValidationError({definition.key: "Must be boolean."})
    if t == CustomFieldType.DROPDOWN and definition.choices and value not in definition.choices:
        raise ValidationError({definition.key: "Invalid choice."})
    if t == CustomFieldType.MULTI_SELECT:
        if not isinstance(value, list):
            raise ValidationError({definition.key: "Must be a list."})
        if definition.choices and any(v not in definition.choices for v in value):
            raise ValidationError({definition.key: "Invalid choice in multi-select."})
    if t == CustomFieldType.EMAIL:
        serializers.EmailField().run_validation(value)
    return value


class DefinitionListView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request):
        qs = CustomFieldDefinition.objects.filter(is_active=True).order_by("display_order")
        return success_response(CustomFieldDefinitionSerializer(qs, many=True).data)


class CustomValueUpsertSerializer(serializers.Serializer):
    client = serializers.PrimaryKeyRelatedField(queryset=Client.objects.all())
    definition = serializers.PrimaryKeyRelatedField(
        queryset=CustomFieldDefinition.objects.filter(is_active=True)
    )
    value = serializers.JSONField(allow_null=True)


class CustomValueListUpsertView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request):
        qs = CustomFieldValue.objects.select_related("definition", "client")
        if client := request.query_params.get("client"):
            qs = qs.filter(client_id=client)
        return success_response(CustomFieldValueSerializer(qs, many=True).data)

    @transaction.atomic
    def post(self, request):
        ser = CustomValueUpsertSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        definition = ser.validated_data["definition"]
        value = validate_custom_value(definition, ser.validated_data.get("value"))
        obj, created = CustomFieldValue.objects.update_or_create(
            client=ser.validated_data["client"],
            definition=definition,
            defaults={"value": value},
        )
        write_audit_log(
            actor=request.user,
            action="custom_field_value_set",
            entity_type="CustomFieldValue",
            entity_id=obj.id,
            client=obj.client,
            new_values={"key": definition.key, "value": value},
            request=request,
        )
        return success_response(
            CustomFieldValueSerializer(obj).data,
            status_code=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
