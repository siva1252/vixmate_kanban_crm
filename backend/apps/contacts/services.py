from django.db import transaction

from apps.audit.services import write_audit_log
from apps.contacts.models import ContactPerson


def _snap(c: ContactPerson) -> dict:
    return {
        "name": c.name,
        "designation": c.designation,
        "primary_phone": c.primary_phone,
        "primary_email": c.primary_email,
    }


@transaction.atomic
def create_contact(*, actor, client, data, request=None):
    contact = ContactPerson.objects.create(client=client, created_by=actor, **data)
    write_audit_log(
        actor=actor,
        action="contact_created",
        entity_type="ContactPerson",
        entity_id=contact.id,
        client=client,
        new_values=_snap(contact),
        request=request,
    )
    return contact


@transaction.atomic
def update_contact(*, actor, contact, data, request=None):
    old = _snap(contact)
    for k, v in data.items():
        setattr(contact, k, v)
    contact.save()
    write_audit_log(
        actor=actor,
        action="contact_updated",
        entity_type="ContactPerson",
        entity_id=contact.id,
        client=contact.client,
        old_values=old,
        new_values=_snap(contact),
        request=request,
    )
    return contact


@transaction.atomic
def delete_contact(*, actor, contact, request=None):
    old = _snap(contact)
    client = contact.client
    cid = contact.id
    contact.delete()
    write_audit_log(
        actor=actor,
        action="contact_deleted",
        entity_type="ContactPerson",
        entity_id=cid,
        client=client,
        old_values=old,
        request=request,
    )
