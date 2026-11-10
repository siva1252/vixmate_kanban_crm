from django.urls import path

from .api import CommentDetailView, CommentListCreateView

urlpatterns = [
    path("", CommentListCreateView.as_view(), name="comments-list-create"),
    path("<uuid:comment_id>/", CommentDetailView.as_view(), name="comments-detail"),
]
