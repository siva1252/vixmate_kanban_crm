from django.contrib import admin

from .models import AvailabilityHistory, TeamMember


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ("display_name", "user", "job_title", "availability_status", "is_active")
    list_filter = ("is_active", "availability_status")
    search_fields = ("display_name", "user__email", "job_title")
    autocomplete_fields = ("user",)


@admin.register(AvailabilityHistory)
class AvailabilityHistoryAdmin(admin.ModelAdmin):
    list_display = ("team_member", "previous_status", "new_status", "changed_by", "changed_at")
    list_filter = ("new_status",)
    search_fields = ("team_member__display_name",)
    readonly_fields = (
        "team_member",
        "previous_status",
        "new_status",
        "changed_by",
        "changed_at",
        "notes",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
