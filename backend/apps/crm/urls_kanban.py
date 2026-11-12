from django.urls import path

from . import views

urlpatterns = [
    path("board/", views.KanbanBoardView.as_view(), name="kanban-board"),
    path("stages/", views.LeadStageListCreateView.as_view(), name="kanban-stages"),
    path("stages/reorder/", views.LeadStageReorderView.as_view(), name="kanban-stages-reorder"),
    path("stages/<uuid:stage_id>/", views.LeadStageDetailView.as_view(), name="kanban-stages-detail"),
]
