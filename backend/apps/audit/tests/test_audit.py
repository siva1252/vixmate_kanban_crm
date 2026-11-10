import pytest

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.audit.services import write_audit_log


@pytest.mark.django_db
def test_audit_log_append_only():
    user = User.objects.create_user(
        email="auditor@viximate.local",
        password="AuditPass123!",
        full_name="Auditor",
    )
    log = write_audit_log(
        actor=user,
        action="test_action",
        entity_type="Test",
        entity_id="1",
        description="immutable",
    )
    with pytest.raises(PermissionError):
        log.description = "changed"
        log.save()
    with pytest.raises(PermissionError):
        log.delete()
    assert AuditLog.objects.filter(id=log.id).exists()
