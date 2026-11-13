from django.db import connection
from django.http import JsonResponse
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView


class HealthView(APIView):
    """Public smoke check for Jenkins / load balancers."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        db_ok = False
        try:
            connection.ensure_connection()
            db_ok = True
        except Exception:
            db_ok = False
        status = 200 if db_ok else 503
        return JsonResponse(
            {"success": db_ok, "service": "viximate-crm", "database": "ok" if db_ok else "error"},
            status=status,
        )
