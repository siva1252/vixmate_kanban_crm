from django.urls import path

from . import views

urlpatterns = [
    path("", views.ActivityLogListView.as_view(), name="activity-list"),
]
