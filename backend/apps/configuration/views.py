from rest_framework.views import APIView

from apps.configuration import serializers as ser
from apps.configuration.models import Industry, LeadSource, Service, SystemSetting
from common.permissions import IsActiveCRMMember
from common.responses import success_response


class ConfigurationBundleView(APIView):
    permission_classes = [IsActiveCRMMember]

    def get(self, request):
        return success_response(
            {
                "lead_sources": ser.LeadSourceSerializer(
                    LeadSource.objects.filter(is_active=True), many=True
                ).data,
                "services": ser.ServiceSerializer(
                    Service.objects.filter(is_active=True), many=True
                ).data,
                "industries": ser.IndustrySerializer(
                    Industry.objects.filter(is_active=True), many=True
                ).data,
                "settings": ser.SystemSettingSerializer(
                    SystemSetting.objects.filter(is_active=True), many=True
                ).data,
            }
        )
