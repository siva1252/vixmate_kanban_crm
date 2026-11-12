from django.urls import path

from . import views

urlpatterns = [
    path("", views.LeadSourcePersonListCreateView.as_view(), name="lead-source-list-create"),
    path("assign/", views.LeadSourceAssignPeopleView.as_view(), name="lead-source-assign-people"),
    path(
        "attributions/<uuid:attribution_id>/",
        views.LeadSourceAttributionDetailView.as_view(),
        name="lead-source-attribution-detail",
    ),
    path(
        "by-client/<uuid:client_id>/",
        views.ClientLeadSourcePeopleView.as_view(),
        name="lead-source-by-client",
    ),
    path("<uuid:person_id>/", views.LeadSourcePersonDetailView.as_view(), name="lead-source-detail"),
    path(
        "<uuid:person_id>/leads/",
        views.LeadSourcePersonLeadsView.as_view(),
        name="lead-source-leads",
    ),
]
