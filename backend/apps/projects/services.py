from decimal import Decimal

from django.db import transaction
from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.workspaces.models import Workspace
from .models import Project, ProjectActivity, ProjectBudgetCategory, ProjectExpenseAllocation
from .statuses import ProjectStatus


ZERO = Decimal("0.00")


def log_project_activity(*, project: Project, actor, action: str, metadata: dict | None = None) -> ProjectActivity:
    activity = ProjectActivity.objects.create(
        workspace=project.workspace,
        project=project,
        actor=actor,
        action=action,
        metadata=metadata or {},
    )
    AuditLog.objects.create(
        workspace=project.workspace,
        actor=actor,
        action=action,
        resource="project",
        resource_id=str(project.id),
        metadata=metadata or {},
    )
    return activity


@transaction.atomic
def create_project(*, workspace: Workspace, actor, **data) -> Project:
    project = Project.objects.create(workspace=workspace, created_by=actor, **data)
    log_project_activity(project=project, actor=actor, action="project.created")
    return project


@transaction.atomic
def update_project(*, project: Project, actor, **data) -> Project:
    previous_status = project.status
    previous_budget = project.budget
    for field, value in data.items():
        setattr(project, field, value)
    project.save()
    log_project_activity(project=project, actor=actor, action="project.updated")
    if previous_status != project.status:
        log_project_activity(
            project=project,
            actor=actor,
            action="project.status_changed",
            metadata={"from": previous_status, "to": project.status},
        )
    if previous_budget != project.budget:
        log_project_activity(
            project=project,
            actor=actor,
            action="project.budget_updated",
            metadata={"from": str(previous_budget), "to": str(project.budget)},
        )
    return project


def delete_project(*, project: Project, actor) -> None:
    log_project_activity(project=project, actor=actor, action="project.deleted")
    project.delete()


def project_expense_total(project: Project) -> Decimal:
    return project.expense_allocations.aggregate(total=Sum("amount"))["total"] or ZERO


def project_budget_summary(project: Project) -> dict:
    expenses = project_expense_total(project)
    remaining = project.budget - expenses
    consumed_rate = round((expenses / project.budget) * 100, 2) if project.budget else 0
    return {
        "budget": project.budget,
        "expenses": expenses,
        "remaining": remaining,
        "consumed_rate": consumed_rate,
        "progress": project.progress,
        "expense_count": project.expense_allocations.count(),
        "days_remaining": max((project.end_date - timezone.localdate()).days, 0) if project.end_date else None,
        "is_delayed": project.is_delayed,
    }


def budget_category_summary(category: ProjectBudgetCategory) -> dict:
    expenses = category.expense_allocations.aggregate(total=Sum("amount"))["total"] or ZERO
    remaining = category.planned_budget - expenses
    consumed_rate = round((expenses / category.planned_budget) * 100, 2) if category.planned_budget else 0
    return {"expenses": expenses, "remaining": remaining, "consumed_rate": consumed_rate}


def workspace_project_stats(workspace: Workspace) -> dict:
    today = timezone.localdate()
    projects = Project.objects.filter(workspace=workspace)
    aggregates = projects.aggregate(
        total_projects=Count("id"),
        active_projects=Count("id", filter=Q(status=ProjectStatus.ACTIVE)),
        completed_projects=Count("id", filter=Q(status=ProjectStatus.COMPLETED)),
        delayed_projects=Count("id", filter=Q(end_date__lt=today, progress__lt=100) & ~Q(status__in=[ProjectStatus.COMPLETED, ProjectStatus.CANCELLED])),
        total_budget=Sum("budget"),
        average_progress=Avg("progress"),
    )
    total_expenses = ProjectExpenseAllocation.objects.filter(workspace=workspace).aggregate(total=Sum("amount"))["total"] or ZERO
    total_budget = aggregates["total_budget"] or ZERO
    return {
        "total_projects": aggregates["total_projects"] or 0,
        "active_projects": aggregates["active_projects"] or 0,
        "completed_projects": aggregates["completed_projects"] or 0,
        "delayed_projects": aggregates["delayed_projects"] or 0,
        "total_budget": total_budget,
        "total_expenses": total_expenses,
        "remaining_budget": total_budget - total_expenses,
        "average_progress": round(aggregates["average_progress"] or 0, 2),
    }


@transaction.atomic
def add_expense_allocation(*, project: Project, actor, **data) -> ProjectExpenseAllocation:
    category = data.get("budget_category")
    if category and category.project_id != project.id:
        raise ValueError("La categorie budgetaire n'appartient pas a ce projet.")
    allocation = ProjectExpenseAllocation.objects.create(workspace=project.workspace, project=project, created_by=actor, **data)
    log_project_activity(
        project=project,
        actor=actor,
        action="project.expense_linked",
        metadata={"amount": str(allocation.amount), "expense_id": allocation.external_expense_id},
    )
    return allocation
