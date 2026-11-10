from django.urls import path

from . import views

urlpatterns = [
    path("", views.ContactListCreateView.as_view(), name="contacts-list-create"),
    path("<uuid:contact_id>/", views.ContactDetailView.as_view(), name="contacts-detail"),
]
