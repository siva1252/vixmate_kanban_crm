from django.urls import path

from .api import MeetingDetailView, MeetingListCreateView

urlpatterns = [
    path("", MeetingListCreateView.as_view(), name="meetings-list-create"),
    path("<uuid:meeting_id>/", MeetingDetailView.as_view(), name="meetings-detail"),
]
