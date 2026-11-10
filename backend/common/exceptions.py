"""Consistent API error responses."""

from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return Response(
            {
                "success": False,
                "error": {
                    "code": "server_error",
                    "message": "An unexpected error occurred.",
                    "details": {},
                },
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    details = response.data
    message = "Request failed."
    if isinstance(details, dict):
        if "detail" in details:
            message = str(details["detail"])
        elif len(details) == 1:
            key = next(iter(details))
            value = details[key]
            if isinstance(value, list) and value:
                message = f"{key}: {value[0]}"
            else:
                message = f"{key}: {value}"
    elif isinstance(details, list) and details:
        message = str(details[0])

    response.data = {
        "success": False,
        "error": {
            "code": getattr(exc, "default_code", "error"),
            "message": message,
            "details": details,
        },
    }
    return response
