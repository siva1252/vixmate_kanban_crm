from django.urls import path

from . import views

urlpatterns = [
    path("", views.ClientListCreateView.as_view(), name="clients-list-create"),
    path("<uuid:client_id>/", views.ClientDetailView.as_view(), name="clients-detail"),
    path("<uuid:client_id>/restore/", views.ClientRestoreView.as_view(), name="clients-restore"),
    path(
        "<uuid:client_id>/first-call/",
        views.ClientFirstCallView.as_view(),
        name="clients-first-call",
    ),
    path(
        "<uuid:client_id>/stage/",
        views.ClientStageMoveView.as_view(),
        name="clients-stage-move",
    ),
    path(
        "<uuid:client_id>/stage-history/",
        views.ClientStageHistoryView.as_view(),
        name="clients-stage-history",
    ),
]
