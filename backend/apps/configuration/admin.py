from django.contrib import admin

from .models import Industry, LeadSource, Service, SystemSetting


class ConfigurableAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "display_order", "is_active", "allows_other_text")
    list_filter = ("is_active", "allows_other_text")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("display_order", "name")


@admin.register(LeadSource)
class LeadSourceAdmin(ConfigurableAdmin):
    pass


@admin.register(Service)
class ServiceAdmin(ConfigurableAdmin):
    pass


@admin.register(Industry)
class IndustryAdmin(ConfigurableAdmin):
    pass


@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    list_display = ("key", "is_active", "updated_at")
    search_fields = ("key", "description")
    list_filter = ("is_active",)
