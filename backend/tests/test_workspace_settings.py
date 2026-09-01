import pytest

pytest.importorskip("pytest_django")

from rest_framework.test import APIClient

from apps.audit_logs.models import AuditLog
from apps.workspaces.models import Role, Workspace, WorkspaceMembership, WorkspaceSettings
from apps.workspaces.services import ensure_workspace_settings


@pytest.fixture
def api_client():
    return APIClient()


def make_workspace(django_user_model, slug="settings"):
    owner = django_user_model.objects.create_user(username=f"{slug}@example.com", email=f"{slug}@example.com", password="pass")
    workspace = Workspace.objects.create(name=slug, slug=slug, organization_type="association", owner=owner)
    role = Role.objects.create(workspace=workspace, code="OWNER", label="Owner")
    WorkspaceMembership.objects.create(user=owner, workspace=workspace, role=role, status="active")
    ensure_workspace_settings(workspace)
    return workspace, owner


@pytest.mark.django_db
def test_workspace_settings_defaults_are_created(django_user_model):
    workspace, _owner = make_workspace(django_user_model)

    settings = WorkspaceSettings.objects.get(workspace=workspace)

    assert settings.timezone == "Africa/Abidjan"
    assert settings.language == "fr"
    assert settings.contribution_preferences["periodicity"] == "MONTHLY"


@pytest.mark.django_db
def test_owner_can_update_workspace_settings(api_client, django_user_model):
    workspace, owner = make_workspace(django_user_model, "settings-alpha")
    api_client.force_authenticate(owner)

    response = api_client.patch(
        f"/api/v1/workspaces/{workspace.slug}/settings/",
        {
            "workspace_name": "Association Alpha",
            "currency": "XOF",
            "timezone": "Africa/Abidjan",
            "profile": {"contact_email": "contact@alpha.test", "contact_phone": "+22501020304"},
            "contribution_preferences": {"periodicity": "QUARTERLY", "due_day": 15},
        },
        format="json",
        HTTP_X_WORKSPACE=workspace.slug,
    )

    workspace.refresh_from_db()
    settings = workspace.settings
    assert response.status_code == 200
    assert workspace.name == "Association Alpha"
    assert settings.contribution_preferences["periodicity"] == "QUARTERLY"
    assert workspace.organization_profile.contact_email == "contact@alpha.test"
    assert AuditLog.objects.filter(workspace=workspace, action="workspace.settings_updated").exists()


@pytest.mark.django_db
def test_workspace_settings_reject_invalid_currency(api_client, django_user_model):
    workspace, owner = make_workspace(django_user_model, "settings-currency")
    api_client.force_authenticate(owner)

    response = api_client.patch(
        f"/api/v1/workspaces/{workspace.slug}/settings/",
        {"currency": "BTC"},
        format="json",
        HTTP_X_WORKSPACE=workspace.slug,
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_workspace_settings_persist_member_and_finance_preferences(api_client, django_user_model):
    workspace, owner = make_workspace(django_user_model, "settings-preferences")
    api_client.force_authenticate(owner)

    response = api_client.patch(
        f"/api/v1/workspaces/{workspace.slug}/settings/",
        {
            "member_preferences": {"categories": ["Membre actif"], "functions": ["Tresorier"]},
            "finance_preferences": {"expense_categories": ["Transport"], "payment_methods": ["Wave"]},
            "money_format": {"symbol": "FCFA", "symbol_position": "after", "decimals": 0},
        },
        format="json",
        HTTP_X_WORKSPACE=workspace.slug,
    )

    workspace.settings.refresh_from_db()
    assert response.status_code == 200
    assert workspace.settings.member_preferences["functions"] == ["Tresorier"]
    assert workspace.settings.finance_preferences["payment_methods"] == ["Wave"]
    assert workspace.settings.money_format["symbol"] == "FCFA"


@pytest.mark.django_db
def test_workspace_settings_reject_invalid_preferences(api_client, django_user_model):
    workspace, owner = make_workspace(django_user_model, "settings-invalid-preferences")
    api_client.force_authenticate(owner)

    response = api_client.patch(
        f"/api/v1/workspaces/{workspace.slug}/settings/",
        {"member_preferences": {"categories": [{"name": "Membre"}]}},
        format="json",
        HTTP_X_WORKSPACE=workspace.slug,
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_user_cannot_update_another_workspace_settings(api_client, django_user_model):
    workspace, _owner = make_workspace(django_user_model, "settings-a")
    other_workspace, other_owner = make_workspace(django_user_model, "settings-b")
    api_client.force_authenticate(other_owner)

    response = api_client.patch(
        f"/api/v1/workspaces/{workspace.slug}/settings/",
        {"workspace_name": "Cross workspace"},
        format="json",
        HTTP_X_WORKSPACE=other_workspace.slug,
    )

    assert response.status_code == 404
