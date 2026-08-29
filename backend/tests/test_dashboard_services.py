import pytest

from apps.dashboard.services import get_dashboard_overview
from apps.members.models import Member
from apps.workspaces.models import Workspace


@pytest.mark.django_db
def test_dashboard_overview_scopes_members_to_workspace(django_user_model):
    owner = django_user_model.objects.create_user(username="owner@example.com", email="owner@example.com", password="pass")
    workspace_a = Workspace.objects.create(name="A", slug="a", organization_type="association", owner=owner)
    workspace_b = Workspace.objects.create(name="B", slug="b", organization_type="association", owner=owner)
    Member.objects.create(workspace=workspace_a, first_name="Awa", last_name="Kouame")
    Member.objects.create(workspace=workspace_b, first_name="Yao", last_name="Koffi")

    overview = get_dashboard_overview(workspace=workspace_a, period_code="month", user_permissions={"*"})

    assert overview["kpis"]["members"]["total"] == 1
    assert overview["workspace"]["slug"] == "a"


@pytest.mark.django_db
def test_dashboard_masks_finance_without_permission(django_user_model):
    owner = django_user_model.objects.create_user(username="owner@example.com", email="owner@example.com", password="pass")
    workspace = Workspace.objects.create(name="A", slug="a", organization_type="association", owner=owner)

    overview = get_dashboard_overview(workspace=workspace, period_code="month", user_permissions={"members.view"})

    assert overview["kpis"]["finance"]["masked"] is True
    assert overview["kpis"]["finance"]["current_balance"] is None
