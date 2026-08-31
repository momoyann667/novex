from datetime import date

import pytest
from rest_framework.test import APIClient

from apps.audit_logs.models import AuditLog
from apps.members.models import Member, MemberActivity
from apps.members.services import archive_member, create_member, member_seniority, restore_member, update_member
from apps.workspaces.models import Permission, Role, RolePermission, Workspace, WorkspaceMembership


def make_workspace(django_user_model, slug="association", permissions=None):
    owner = django_user_model.objects.create_user(username=f"{slug}@example.com", email=f"{slug}@example.com", password="pass")
    workspace = Workspace.objects.create(name=slug, slug=slug, organization_type="association", owner=owner)
    role = Role.objects.create(workspace=workspace, code="owner", label="Owner")
    for code in permissions or {"members.view", "members.create", "members.update", "members.archive", "members.restore"}:
        permission, _ = Permission.objects.get_or_create(code=code)
        RolePermission.objects.create(role=role, permission=permission)
    WorkspaceMembership.objects.create(user=owner, workspace=workspace, role=role, status="active")
    return workspace, owner


@pytest.mark.django_db
def test_member_creation_update_archive_restore_are_audited(django_user_model):
    workspace, owner = make_workspace(django_user_model)

    member = create_member(workspace=workspace, actor=owner, first_name="Awa", last_name="Kone", phone_country_code="+225", phone="0700000000", function="Tresoriere")
    updated = update_member(member=member, actor=owner, function="Presidente")
    archived = archive_member(member=updated, actor=owner)
    restored = restore_member(member=archived, actor=owner)

    assert member.membership_number.startswith("ASSOCIAT-")
    assert restored.status == Member.Status.ACTIVE
    assert restored.archived_at is None
    assert MemberActivity.objects.filter(member=member, action="member.created").exists()
    assert AuditLog.objects.filter(workspace=workspace, action="member.restored").exists()


@pytest.mark.django_db
def test_member_seniority_is_calculated_not_stored(django_user_model):
    workspace, owner = make_workspace(django_user_model)
    member = create_member(workspace=workspace, actor=owner, first_name="Awa", last_name="Kone", join_date=date(2024, 1, 1))

    assert member_seniority(member, today=date(2026, 1, 1)) == {"days": 731, "years": 2.0}


@pytest.mark.django_db
def test_members_api_is_workspace_scoped_and_searchable(django_user_model):
    workspace, owner = make_workspace(django_user_model, "alpha")
    other_workspace, other_owner = make_workspace(django_user_model, "beta")
    create_member(workspace=workspace, actor=owner, first_name="Awa", last_name="Kone", email="awa@example.com", function="Secretaire")
    create_member(workspace=other_workspace, actor=other_owner, first_name="Yao", last_name="Koffi", email="yao@example.com")

    api_client = APIClient()
    api_client.force_authenticate(owner)
    response = api_client.get("/api/v1/members/", {"search": "Awa"}, HTTP_X_WORKSPACE="alpha")

    assert response.status_code == 200
    rows = response.data["results"] if "results" in response.data else response.data
    assert len(rows) == 1
    assert rows[0]["email"] == "awa@example.com"


@pytest.mark.django_db
def test_members_api_create_patch_archive_restore(django_user_model):
    workspace, owner = make_workspace(django_user_model, "alpha")
    api_client = APIClient()
    api_client.force_authenticate(owner)

    created = api_client.post(
        "/api/v1/members/",
        {"first_name": "Mariam", "last_name": "Traore", "email": "mariam@example.com", "phone_country_code": "+225", "phone": "0102030405", "function": "Membre"},
        format="json",
        HTTP_X_WORKSPACE=workspace.slug,
    )
    assert created.status_code == 201

    member_id = created.data["id"]
    patched = api_client.patch(f"/api/v1/members/{member_id}/", {"status": Member.Status.INACTIVE}, format="json", HTTP_X_WORKSPACE=workspace.slug)
    archived = api_client.post(f"/api/v1/members/{member_id}/archive/", {}, format="json", HTTP_X_WORKSPACE=workspace.slug)
    restored = api_client.post(f"/api/v1/members/{member_id}/restore/", {}, format="json", HTTP_X_WORKSPACE=workspace.slug)

    assert patched.data["status"] == Member.Status.INACTIVE
    assert archived.data["status"] == Member.Status.ARCHIVED
    assert restored.data["status"] == Member.Status.ACTIVE
