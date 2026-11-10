from django.contrib import admin

from .models import Client, LeadStage, LeadStageHistory


@admin.register(LeadStage)
class LeadStageAdmin(admin.ModelAdmin):
    list_display = ("display_order", "name", "slug", "is_terminal", "is_active")
    list_filter = ("is_active", "is_terminal")
    search_fields = ("name", "slug")
    ordering = ("display_order",)
    prepopulated_fields = {"slug": ("name",)}


class LeadStageHistoryInline(admin.TabularInline):
    model = LeadStageHistory
    extra = 0
    readonly_fields = ("previous_stage", "new_stage", "changed_by", "changed_at")
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = (
        "client_name",
        "primary_phone",
        "stage",
        "lead_source",
        "service",
        "first_call_completed",
        "is_deleted",
        "updated_at",
    )
    list_filter = (
        "stage",
        "lead_source",
        "service",
        "first_call_completed",
        "is_deleted",
    )
    search_fields = (
        "client_name",
        "primary_phone",
        "alternate_phone",
        "primary_email",
        "alternate_email",
        "company_name",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "deleted_at",
        "deleted_by",
        "deletion_reason",
        "first_call_completed_at",
        "first_call_completed_by",
    )
    autocomplete_fields = ("lead_source", "service", "industry", "stage", "created_by")
    inlines = [LeadStageHistoryInline]


@admin.register(LeadStageHistory)
class LeadStageHistoryAdmin(admin.ModelAdmin):
    list_display = ("client", "previous_stage", "new_stage", "changed_by", "changed_at")
    list_filter = ("new_stage",)
    search_fields = ("client__client_name",)
    readonly_fields = ("client", "previous_stage", "new_stage", "changed_by", "changed_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
