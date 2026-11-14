"""Push CRM change events to every connected browser via Channels."""

from __future__ import annotations

import logging
from typing import Any

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

logger = logging.getLogger(__name__)

CRM_GROUP = "crm_live"


def broadcast_crm_change(
    *,
    entity: str,
    action: str,
    entity_id: Any = None,
    actor_id: Any = None,
) -> None:
    layer = get_channel_layer()
    if layer is None:
        return
    payload = {
        "entity": entity,
        "action": action,
        "id": str(entity_id) if entity_id is not None else None,
        "actor_id": str(actor_id) if actor_id is not None else None,
    }
    try:
        async_to_sync(layer.group_send)(
            CRM_GROUP,
            {"type": "crm.event", "payload": payload},
        )
    except Exception:
        logger.exception("Failed to broadcast crm change: %s %s", entity, action)


def schedule_crm_broadcast(
    *,
    entity: str,
    action: str,
    entity_id: Any = None,
    actor_id: Any = None,
) -> None:
    """Fire after the DB transaction commits so peers never see half-written data."""

    def _send() -> None:
        broadcast_crm_change(
            entity=entity,
            action=action,
            entity_id=entity_id,
            actor_id=actor_id,
        )

    transaction.on_commit(_send)
