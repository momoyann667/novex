from datetime import date

import pytest
from rest_framework.test import APIClient

from apps.audit_logs.models import AuditLog
from apps.members.models import Member, MemberActivity, MemberCategory, MemberGroup, MemberInvitation, MembershipApplication, MembershipSettings
from apps.members.services import accept_invitation, approve_application, create_member_invitation, create_membership_application, decline_invitation, member_seniority, reject_application, review_application, archive_member, create_member, restore_member, update_member
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


ONBOARDING_PERMISSIONS = {
    "members.view",
    "members.create",
    "members.update",
    "members.archive",
    "members.restore",
    "members.applications.view",
    "members.applications.review",
    "members.applications.approve",
    "members.applications.reject",
    "members.invitations.create",
    "members.invitations.cancel",
    "members.invitations.resend",
    "members.onboarding.manage",
}


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


@pytest.mark.django_db
def test_members_api_creates_manual_member_with_type_bureau_function_and_profession(django_user_model):
    workspace, owner = make_workspace(django_user_model, "bureau")
    api_client = APIClient()
    api_client.force_authenticate(owner)

    created = api_client.post(
        "/api/v1/members/",
        {
            "first_name": "Ibrahim",
            "last_name": "Tangora",
            "email": "ibrahim@example.com",
            "phone": "0700000000",
            "function": "President",
            "occupation": "Entrepreneur",
            "join_date": "2026-08-31",
            "status": Member.Status.ACTIVE,
            "category_name": "Membre du bureau",
            "group_names": ["Bureau executif"],
        },
        format="json",
        HTTP_X_WORKSPACE=workspace.slug,
    )

    assert created.status_code == 201
    member = Member.objects.get(email="ibrahim@example.com")
    assert member.category.name == "Membre du bureau"
    assert member.groups.filter(name="Bureau executif").exists()
    assert member.function == "President"
    assert member.occupation == "Entrepreneur"
    assert MemberCategory.objects.filter(workspace=workspace, name="Membre du bureau").exists()
    assert MemberGroup.objects.filter(workspace=workspace, name="Bureau executif").exists()


@pytest.mark.django_db
def test_membership_application_review_approve_reject_workflow(django_user_model):
    workspace, owner = make_workspace(django_user_model, "onboarding", ONBOARDING_PERMISSIONS)
    application = create_membership_application(
        workspace=workspace,
        actor=owner,
        source=MembershipApplication.Source.PUBLIC_FORM,
        first_name="Mariam",
        last_name="Kone",
        email="mariam.kone@example.com",
        phone="+2250700000010",
        occupation="Entrepreneure",
    )

    reviewed = review_application(application=application, actor=owner, internal_note="Dossier complet")
    approved = approve_application(application=reviewed, actor=owner)
    approved_again = approve_application(application=approved, actor=owner)

    assert reviewed.status == MembershipApplication.Status.UNDER_REVIEW
    assert approved.status == MembershipApplication.Status.APPROVED
    assert approved.member.status == Member.Status.ACTIVE
    assert approved_again.member_id == approved.member_id
    assert Member.objects.filter(workspace=workspace, email="mariam.kone@example.com").count() == 1

    rejected_application = create_membership_application(workspace=workspace, actor=owner, first_name="Yao", last_name="Kouassi", email="yao@example.com")
    rejected = reject_application(application=rejected_application, actor=owner, rejection_reason="Completude insuffisante")
    assert rejected.status == MembershipApplication.Status.REJECTED


@pytest.mark.django_db
def test_member_invitation_token_accept_decline_and_idempotence(django_user_model):
    workspace, owner = make_workspace(django_user_model, "invites", ONBOARDING_PERMISSIONS)
    MembershipSettings.objects.create(workspace=workspace, invitation_enabled=True)

    invitation, token, created, temporary_password = create_member_invitation(
        workspace=workspace,
        actor=owner,
        first_name="Grace",
        last_name="Kouame",
        email="grace@example.com",
        function="Membre",
    )
    duplicate, duplicate_token, duplicate_created, duplicate_temporary_password = create_member_invitation(
        workspace=workspace,
        actor=owner,
        first_name="Grace",
        last_name="Kouame",
        email="grace@example.com",
        function="Membre",
    )

    accepted = accept_invitation(token=token)

    assert created is True
    assert temporary_password
    invited_user = django_user_model.objects.get(email="grace@example.com")
    assert invited_user.check_password(temporary_password)
    assert invited_user.password != temporary_password
    assert invited_user.must_change_password is True
    assert WorkspaceMembership.objects.get(user=invited_user, workspace=workspace).status == WorkspaceMembership.Status.ACTIVE
    assert duplicate.id == invitation.id
    assert duplicate_token == ""
    assert duplicate_created is False
    assert duplicate_temporary_password == ""
    assert accepted.status == MemberInvitation.Status.ACCEPTED
    assert accepted.member.email == "grace@example.com"

    second_invitation, second_token, _, second_temporary_password = create_member_invitation(workspace=workspace, actor=owner, first_name="Paul", last_name="Ake", phone="+2250102030405")
    declined = decline_invitation(token=second_token)
    assert second_temporary_password == ""
    assert declined.id == second_invitation.id
    assert declined.status == MemberInvitation.Status.DECLINED


@pytest.mark.django_db
def test_member_invitation_api_can_target_existing_member_without_duplicate(django_user_model):
    workspace, owner = make_workspace(django_user_model, "memberinvite", ONBOARDING_PERMISSIONS)
    MembershipSettings.objects.create(workspace=workspace, invitation_enabled=True)
    member = create_member(workspace=workspace, actor=owner, first_name="Fatou", last_name="Diop", email="fatou@example.com", phone="+2250700000011")
    api_client = APIClient()
    api_client.force_authenticate(owner)

    first = api_client.post("/api/v1/members/invitations/", {"member_id": member.id, "message": "Bienvenue"}, format="json", HTTP_X_WORKSPACE=workspace.slug)
    second = api_client.post("/api/v1/members/invitations/", {"member_id": member.id, "message": "Bienvenue"}, format="json", HTTP_X_WORKSPACE=workspace.slug)

    assert first.status_code == 201, first.data
    assert second.status_code == 200
    assert first.data["member"] == member.id
    assert second.data["id"] == first.data["id"]
    assert MemberInvitation.objects.filter(workspace=workspace, member=member, status=MemberInvitation.Status.PENDING).count() == 1

    token = first.data["accept_url"].rsplit("/", 1)[-1]
    accepted = accept_invitation(token=token)

    assert accepted.member_id == member.id
    assert accepted.status == MemberInvitation.Status.ACCEPTED
    assert Member.objects.filter(workspace=workspace, email="fatou@example.com").count() == 1


@pytest.mark.django_db
def test_membership_applications_api_and_public_form_are_workspace_scoped(django_user_model):
    workspace, owner = make_workspace(django_user_model, "publicform", ONBOARDING_PERMISSIONS)
    MembershipSettings.objects.create(workspace=workspace, public_form_enabled=True, membership_enabled=True)
    api_client = APIClient()

    public_response = api_client.post(
        f"/api/v1/public/membership/{workspace.slug}/apply/",
        {"first_name": "Nadia", "last_name": "Bamba", "email": "nadia@example.com", "phone": "+2250700000099"},
        format="json",
    )
    assert public_response.status_code == 201

    api_client.force_authenticate(owner)
    response = api_client.get("/api/v1/members/applications/", {"search": "Nadia"}, HTTP_X_WORKSPACE=workspace.slug)
    assert response.status_code == 200
    rows = response.data["results"] if "results" in response.data else response.data
    assert len(rows) == 1
    assert rows[0]["email"] == "nadia@example.com"


@pytest.mark.django_db
def test_self_member_profile_and_dashboard_are_limited_to_linked_member(django_user_model):
    workspace, owner = make_workspace(django_user_model, "selfspace", ONBOARDING_PERMISSIONS)
    linked_member = create_member(
        workspace=workspace,
        actor=owner,
        linked_user=owner,
        first_name="Mohamed",
        last_name="Tangora",
        email=owner.email,
        phone="+2250700000001",
    )
    create_member(workspace=workspace, actor=owner, first_name="Other", last_name="Member", email="other@example.com")
    api_client = APIClient()
    api_client.force_authenticate(owner)

    profile = api_client.get("/api/v1/me/member/", HTTP_X_WORKSPACE=workspace.slug)
    patched = api_client.patch("/api/v1/me/member/", {"phone": "+2250500000002", "function": "President"}, format="json", HTTP_X_WORKSPACE=workspace.slug)
    dashboard = api_client.get("/api/v1/me/member/dashboard/", HTTP_X_WORKSPACE=workspace.slug)

    linked_member.refresh_from_db()
    assert profile.status_code == 200
    assert profile.data["id"] == linked_member.id
    assert patched.status_code == 200
    assert linked_member.phone == "+2250500000002"
    assert linked_member.function == "Membre"
    assert dashboard.status_code == 200
    assert dashboard.data["profile"]["id"] == linked_member.id


@pytest.mark.django_db
def test_member_directory_filters_export_and_audit(django_user_model):
    workspace, owner = make_workspace(django_user_model, "directory", {"members.view", "members.create", "members.update", "members.archive", "members.restore", "members.export"})
    create_member(workspace=workspace, actor=owner, first_name="Awa", last_name="Kone", email="awa@example.com", function="Secretaire", status=Member.Status.ACTIVE)
    create_member(workspace=workspace, actor=owner, first_name="Yao", last_name="Koffi", email="yao@example.com", function="Tresorier", status=Member.Status.ARCHIVED)
    api_client = APIClient()
    api_client.force_authenticate(owner)

    directory = api_client.get("/api/v1/members/directory/", {"search": "Awa", "status": Member.Status.ACTIVE}, HTTP_X_WORKSPACE=workspace.slug)
    exported = api_client.get("/api/v1/members/directory-export/", {"search": "Awa"}, HTTP_X_WORKSPACE=workspace.slug)

    assert directory.status_code == 200
    rows = directory.data["results"] if "results" in directory.data else directory.data
    assert len(rows) == 1
    assert rows[0]["email"] == "awa@example.com"
    assert "summary" in directory.data
    assert "segments" in directory.data
    assert exported.status_code == 200
    assert b"awa@example.com" in exported.content
    assert b"yao@example.com" not in exported.content
    assert AuditLog.objects.filter(workspace=workspace, action="member.exported").exists()
