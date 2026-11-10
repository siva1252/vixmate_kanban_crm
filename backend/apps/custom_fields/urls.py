from django.urls import path

from .api import CustomValueListUpsertView, DefinitionListView

urlpatterns = [
    path("definitions/", DefinitionListView.as_view(), name="custom-field-definitions"),
    path("values/", CustomValueListUpsertView.as_view(), name="custom-field-values"),
]
