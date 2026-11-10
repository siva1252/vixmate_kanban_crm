from rest_framework.exceptions import ValidationError


def require_reason(reason: str | None, *, field: str = "reason") -> str:
    cleaned = (reason or "").strip()
    if not cleaned:
        raise ValidationError({field: "A reason is required for this action."})
    if len(cleaned) < 3:
        raise ValidationError({field: "Reason must be at least 3 characters."})
    return cleaned
