from django.contrib import admin

from apps.lead_source.models import LeadSourceAttribution, LeadSourcePerson


@admin.register(LeadSourcePerson)
class LeadSourcePersonAdmin(admin.ModelAdmin):
    list_display = ("display_name", "phone", "email", "role_label", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("display_name", "phone", "email", "role_label")
    readonly_fields = ("id", "created_at", "updated_at", "created_by")


@admin.register(LeadSourceAttribution)
class LeadSourceAttributionAdmin(admin.ModelAdmin):
    list_display = ("client", "person", "note", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("client__client_name", "person__display_name")
    readonly_fields = ("id", "created_at", "updated_at", "assigned_by")
