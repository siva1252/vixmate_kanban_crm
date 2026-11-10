from django.urls import path

from . import views

urlpatterns = [
    path("responsibilities/", views.ResponsibilityTypeListView.as_view(), name="responsibilities"),
    path("", views.AssignmentListCreateView.as_view(), name="assignments-list-create"),
    path("reassign/", views.AssignmentReassignView.as_view(), name="assignments-reassign"),
    path("history/", views.AssignmentHistoryListView.as_view(), name="assignments-history"),
]
