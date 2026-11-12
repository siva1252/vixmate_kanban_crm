"""drf-spectacular hooks — inject real seeded IDs into Swagger examples."""

from __future__ import annotations


def inject_seeded_client_example(result, generator, request, public):
    """Replace Swagger fake UUIDs with real lead_source / service / industry IDs."""
    try:
        from apps.configuration.models import Industry, LeadSource, Service

        source = LeadSource.objects.filter(is_active=True).order_by("display_order").first()
        service = Service.objects.filter(is_active=True).order_by("display_order").first()
        industry = Industry.objects.filter(is_active=True).order_by("display_order").first()
    except Exception:
        return result

    if source is None or service is None:
        return result

    example = {
        "client_name": "Swagger Test Lead",
        "primary_phone": "9888777666",
        "primary_email": "swagger@example.com",
        "alternate_phone": "",
        "alternate_email": "",
        "lead_source": str(source.id),
        "lead_source_other": "",
        "service": str(service.id),
        "service_other": "",
        "first_call_completed": False,
        "industry": str(industry.id) if industry else None,
    }

    post = result.get("paths", {}).get("/api/clients/", {}).get("post")
    if not post:
        return result

    content = (
        post.get("requestBody", {})
        .get("content", {})
        .get("application/json")
    )
    if not content:
        return result

    content["examples"] = {
        "SeededConfig": {
            "summary": "Uses real seeded lead_source / service / industry IDs",
            "value": example,
        }
    }
    # Also set as default example value when Try it out opens
    content["example"] = example
    return result
