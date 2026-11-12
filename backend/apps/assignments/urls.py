from django.urls import path

from . import views

urlpatterns = [
    path("responsibilities/", views.ResponsibilityTypeListView.as_view(), name="responsibilities"),
    path("working/", views.WorkingListCreateView.as_view(), name="working-list-create"),
    path("working/<uuid:working_id>/", views.WorkingDetailView.as_view(), name="working-detail"),
    path("", views.AssignmentListCreateView.as_view(), name="assignments-list-create"),
    path("reassign/", views.AssignmentReassignView.as_view(), name="assignments-reassign"),
    path("history/", views.AssignmentHistoryListView.as_view(), name="assignments-history"),
]
