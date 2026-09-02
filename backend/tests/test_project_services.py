from decimal import Decimal

import pytest

pytest.importorskip("pytest_django")

from datetime import date, timedelta

from apps.budgets.services import activate_budget, create_budget, create_budget_line
from apps.budgets.statuses import BudgetScopeType
from apps.finance.services import create_expense, default_category, financial_settings
from apps.finance.statuses import FinancialCategoryKind
from apps.members.models import Member
from apps.projects.models import Project, ProjectBudgetCategory
from apps.projects.serializers import ProjectSerializer
from apps.projects.services import (
    add_expense_allocation,
    add_project_member,
    complete_project_task,
    create_project,
    create_project_milestone,
    create_project_objective,
    create_project_task,
    objective_progress,
    project_analytics,
    project_risk_score,
    update_project,
    update_project_task,
    workspace_project_stats,
)
from apps.projects.statuses import ProjectMilestoneStatus, ProjectRiskLevel, ProjectRole, ProjectStatus, ProjectTaskStatus
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

    assert project.code.startswith("PRJ-")
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


@pytest.mark.django_db
def test_project_team_tasks_objectives_and_progress(django_user_model):
    workspace, owner = make_workspace(django_user_model, "ops")
    member = Member.objects.create(workspace=workspace, membership_number="OPS-001", first_name="Awa", last_name="Kone")
    project = create_project(workspace=workspace, actor=owner, name="Programme terrain", budget=Decimal("1000000.00"), status=ProjectStatus.ACTIVE)

    team_member = add_project_member(project=project, actor=owner, member=member, role=ProjectRole.PROJECT_MANAGER)
    objective = create_project_objective(project=project, actor=owner, name="Beneficiaires", target=Decimal("500.00"), current_value=Decimal("250.00"), unit="personnes")
    task = create_project_task(project=project, actor=owner, title="Planifier terrain", assignee=member, due_date=date.today() + timedelta(days=7))
    completed = complete_project_task(task=task, actor=owner)

    project.refresh_from_db()
    assert team_member.is_active is True
    assert objective_progress(objective) == Decimal("50.00")
    assert completed.status == ProjectTaskStatus.DONE
    assert project.progress > 0


@pytest.mark.django_db
def test_project_task_dependency_cycle_is_blocked(django_user_model):
    workspace, owner = make_workspace(django_user_model, "cycle")
    project = create_project(workspace=workspace, actor=owner, name="Projet dependances")
    first = create_project_task(project=project, actor=owner, title="Validation budget")
    second = create_project_task(project=project, actor=owner, title="Achat materiel", dependencies=[first])

    with pytest.raises(ValueError):
        update_project_task(task=first, actor=owner, dependencies=[second])


@pytest.mark.django_db
def test_project_finance_budget_analytics_are_coherent(django_user_model):
    workspace, owner = make_workspace(django_user_model, "finance-project")
    finance_settings = financial_settings(workspace)
    finance_settings.expense_validation_threshold = Decimal("9999999.00")
    finance_settings.save()
    member = Member.objects.create(workspace=workspace, membership_number="FP-001", first_name="Yao", last_name="Kouame")
    project = create_project(workspace=workspace, actor=owner, name="Centre communautaire", owner=member, budget=Decimal("5000000.00"), status=ProjectStatus.ACTIVE)
    category = default_category(workspace, kind=FinancialCategoryKind.EXPENSE_CATEGORY, name="Materiel", actor=owner)
    budget = create_budget(
        workspace=workspace,
        actor=owner,
        name="Budget centre",
        scope_type=BudgetScopeType.PROJECT,
        project=project,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        total_amount=Decimal("5000000.00"),
    )
    create_budget_line(budget=budget, actor=owner, category=category, planned_amount=Decimal("5000000.00"))
    activate_budget(budget=budget, actor=owner)

    create_expense(workspace=workspace, actor=owner, amount=Decimal("2000000.00"), category=category, project=project, description="Ciment", transaction_date=date(2026, 5, 1))
    analytics = project_analytics(project)

    assert analytics["actual_expense"] == Decimal("2000000.00")
    assert analytics["remaining_budget"] == Decimal("3000000.00")


@pytest.mark.django_db
def test_project_without_budget_keeps_zero_consumption(django_user_model):
    workspace, owner = make_workspace(django_user_model, "no-budget")
    project = create_project(workspace=workspace, actor=owner, name="Projet sans budget", status=ProjectStatus.ACTIVE)
    analytics = project_analytics(project)

    assert analytics["budget"] == Decimal("0.00")
    assert analytics["actual_expense"] == Decimal("0.00")
    assert analytics["remaining_budget"] == Decimal("0.00")


@pytest.mark.django_db
def test_project_serializer_exposes_responsible_and_team_preview(django_user_model):
    workspace, owner = make_workspace(django_user_model, "team-preview")
    member = Member.objects.create(workspace=workspace, membership_number="TP-001", first_name="Fatou", last_name="Diop")
    project = create_project(workspace=workspace, actor=owner, name="Projet equipe", owner=member, responsible_member=member, status=ProjectStatus.ACTIVE)
    add_project_member(project=project, actor=owner, member=member, role=ProjectRole.PROJECT_MANAGER)

    payload = ProjectSerializer(project, context={"workspace": workspace}).data

    assert payload["owner_name"] == "Fatou Diop"
    assert payload["responsible_member_name"] == "Fatou Diop"
    assert payload["team_preview"][0]["name"] == "Fatou Diop"


@pytest.mark.django_db
def test_project_risk_score_uses_delay_budget_and_blocked_tasks(django_user_model):
    workspace, owner = make_workspace(django_user_model, "risk")
    project = create_project(workspace=workspace, actor=owner, name="Projet risque", budget=Decimal("1000.00"), status=ProjectStatus.ACTIVE, end_date=date.today() - timedelta(days=3))
    add_expense_allocation(project=project, actor=owner, label="Depense", amount=Decimal("950.00"))
    create_project_task(project=project, actor=owner, title="Bloquee", status=ProjectTaskStatus.BLOCKED, due_date=date.today() - timedelta(days=1))
    create_project_milestone(project=project, actor=owner, name="Jalon", due_date=date.today() - timedelta(days=2), status=ProjectMilestoneStatus.DELAYED)

    risk = project_risk_score(project)

    assert risk["level"] in {ProjectRiskLevel.HIGH, ProjectRiskLevel.CRITICAL}
    assert "Projet en retard" in risk["causes"]
