from django.urls import path

from apps.realtime.consumers import CrmLiveConsumer

websocket_urlpatterns = [
    path("ws/crm/", CrmLiveConsumer.as_asgi()),
]
