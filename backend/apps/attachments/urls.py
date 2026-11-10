from django.urls import path

from .api import AttachmentDeleteView, AttachmentDownloadView, AttachmentListCreateView

urlpatterns = [
    path("", AttachmentListCreateView.as_view(), name="attachments-list-create"),
    path(
        "<uuid:attachment_id>/download/",
        AttachmentDownloadView.as_view(),
        name="attachments-download",
    ),
    path("<uuid:attachment_id>/", AttachmentDeleteView.as_view(), name="attachments-delete"),
]
