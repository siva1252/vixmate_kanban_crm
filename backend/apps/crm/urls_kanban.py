from django.urls import path

from . import views

urlpatterns = [
    path("board/", views.KanbanBoardView.as_view(), name="kanban-board"),
    path("stages/", views.LeadStageListView.as_view(), name="kanban-stages"),
]
