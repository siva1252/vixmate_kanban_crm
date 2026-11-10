import pytest
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from apps.accounts.models import ApprovedEmail, User
from apps.accounts.services.auth import create_team_user
from apps.configuration.models import LeadSource, Service
from apps.crm.models import Client, LeadStage, LeadStageHistory


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def member(db):
    admin = User.objects.create_superuser(
        email="admin@viximate.local",
        password="AdminPass123!",
        full_name="Admin",
    )
    ApprovedEmail.objects.create(email=admin.email, is_active=True)
    return create_team_user(
        actor=admin,
        email="krishna@viximate.local",
        full_name="Krishna",
        password="MemberPass123!",
    )


@pytest.fixture
def auth_api(api, member):
    token = Token.objects.create(user=member)
    api.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return api


@pytest.fixture
def config(db):
    from django.core.management import call_command

    call_command("seed_configuration")
    return {
        "source": LeadSource.objects.get(slug="linkedin"),
        "other_source": LeadSource.objects.get(slug="other"),
        "service": Service.objects.get(slug="web-development"),
        "other_service": Service.objects.get(slug="other"),
        "stage": LeadStage.objects.get(slug="new-lead"),
        "qualified": LeadStage.objects.get(slug="qualified"),
    }


@pytest.mark.django_db
def test_create_client_basic(auth_api, config, member):
    response = auth_api.post(
        "/api/clients/",
        {
            "client_name": "Acme Corp",
            "primary_phone": "9876543210",
            "lead_source": str(config["source"].id),
            "service": str(config["service"].id),
            "first_call_completed": False,
        },
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED
    client = Client.objects.get(client_name="Acme Corp")
    assert client.stage.slug == "new-lead"
    assert client.first_call_completed is False
    assert LeadStageHistory.objects.filter(client=client).exists()


@pytest.mark.django_db
def test_other_source_requires_text(auth_api, config):
    response = auth_api.post(
        "/api/clients/",
        {
            "client_name": "Beta",
            "primary_phone": "111",
            "lead_source": str(config["other_source"].id),
            "service": str(config["service"].id),
            "first_call_completed": False,
        },
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_stage_change_creates_history(auth_api, config):
    create = auth_api.post(
        "/api/clients/",
        {
            "client_name": "Gamma",
            "primary_phone": "222",
            "lead_source": str(config["source"].id),
            "service": str(config["service"].id),
            "first_call_completed": False,
        },
        format="json",
    )
    client_id = create.data["data"]["id"]
    move = auth_api.post(
        f"/api/clients/{client_id}/stage/",
        {"stage": str(config["qualified"].id)},
        format="json",
    )
    assert move.status_code == status.HTTP_200_OK
    assert LeadStageHistory.objects.filter(client_id=client_id).count() == 2


@pytest.mark.django_db
def test_soft_delete_requires_reason(auth_api, config):
    create = auth_api.post(
        "/api/clients/",
        {
            "client_name": "Delta",
            "primary_phone": "333",
            "lead_source": str(config["source"].id),
            "service": str(config["service"].id),
            "first_call_completed": False,
        },
        format="json",
    )
    client_id = create.data["data"]["id"]
    bad = auth_api.delete(f"/api/clients/{client_id}/", data={}, format="json")
    assert bad.status_code == status.HTTP_400_BAD_REQUEST
    ok = auth_api.delete(
        f"/api/clients/{client_id}/",
        data={"reason": "Duplicate lead"},
        format="json",
    )
    assert ok.status_code == status.HTTP_200_OK
    assert Client.objects.filter(id=client_id).count() == 0
    assert Client.all_objects.get(id=client_id).is_deleted is True


@pytest.mark.django_db
def test_first_call_workflow(auth_api, config):
    create = auth_api.post(
        "/api/clients/",
        {
            "client_name": "Epsilon",
            "primary_phone": "444",
            "lead_source": str(config["source"].id),
            "service": str(config["service"].id),
            "first_call_completed": False,
        },
        format="json",
    )
    client_id = create.data["data"]["id"]
    done = auth_api.post(
        f"/api/clients/{client_id}/first-call/",
        {
            "first_call_notes": "Discussed requirements",
            "estimated_deal_value": "50000.00",
        },
        format="json",
    )
    assert done.status_code == status.HTTP_200_OK
    client = Client.objects.get(id=client_id)
    assert client.first_call_completed is True
    assert client.call_history.filter(is_first_call=True).exists()
