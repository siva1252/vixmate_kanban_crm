"""Request metadata helpers for audit logging."""

from __future__ import annotations


def get_client_ip(request) -> str | None:
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def get_user_agent(request) -> str:
    if request is None:
        return ""
    return request.META.get("HTTP_USER_AGENT", "")[:500]


def get_request_id(request) -> str | None:
    if request is None:
        return None
    return getattr(request, "request_id", None) or request.META.get("HTTP_X_REQUEST_ID")
