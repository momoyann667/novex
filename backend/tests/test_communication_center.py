import pytest
from rest_framework.test import APIClient

from apps.audit_logs.models import AuditLog
from apps.communications.models import Communication, CommunicationChannel, CommunicationRecipientStatus
from apps.communications.services import create_communication, send_communication
from apps.members.services import create_member
from apps.workspaces.models import Permission, Role, RolePermission, Workspace, WorkspaceMembership


COMMUNICATION_PERMISSIONS = {
    "communication.view",
    "communication.create",
    "communication.edit",
    "communication.delete",
    "communication.send",
    "communication.schedule",
    "communication.cancel",
    "communication.view_stats",
    "communication.manage_templates",
}


def make_workspace(django_user_model, slug="communication", permissions=None):
    owner = django_user_model.objects.create_user(username=f"{slug}@example.com", email=f"{slug}@example.com", password="pass")
    workspace = Workspace.objects.create(name=slug, slug=slug, organization_type="association", owner=owner)
    role = Role.objects.create(workspace=workspace, code="owner", label="Owner")
    for code in permissions or COMMUNICATION_PERMISSIONS:
        permission, _ = Permission.objects.get_or_create(code=code)
        RolePermission.objects.create(role=role, permission=permission)
    WorkspaceMembership.objects.create(user=owner, workspace=workspace, role=role, status="active")
    return workspace, owner


@pytest.mark.django_db
def test_communication_preview_send_and_notifications(django_user_model):
    workspace, owner = make_workspace(django_user_model)
    linked_user = django_user_model.objects.create_user(username="member@example.com", email="member@example.com", password="pass")
    member_role = Role.objects.create(workspace=workspace, code="member", label="Member")
    view_permission, _ = Permission.objects.get_or_create(code="communication.view")
    RolePermission.objects.create(role=member_role, permission=view_permission)
    WorkspaceMembership.objects.create(user=linked_user, workspace=workspace, role=member_role, status="active")
    member = create_member(workspace=workspace, actor=owner, linked_user=linked_user, first_name="Awa", last_name="Kone", email=linked_user.email)
    communication = create_communication(
        workspace=workspace,
        actor=owner,
        communication_type="BROADCAST",
        title="Assemblee generale",
        content="Bonjour {{first_name}}, rendez-vous pour {{association_name}}.",
        audience_type="ACTIVE_MEMBERS",
        channels=[CommunicationChannel.IN_APP],
    )

    sent = send_communication(communication=communication, actor=owner)
    recipient = sent.recipients.get(member=member, channel=CommunicationChannel.IN_APP)

    assert sent.status == "SENT"
    assert recipient.status == CommunicationRecipientStatus.DELIVERED
    assert AuditLog.objects.filter(workspace=workspace, action="communication.sent").exists()

    api_client = APIClient()
    api_client.force_authenticate(linked_user)
    notifications = api_client.get("/api/v1/communication/me/notifications/", HTTP_X_WORKSPACE=workspace.slug)
    read_all = api_client.post("/api/v1/communication/me/notifications/read-all/", {}, format="json", HTTP_X_WORKSPACE=workspace.slug)

    recipient.refresh_from_db()
    assert notifications.status_code == 200
    assert len(notifications.data) == 1
    assert read_all.data["updated"] == 1
    assert recipient.status == CommunicationRecipientStatus.READ


@pytest.mark.django_db
def test_communication_api_is_workspace_scoped(django_user_model):
    workspace, owner = make_workspace(django_user_model, "alpha-com")
    other_workspace, other_owner = make_workspace(django_user_model, "beta-com")
    create_communication(workspace=workspace, actor=owner, communication_type="ANNOUNCEMENT", title="Alpha", content="Message", audience_type="ACTIVE_MEMBERS", channels=[CommunicationChannel.IN_APP])
    create_communication(workspace=other_workspace, actor=other_owner, communication_type="ANNOUNCEMENT", title="Beta", content="Message", audience_type="ACTIVE_MEMBERS", channels=[CommunicationChannel.IN_APP])
    api_client = APIClient()
    api_client.force_authenticate(owner)

    response = api_client.get("/api/v1/communication/", HTTP_X_WORKSPACE=workspace.slug)
    preview = api_client.post("/api/v1/communication/audience-preview/", {"audience_type": "ACTIVE_MEMBERS", "channels": [CommunicationChannel.IN_APP]}, format="json", HTTP_X_WORKSPACE=workspace.slug)

    rows = response.data["results"] if "results" in response.data else response.data
    assert response.status_code == 200
    assert len(rows) == 1
    assert rows[0]["title"] == "Alpha"
    assert preview.status_code == 200
    assert Communication.objects.filter(workspace=other_workspace).count() == 1
