from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from apps.contributions.models import Contribution
from apps.contributions.services import create_campaign
from apps.members.models import Member
from apps.workspaces.models import RolePermission, Workspace, WorkspaceMembership
from apps.workspaces.services import ensure_workspace_rbac, create_workspace_for_owner


pytest.importorskip("pytest_django")


def authenticated_client(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.mark.django_db
def test_creator_membership_gets_full_workspace_access(django_user_model):
    owner = django_user_model.objects.create_user(username="creator@example.com", email="creator@example.com", password="pass")
    workspace = create_workspace_for_owner(owner=owner, name="Association Creator", organization_type="association")
    membership = WorkspaceMembership.objects.select_related("role").get(user=owner, workspace=workspace)

    assert membership.role.code == "CREATOR"
    assert RolePermission.objects.filter(role=membership.role, permission__code="*").exists()

    response = authenticated_client(owner).get("/api/v1/auth/me/", HTTP_X_WORKSPACE=workspace.slug)

    assert response.status_code == 200
    assert response.data["workspace_access"]["role"] == "creator"
    assert "*" in response.data["workspace_access"]["permissions"]


@pytest.mark.django_db
def test_member_role_has_limited_api_access_and_cannot_create_admin_resources(django_user_model):
    owner = django_user_model.objects.create_user(username="owner@example.com", email="owner@example.com", password="pass")
    user = django_user_model.objects.create_user(username="member@example.com", email="member@example.com", password="pass")
    workspace = create_workspace_for_owner(owner=owner, name="Association Member", organization_type="association")
    roles = ensure_workspace_rbac(workspace)
    member = Member.objects.create(workspace=workspace, linked_user=user, membership_number="M-000001", first_name="Awa", last_name="Kone", email=user.email)
    WorkspaceMembership.objects.create(user=user, workspace=workspace, role=roles["MEMBER"], status=WorkspaceMembership.Status.ACTIVE)
    campaign = create_campaign(workspace=workspace, actor=owner, name="Cotisation test", amount=Decimal("5000.00"))
    Contribution.objects.create(workspace=workspace, campaign=campaign, member=member, amount_due=Decimal("5000.00"), currency=workspace.currency)
    client = authenticated_client(user)

    self_profile = client.get("/api/v1/me/member/", HTTP_X_WORKSPACE=workspace.slug)
    payable = client.get("/api/v1/payments/contributions/", HTTP_X_WORKSPACE=workspace.slug)
    payments = client.get("/api/v1/payments/", HTTP_X_WORKSPACE=workspace.slug)
    create_event = client.post(
        "/api/v1/events/",
        {"title": "Assemblee", "event_type": "MEETING", "start_at": "2026-09-10T10:00:00Z", "end_at": "2026-09-10T12:00:00Z"},
        format="json",
        HTTP_X_WORKSPACE=workspace.slug,
    )
    create_campaign_response = client.post("/api/v1/contributions/campaigns/", {"name": "Admin", "amount": "1000.00"}, format="json", HTTP_X_WORKSPACE=workspace.slug)

    assert self_profile.status_code == 200
    assert self_profile.data["email"] == user.email
    assert payable.status_code == 200
    assert len(payable.data["results"]) == 1
    assert payments.status_code == 403
    assert create_event.status_code == 403
    assert create_campaign_response.status_code == 403


@pytest.mark.django_db
def test_member_cannot_access_another_workspace_with_url_or_header(django_user_model):
    owner = django_user_model.objects.create_user(username="owner2@example.com", email="owner2@example.com", password="pass")
    user = django_user_model.objects.create_user(username="isolated@example.com", email="isolated@example.com", password="pass")
    first_workspace = create_workspace_for_owner(owner=owner, name="Alpha Association", organization_type="association")
    second_workspace = Workspace.objects.create(name="Beta Association", slug="beta-association", organization_type="association", owner=owner)
    ensure_workspace_rbac(second_workspace)
    member_role = ensure_workspace_rbac(first_workspace)["MEMBER"]
    WorkspaceMembership.objects.create(user=user, workspace=first_workspace, role=member_role, status=WorkspaceMembership.Status.ACTIVE)

    response = authenticated_client(user).get("/api/v1/events/", HTTP_X_WORKSPACE=second_workspace.slug)

    assert response.status_code == 403


@pytest.mark.django_db
def test_member_role_permissions_do_not_include_creator_privileges(django_user_model):
    owner = django_user_model.objects.create_user(username="owner3@example.com", email="owner3@example.com", password="pass")
    workspace = create_workspace_for_owner(owner=owner, name="Permission Check", organization_type="association")
    roles = ensure_workspace_rbac(workspace)
    member_permissions = set(RolePermission.objects.filter(role=roles["MEMBER"]).values_list("permission__code", flat=True))

    assert "*" not in member_permissions
    assert "members.view" not in member_permissions
    assert "settings.view" not in member_permissions
    assert "payments.view_self" in member_permissions
    assert "documents.view" in member_permissions
