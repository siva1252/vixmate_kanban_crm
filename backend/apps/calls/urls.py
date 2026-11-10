from django.urls import path

from .api import CallDetailView, CallListCreateView

urlpatterns = [
    path("", CallListCreateView.as_view(), name="calls-list-create"),
    path("<uuid:call_id>/", CallDetailView.as_view(), name="calls-detail"),
]
