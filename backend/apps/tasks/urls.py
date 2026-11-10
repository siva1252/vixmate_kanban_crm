from django.urls import path

from .api import TaskDetailView, TaskListCreateView

urlpatterns = [
    path("", TaskListCreateView.as_view(), name="tasks-list-create"),
    path("<uuid:task_id>/", TaskDetailView.as_view(), name="tasks-detail"),
]
