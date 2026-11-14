"""Authenticated WebSocket consumer for live CRM updates."""

from __future__ import annotations

import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

from apps.realtime.broadcast import CRM_GROUP

logger = logging.getLogger(__name__)
User = get_user_model()


class CrmLiveConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = await self._authenticate()
        if user is None or not getattr(user, "is_authenticated", False):
            await self.close(code=4401)
            return
        if not getattr(user, "is_active", False):
            await self.close(code=4403)
            return

        self.user = user
        await self.channel_layer.group_add(CRM_GROUP, self.channel_name)
        await self.accept()
        await self.send_json({"type": "connected", "ok": True})

    async def disconnect(self, code):
        try:
            await self.channel_layer.group_discard(CRM_GROUP, self.channel_name)
        except Exception:
            pass

    async def crm_event(self, event):
        payload = event.get("payload") or {}
        await self.send_json({"type": "crm.changed", **payload})

    async def _authenticate(self):
        query = parse_qs(self.scope.get("query_string", b"").decode())
        raw = (query.get("token") or [None])[0]
        if not raw:
            headers = dict(self.scope.get("headers") or [])
            auth = headers.get(b"authorization", b"").decode()
            if auth.lower().startswith("bearer "):
                raw = auth[7:].strip()
        if not raw:
            return AnonymousUser()
        return await self._user_from_token(raw)

    @database_sync_to_async
    def _user_from_token(self, raw: str):
        try:
            token = AccessToken(raw)
            user_id = token.get("user_id")
            if not user_id:
                return AnonymousUser()
            return User.objects.filter(id=user_id, is_active=True).first() or AnonymousUser()
        except (InvalidToken, TokenError, Exception):
            return AnonymousUser()
