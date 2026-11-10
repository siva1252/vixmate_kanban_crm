from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = (
        "timestamp",
        "actor",
        "action",
        "entity_type",
        "entity_id",
        "client",
        "reason",
    )
    list_filter = ("action", "entity_type", "timestamp")
    search_fields = ("description", "entity_id", "reason", "actor__email", "request_id")
    readonly_fields = (
        "id",
        "actor",
        "action",
        "entity_type",
        "entity_id",
        "client",
        "old_values",
        "new_values",
        "description",
        "reason",
        "timestamp",
        "ip_address",
        "request_id",
        "user_agent",
    )
    date_hierarchy = "timestamp"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
