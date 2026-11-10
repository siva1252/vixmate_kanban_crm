from django.urls import path

from . import views

urlpatterns = [
    path("", views.TeamMemberListView.as_view(), name="team-list"),
    path("<uuid:member_id>/", views.TeamMemberDetailView.as_view(), name="team-detail"),
    path(
        "<uuid:member_id>/availability/",
        views.TeamAvailabilityUpdateView.as_view(),
        name="team-availability",
    ),
    path(
        "<uuid:member_id>/availability/history/",
        views.TeamAvailabilityHistoryView.as_view(),
        name="team-availability-history",
    ),
]
