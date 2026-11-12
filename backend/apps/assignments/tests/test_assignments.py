import pytest
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import ApprovedEmail, User
from apps.accounts.services.auth import create_team_user
from apps.assignments.models import AssignmentHistory, LeadAssignment, ResponsibilityType
from apps.configuration.models import LeadSource, Service
from apps.crm.models import Client, LeadStage


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def setup(db):
    from django.core.management import call_command

    call_command("seed_configuration")
    admin = User.objects.create_superuser(
        email="admin@viximate.local",
        password="AdminPass123!",
        full_name="Admin",
    )
    ApprovedEmail.objects.create(email=admin.email, is_active=True)
    siva = create_team_user(
        actor=admin,
        email="siva@viximate.local",
        full_name="Siva",
        password="MemberPass123!",
    )
    krishna = create_team_user(
        actor=admin,
        email="krishna@viximate.local",
        full_name="Krishna",
        password="MemberPass123!",
    )
    client = Client.objects.create(
        client_name="Assign Co",
        primary_phone="9000000000",
        lead_source=LeadSource.objects.first(),
        service=Service.objects.first(),
        stage=LeadStage.objects.get(slug="new-lead"),
        created_by=siva,
    )
    return {
        "admin": admin,
        "siva": siva,
        "krishna": krishna,
        "client": client,
        "resp": ResponsibilityType.objects.get(slug="technical-management"),
    }


@pytest.fixture
def auth_api(api, setup):
    access = str(RefreshToken.for_user(setup["siva"]).access_token)
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    return api


@pytest.mark.django_db
def test_assign_and_reassign_requires_reason(auth_api, setup):
    assign = auth_api.post(
        "/api/assignments/",
        {
            "client": str(setup["client"].id),
            "responsibility_type": str(setup["resp"].id),
            "team_member": str(setup["siva"].team_member.id),
        },
        format="json",
    )
    assert assign.status_code == status.HTTP_201_CREATED
    assert LeadAssignment.objects.filter(is_active=True).count() == 1

    bad = auth_api.post(
        "/api/assignments/reassign/",
        {
            "client": str(setup["client"].id),
            "responsibility_type": str(setup["resp"].id),
            "previous_member": str(setup["siva"].team_member.id),
            "new_member": str(setup["krishna"].team_member.id),
            "reason": "",
        },
        format="json",
    )
    assert bad.status_code == status.HTTP_400_BAD_REQUEST

    ok = auth_api.post(
        "/api/assignments/reassign/",
        {
            "client": str(setup["client"].id),
            "responsibility_type": str(setup["resp"].id),
            "previous_member": str(setup["siva"].team_member.id),
            "new_member": str(setup["krishna"].team_member.id),
            "reason": "Workload distribution",
        },
        format="json",
    )
    assert ok.status_code == status.HTTP_200_OK
    assert AssignmentHistory.objects.filter(reason="Workload distribution").exists()
    assert (
        LeadAssignment.objects.filter(
            team_member=setup["krishna"].team_member, is_active=True
        ).count()
        == 1
    )
