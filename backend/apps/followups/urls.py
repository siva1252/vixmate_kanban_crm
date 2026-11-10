from django.urls import path

from .api import FollowUpDetailView, FollowUpListCreateView

urlpatterns = [
    path("", FollowUpListCreateView.as_view(), name="followups-list-create"),
    path("<uuid:followup_id>/", FollowUpDetailView.as_view(), name="followups-detail"),
]
