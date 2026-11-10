"""Centralised audit service. All business mutations must use this."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from django.db import transaction

from common.utilities.request import get_client_ip, get_request_id, get_user_agent

from .models import AuditLog

logger = logging.getLogger(__name__)

SENSITIVE_KEYS = {
    "password",
    "password1",
    "password2",
    "old_password",
    "new_password",
    "otp",
    "code",
    "token",
    "secret",
    "authorization",
    "code_hash",
}


def _sanitize(values: dict | None) -> dict:
    if not values:
        return {}
    cleaned: dict[str, Any] = {}
    for key, value in values.items():
        if key.lower() in SENSITIVE_KEYS:
            continue
        if isinstance(value, UUID):
            cleaned[key] = str(value)
        else:
            cleaned[key] = value
    return cleaned


@transaction.atomic
def write_audit_log(
    *,
    actor=None,
    action: str,
    entity_type: str,
    entity_id: Any = "",
    client=None,
    old_values: dict | None = None,
    new_values: dict | None = None,
    description: str = "",
    reason: str = "",
    request=None,
) -> AuditLog:
    """
    Persist an append-only audit record.

    Failures are not silently suppressed: callers inside atomic blocks will
    roll back business changes if audit write fails.
    """
    try:
        return AuditLog.objects.create(
            actor=actor,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else "",
            client=client,
            old_values=_sanitize(old_values),
            new_values=_sanitize(new_values),
            description=description,
            reason=reason or "",
            ip_address=get_client_ip(request),
            request_id=get_request_id(request) or "",
            user_agent=get_user_agent(request),
        )
    except Exception:
        logger.exception(
            "Failed to write audit log action=%s entity=%s:%s",
            action,
            entity_type,
            entity_id,
        )
        raise
