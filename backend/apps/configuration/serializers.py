from rest_framework import serializers

from apps.configuration.models import Industry, LeadSource, Service, SystemSetting


class LeadSourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeadSource
        fields = ("id", "name", "slug", "display_order", "is_active", "allows_other_text")


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ("id", "name", "slug", "display_order", "is_active", "allows_other_text")


class IndustrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Industry
        fields = ("id", "name", "slug", "display_order", "is_active", "allows_other_text")


class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = ("id", "key", "value", "description", "is_active")
