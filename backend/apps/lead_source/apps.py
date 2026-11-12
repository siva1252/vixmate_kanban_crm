from django.apps import AppConfig


class LeadSourceConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.lead_source"
    label = "lead_source"
    verbose_name = "Lead Source (external people)"
