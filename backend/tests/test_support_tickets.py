from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.members.models import Member
from apps.support.models import SupportTicket, SupportTicketStatus
from apps.workspaces.models import WorkspaceMembership
from apps.workspaces.services import create_workspace_for_owner, ensure_workspace_rbac


pytest.importorskip("pytest_django")


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.mark.django_db
def test_creator_can_create_support_ticket_with_number_and_quota(django_user_model):
    creator = django_user_model.objects.create_user(username="creator-ticket@example.com", email="creator-ticket@example.com", password="pass")
    workspace = create_workspace_for_owner(owner=creator, name="Support Creator", organization_type="association")
    response = client_for(creator).post(
        "/api/v1/support/tickets/",
        {"subject": "Probleme ajout membre", "description": "Le bouton ne fonctionne pas depuis mon espace.", "category": "TECHNICAL"},
        format="json",
        HTTP_X_WORKSPACE=workspace.slug,
    )

    assert response.status_code == 201
    assert response.data["ticket_number"].startswith(f"NOVEX-{timezone.localdate().year}-")
    assert response.data["status"] == SupportTicketStatus.PENDING

    list_response = client_for(creator).get("/api/v1/support/tickets/", HTTP_X_WORKSPACE=workspace.slug)

    assert list_response.status_code == 200
    assert list_response.data["quota"]["used"] == 1
    assert list_response.data["quota"]["remaining"] == 4


@pytest.mark.django_db
def test_support_ticket_quota_blocks_sixth_ticket(django_user_model):
    creator = django_user_model.objects.create_user(username="quota@example.com", email="quota@example.com", password="pass")
    workspace = create_workspace_for_owner(owner=creator, name="Quota Support", organization_type="association")
    client = client_for(creator)

    for index in range(5):
      response = client.post("/api/v1/support/tickets/", {"subject": f"Ticket {index}", "description": "Description complete du ticket.", "category": "QUESTION"}, format="json", HTTP_X_WORKSPACE=workspace.slug)
      assert response.status_code == 201

    blocked = client.post("/api/v1/support/tickets/", {"subject": "Ticket 6", "description": "Description complete du ticket.", "category": "QUESTION"}, format="json", HTTP_X_WORKSPACE=workspace.slug)

    assert blocked.status_code == 400
    assert "limite de 5 tickets" in blocked.data["message"]


@pytest.mark.django_db
def test_support_ticket_quota_renews_each_month(django_user_model):
    creator = django_user_model.objects.create_user(username="month@example.com", email="month@example.com", password="pass")
    workspace = create_workspace_for_owner(owner=creator, name="Monthly Support", organization_type="association")
    client = client_for(creator)
    for index in range(5):
        response = client.post("/api/v1/support/tickets/", {"subject": f"Ancien {index}", "description": "Description complete du ticket.", "category": "OTHER"}, format="json", HTTP_X_WORKSPACE=workspace.slug)
        assert response.status_code == 201
    SupportTicket.objects.filter(workspace=workspace).update(created_at=timezone.now() - timedelta(days=40))

    response = client.post("/api/v1/support/tickets/", {"subject": "Nouveau mois", "description": "Description complete du ticket.", "category": "OTHER"}, format="json", HTTP_X_WORKSPACE=workspace.slug)

    assert response.status_code == 201


@pytest.mark.django_db
def test_member_cannot_create_or_read_creator_support_tickets(django_user_model):
    creator = django_user_model.objects.create_user(username="support-owner@example.com", email="support-owner@example.com", password="pass")
    user = django_user_model.objects.create_user(username="support-member@example.com", email="support-member@example.com", password="pass")
    workspace = create_workspace_for_owner(owner=creator, name="Member Blocked", organization_type="association")
    roles = ensure_workspace_rbac(workspace)
    Member.objects.create(workspace=workspace, linked_user=user, membership_number="SUP-001", first_name="Awa", last_name="Kone", email=user.email)
    WorkspaceMembership.objects.create(user=user, workspace=workspace, role=roles["MEMBER"], status=WorkspaceMembership.Status.ACTIVE)
    client = client_for(user)

    list_response = client.get("/api/v1/support/tickets/", HTTP_X_WORKSPACE=workspace.slug)
    create_response = client.post("/api/v1/support/tickets/", {"subject": "Test", "description": "Description complete.", "category": "OTHER"}, format="json", HTTP_X_WORKSPACE=workspace.slug)

    assert list_response.status_code == 403
    assert create_response.status_code == 403


@pytest.mark.django_db
def test_creator_cannot_read_other_workspace_ticket(django_user_model):
    first = django_user_model.objects.create_user(username="first@example.com", email="first@example.com", password="pass")
    second = django_user_model.objects.create_user(username="second@example.com", email="second@example.com", password="pass")
    first_workspace = create_workspace_for_owner(owner=first, name="First Support", organization_type="association")
    second_workspace = create_workspace_for_owner(owner=second, name="Second Support", organization_type="association")
    created = client_for(first).post("/api/v1/support/tickets/", {"subject": "Secret", "description": "Description complete.", "category": "OTHER"}, format="json", HTTP_X_WORKSPACE=first_workspace.slug)

    response = client_for(second).get(f"/api/v1/support/tickets/{created.data['id']}/", HTTP_X_WORKSPACE=second_workspace.slug)

    assert response.status_code == 404


@pytest.mark.django_db
def test_super_admin_can_view_and_update_ticket_status(django_user_model):
    creator = django_user_model.objects.create_user(username="status-creator@example.com", email="status-creator@example.com", password="pass")
    admin = django_user_model.objects.create_superuser(username="admin-status", email="admin-status@novex.local", password="1234567890")
    workspace = create_workspace_for_owner(owner=creator, name="Status Support", organization_type="association")
    created = client_for(creator).post("/api/v1/support/tickets/", {"subject": "A traiter", "description": "Description complete.", "category": "ACCOUNT"}, format="json", HTTP_X_WORKSPACE=workspace.slug)

    admin_client = client_for(admin)
    list_response = admin_client.get("/api/v1/admin/tickets/?page_size=20")
    progress = admin_client.patch(f"/api/v1/admin/tickets/{created.data['id']}/status/", {"status": "IN_PROGRESS"}, format="json")
    resolved = admin_client.patch(f"/api/v1/admin/tickets/{created.data['id']}/status/", {"status": "RESOLVED"}, format="json")

    assert list_response.status_code == 200
    assert list_response.data["stats"]["total"] >= 1
    assert progress.status_code == 200
    assert progress.data["taken_at"]
    assert progress.data["taken_by_name"]
    assert resolved.status_code == 200
    assert resolved.data["resolved_at"]
    assert resolved.data["resolved_by_name"]
