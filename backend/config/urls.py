"""Root URL configuration for Viximate CRM API."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/team/", include("apps.team.urls")),
    path("api/lead-source/", include("apps.lead_source.urls")),
    path("api/clients/", include("apps.crm.urls_clients")),
    path("api/kanban/", include("apps.crm.urls_kanban")),
    path("api/assignments/", include("apps.assignments.urls")),
    path("api/contacts/", include("apps.contacts.urls")),
    path("api/calls/", include("apps.calls.urls")),
    path("api/tasks/", include("apps.tasks.urls")),
    path("api/meetings/", include("apps.meetings.urls")),
    path("api/comments/", include("apps.comments.urls")),
    path("api/followups/", include("apps.followups.urls")),
    path("api/attachments/", include("apps.attachments.urls")),
    path("api/activity/", include("apps.audit.urls")),
    path("api/custom-fields/", include("apps.custom_fields.urls")),
    path("api/configuration/", include("apps.configuration.urls")),
    path("api/dashboard/", include("apps.crm.urls_dashboard")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

admin.site.site_header = "Viximate CRM Administration"
admin.site.site_title = "Viximate CRM"
admin.site.index_title = "Central Configuration"
