from decimal import Decimal

import pytest

pytest.importorskip("pytest_django")

from apps.members.models import Member
from apps.projects.models import Project, ProjectBudgetCategory
from apps.projects.serializers import ProjectSerializer
from apps.projects.services import add_expense_allocation, create_project, update_project, workspace_project_stats
from apps.projects.statuses import ProjectStatus
from apps.workspaces.models import Role, Workspace, WorkspaceMembership


def make_workspace(django_user_model, slug="association"):
    owner = django_user_model.objects.create_user(username=f"{slug}@example.com", email=f"{slug}@example.com", password="pass")
    workspace = Workspace.objects.create(name=slug, slug=slug, organization_type="association", owner=owner)
    role = Role.objects.create(workspace=workspace, code="owner", label="Owner")
    WorkspaceMembership.objects.create(user=owner, workspace=workspace, role=role, status="active")
    return workspace, owner


@pytest.mark.django_db
def test_project_creation_and_status_update_are_audited(django_user_model):
    workspace, owner = make_workspace(django_user_model)

    project = create_project(workspace=workspace, actor=owner, name="Construction ecole", budget=Decimal("10000000.00"))
    updated = update_project(project=project, actor=owner, status=ProjectStatus.ACTIVE, progress=30)

    assert updated.status == ProjectStatus.ACTIVE
    assert updated.progress == 30
    assert updated.activities.filter(action="project.created").exists()
    assert updated.activities.filter(action="project.status_changed").exists()


@pytest.mark.django_db
def test_project_budget_and_expense_allocation_stats(django_user_model):
    workspace, owner = make_workspace(django_user_model)
    project = create_project(workspace=workspace, actor=owner, name="Formation", budget=Decimal("500000.00"), status=ProjectStatus.ACTIVE)
    category = ProjectBudgetCategory.objects.create(workspace=workspace, project=project, name="Logistique", planned_budget=Decimal("200000.00"))

    add_expense_allocation(project=project, actor=owner, budget_category=category, label="Salle", amount=Decimal("125000.00"))
    stats = workspace_project_stats(workspace)

    assert stats["active_projects"] == 1
    assert stats["total_budget"] == Decimal("500000.00")
    assert stats["total_expenses"] == Decimal("125000.00")
    assert stats["remaining_budget"] == Decimal("375000.00")


@pytest.mark.django_db
def test_project_workspace_isolation(django_user_model):
    workspace, owner = make_workspace(django_user_model, "alpha")
    other_workspace, other_owner = make_workspace(django_user_model, "beta")
    create_project(workspace=workspace, actor=owner, name="Alpha")
    create_project(workspace=other_workspace, actor=other_owner, name="Beta")

    assert Project.objects.filter(workspace=workspace).count() == 1
    assert workspace_project_stats(workspace)["total_projects"] == 1


@pytest.mark.django_db
def test_responsible_user_must_belong_to_workspace(django_user_model):
    workspace, _owner = make_workspace(django_user_model, "alpha")
    _other_workspace, other_owner = make_workspace(django_user_model, "beta")
    serializer = ProjectSerializer(data={"name": "Projet", "responsible_user": other_owner.id}, context={"workspace": workspace})

    assert serializer.is_valid() is False
    assert "responsible_user" in serializer.errors


@pytest.mark.django_db
def test_responsible_member_and_progress_are_validated(django_user_model):
    workspace, _owner = make_workspace(django_user_model, "alpha")
    other_workspace, _other_owner = make_workspace(django_user_model, "beta")
    member = Member.objects.create(workspace=other_workspace, membership_number="B-001", first_name="Awa", last_name="Kone")
    serializer = ProjectSerializer(data={"name": "Projet", "responsible_member": member.id, "progress": 120}, context={"workspace": workspace})

    assert serializer.is_valid() is False
    assert "responsible_member" in serializer.errors
    assert "progress" in serializer.errors
