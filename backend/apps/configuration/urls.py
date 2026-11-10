from django.urls import path

from . import views

urlpatterns = [
    path("", views.ConfigurationBundleView.as_view(), name="configuration-bundle"),
]
