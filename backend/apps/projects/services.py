from decimal import Decimal

from django.db import transaction
from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.finance.models import FinancialTransaction
from apps.finance.statuses import FinancialTransactionStatus, FinancialTransactionType
from apps.workspaces.models import Workspace
from .models import (
    Project,
    ProjectActivity,
    ProjectAlert,
    ProjectBudgetCategory,
    ProjectComment,
    ProjectExpenseAllocation,
    ProjectMember,
    ProjectMilestone,
    ProjectObjective,
    ProjectTask,
)
from .statuses import ProjectAlertType, ProjectMilestoneStatus, ProjectRiskLevel, ProjectStatus, ProjectTaskStatus


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
    data.setdefault("currency", workspace.currency)
    data.setdefault("code", next_project_code(workspace))
    if data.get("owner") and data["owner"].workspace_id != workspace.id:
        raise ValueError("Le responsable projet appartient a un autre workspace.")
    if data.get("parent") and data["parent"].workspace_id != workspace.id:
        raise ValueError("Le projet parent appartient a un autre workspace.")
    project = Project.objects.create(workspace=workspace, created_by=actor, **data)
    log_project_activity(project=project, actor=actor, action="project.created")
    return project


@transaction.atomic
def update_project(*, project: Project, actor, **data) -> Project:
    project = Project.objects.select_for_update().get(id=project.id)
    previous_status = project.status
    previous_budget = project.budget
    if data.get("owner") and data["owner"].workspace_id != project.workspace_id:
        raise ValueError("Le responsable projet appartient a un autre workspace.")
    if data.get("parent") and data["parent"].workspace_id != project.workspace_id:
        raise ValueError("Le projet parent appartient a un autre workspace.")
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


def next_project_code(workspace: Workspace) -> str:
    year = timezone.localdate().year
    prefix = f"PRJ-{year}-"
    last = Project.objects.filter(workspace=workspace, code__startswith=prefix).order_by("-code").first()
    next_number = int(last.code.rsplit("-", 1)[-1]) + 1 if last and last.code.rsplit("-", 1)[-1].isdigit() else 1
    return f"{prefix}{next_number:03d}"


@transaction.atomic
def change_project_status(*, project: Project, actor, status: str) -> Project:
    project = Project.objects.select_for_update().get(id=project.id)
    if status == ProjectStatus.ARCHIVED and project.status not in {ProjectStatus.COMPLETED, ProjectStatus.CANCELLED}:
        raise ValueError("Seul un projet termine ou annule peut etre archive.")
    previous = project.status
    project.status = status
    if status == ProjectStatus.COMPLETED and not project.completed_at:
        project.completed_at = timezone.now()
    project.save(update_fields=["status", "completed_at", "updated_at"])
    log_project_activity(project=project, actor=actor, action="project.completed" if status == ProjectStatus.COMPLETED else "project.archived" if status == ProjectStatus.ARCHIVED else "project.status_changed", metadata={"from": previous, "to": status})
    return project


def delete_project(*, project: Project, actor) -> None:
    if project.financial_transactions.exists() or project.budgets.exists() or project.tasks.exists() or project.documents.exists():
        change_project_status(project=project, actor=actor, status=ProjectStatus.ARCHIVED if project.status == ProjectStatus.COMPLETED else ProjectStatus.CANCELLED)
        return
    log_project_activity(project=project, actor=actor, action="project.deleted")
    project.delete()


def project_expense_total(project: Project) -> Decimal:
    finance_total = FinancialTransaction.objects.filter(project=project, transaction_type=FinancialTransactionType.EXPENSE, status=FinancialTransactionStatus.VALIDATED).aggregate(total=Sum("amount"))["total"] or ZERO
    legacy_total = project.expense_allocations.aggregate(total=Sum("amount"))["total"] or ZERO
    return finance_total + legacy_total


def project_income_total(project: Project) -> Decimal:
    return FinancialTransaction.objects.filter(project=project, transaction_type=FinancialTransactionType.INCOME, status=FinancialTransactionStatus.VALIDATED).aggregate(total=Sum("amount"))["total"] or ZERO


def project_budget_summary(project: Project) -> dict:
    expenses = project_expense_total(project)
    income = project_income_total(project)
    remaining = project.budget - expenses
    consumed_rate = round((expenses / project.budget) * 100, 2) if project.budget else 0
    return {
        "budget": project.budget,
        "funding_received": income,
        "funding_remaining": max(project.budget - income, ZERO),
        "expenses": expenses,
        "actual_expense": expenses,
        "remaining": remaining,
        "project_balance": income - expenses,
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
    total_expenses += FinancialTransaction.objects.filter(workspace=workspace, project__isnull=False, transaction_type=FinancialTransactionType.EXPENSE, status=FinancialTransactionStatus.VALIDATED).aggregate(total=Sum("amount"))["total"] or ZERO
    total_budget = aggregates["total_budget"] or ZERO
    task_stats = ProjectTask.objects.filter(workspace=workspace).aggregate(
        task_count=Count("id"),
        completed_tasks=Count("id", filter=Q(status=ProjectTaskStatus.DONE)),
        blocked_tasks=Count("id", filter=Q(status=ProjectTaskStatus.BLOCKED)),
        overdue_tasks=Count("id", filter=Q(due_date__lt=today) & ~Q(status__in=[ProjectTaskStatus.DONE, ProjectTaskStatus.CANCELLED])),
        upcoming_tasks=Count("id", filter=Q(due_date__gte=today) & ~Q(status__in=[ProjectTaskStatus.DONE, ProjectTaskStatus.CANCELLED])),
    )
    return {
        "total_projects": aggregates["total_projects"] or 0,
        "active_projects": aggregates["active_projects"] or 0,
        "completed_projects": aggregates["completed_projects"] or 0,
        "delayed_projects": aggregates["delayed_projects"] or 0,
        "total_budget": total_budget,
        "total_expenses": total_expenses,
        "remaining_budget": total_budget - total_expenses,
        "average_progress": round(aggregates["average_progress"] or 0, 2),
        "task_count": task_stats["task_count"] or 0,
        "completed_tasks": task_stats["completed_tasks"] or 0,
        "blocked_tasks": task_stats["blocked_tasks"] or 0,
        "overdue_tasks": task_stats["overdue_tasks"] or 0,
        "upcoming_tasks": task_stats["upcoming_tasks"] or 0,
        "risk_projects": sum(1 for item in Project.objects.filter(workspace=workspace).prefetch_related("tasks", "milestones") if project_risk_score(item)["level"] in {ProjectRiskLevel.HIGH, ProjectRiskLevel.CRITICAL}),
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


def objective_progress(objective: ProjectObjective) -> Decimal:
    return round((objective.current_value / objective.target) * 100, 2) if objective.target else Decimal("0.00")


def calculated_project_progress(project: Project) -> int:
    task_total = project.tasks.exclude(status=ProjectTaskStatus.CANCELLED).count()
    task_done = project.tasks.filter(status=ProjectTaskStatus.DONE).count()
    objective_values = [objective_progress(item) for item in project.objective_items.all()]
    milestone_total = project.milestones.count()
    milestone_done = project.milestones.filter(status=ProjectMilestoneStatus.COMPLETED).count()
    parts = []
    if task_total:
        parts.append(Decimal(task_done * 100) / Decimal(task_total))
    if objective_values:
        parts.append(sum(objective_values, ZERO) / Decimal(len(objective_values)))
    if milestone_total:
        parts.append(Decimal(milestone_done * 100) / Decimal(milestone_total))
    if not parts:
        return project.progress
    return int(round(sum(parts, ZERO) / Decimal(len(parts)), 0))


def sync_project_progress(project: Project) -> Project:
    if project.progress_mode != "AUTO":
        return project
    project.progress = calculated_project_progress(project)
    project.save(update_fields=["progress", "updated_at"])
    return project


@transaction.atomic
def add_project_member(*, project: Project, actor, member, role: str) -> ProjectMember:
    if member.workspace_id != project.workspace_id:
        raise ValueError("Le membre appartient a un autre workspace.")
    item, created = ProjectMember.objects.update_or_create(workspace=project.workspace, project=project, member=member, defaults={"role": role, "is_active": True, "created_by": actor})
    log_project_activity(project=project, actor=actor, action="project.member_added", metadata={"member_id": member.id, "role": role, "created": created})
    return item


@transaction.atomic
def update_project_member(*, item: ProjectMember, actor, **data) -> ProjectMember:
    item = ProjectMember.objects.select_for_update().select_related("project").get(id=item.id)
    for field, value in data.items():
        setattr(item, field, value)
    item.save()
    log_project_activity(project=item.project, actor=actor, action="project.member_updated", metadata={"member_id": item.member_id})
    return item


@transaction.atomic
def remove_project_member(*, item: ProjectMember, actor) -> ProjectMember:
    item = ProjectMember.objects.select_for_update().select_related("project").get(id=item.id)
    item.is_active = False
    item.save(update_fields=["is_active", "updated_at"])
    log_project_activity(project=item.project, actor=actor, action="project.member_removed", metadata={"member_id": item.member_id})
    return item


def dependency_would_cycle(task: ProjectTask, dependency: ProjectTask) -> bool:
    if task.id == dependency.id:
        return True
    stack = list(dependency.dependencies.all())
    seen = set()
    while stack:
        current = stack.pop()
        if current.id == task.id:
            return True
        if current.id in seen:
            continue
        seen.add(current.id)
        stack.extend(current.dependencies.all())
    return False


@transaction.atomic
def create_project_task(*, project: Project, actor, dependencies=None, **data) -> ProjectTask:
    assignee = data.get("assignee")
    milestone = data.get("milestone")
    if assignee and assignee.workspace_id != project.workspace_id:
        raise ValueError("L'assigne appartient a un autre workspace.")
    if milestone and milestone.project_id != project.id:
        raise ValueError("Le jalon appartient a un autre projet.")
    task = ProjectTask.objects.create(workspace=project.workspace, project=project, created_by=actor, **data)
    for dependency in dependencies or []:
        if dependency.project_id != project.id:
            raise ValueError("La dependance appartient a un autre projet.")
        if dependency_would_cycle(task, dependency):
            raise ValueError("La dependance cree un cycle.")
        task.dependencies.add(dependency)
    log_project_activity(project=project, actor=actor, action="project.task_created", metadata={"task_id": task.id})
    sync_project_progress(project)
    return task


@transaction.atomic
def update_project_task(*, task: ProjectTask, actor, dependencies=None, **data) -> ProjectTask:
    task = ProjectTask.objects.select_for_update().select_related("project").get(id=task.id)
    for field, value in data.items():
        setattr(task, field, value)
    if task.status == ProjectTaskStatus.DONE and not task.completed_at:
        task.completed_at = timezone.now()
    task.save()
    if dependencies is not None:
        task.dependencies.clear()
        for dependency in dependencies:
            if dependency.project_id != task.project_id:
                raise ValueError("La dependance appartient a un autre projet.")
            if dependency_would_cycle(task, dependency):
                raise ValueError("La dependance cree un cycle.")
            task.dependencies.add(dependency)
    log_project_activity(project=task.project, actor=actor, action="project.task_updated", metadata={"task_id": task.id, "status": task.status})
    sync_project_progress(task.project)
    return task


def complete_project_task(*, task: ProjectTask, actor) -> ProjectTask:
    task = update_project_task(task=task, actor=actor, status=ProjectTaskStatus.DONE)
    log_project_activity(project=task.project, actor=actor, action="project.task_completed", metadata={"task_id": task.id})
    return task


@transaction.atomic
def create_project_objective(*, project: Project, actor, **data) -> ProjectObjective:
    objective = ProjectObjective.objects.create(workspace=project.workspace, project=project, created_by=actor, **data)
    log_project_activity(project=project, actor=actor, action="project.objective_created", metadata={"objective_id": objective.id})
    sync_project_progress(project)
    return objective


@transaction.atomic
def update_project_objective(*, objective: ProjectObjective, actor, **data) -> ProjectObjective:
    objective = ProjectObjective.objects.select_for_update().select_related("project").get(id=objective.id)
    for field, value in data.items():
        setattr(objective, field, value)
    objective.save()
    log_project_activity(project=objective.project, actor=actor, action="project.objective_updated", metadata={"objective_id": objective.id})
    sync_project_progress(objective.project)
    return objective


@transaction.atomic
def create_project_milestone(*, project: Project, actor, **data) -> ProjectMilestone:
    milestone = ProjectMilestone.objects.create(workspace=project.workspace, project=project, created_by=actor, **data)
    log_project_activity(project=project, actor=actor, action="project.milestone_created", metadata={"milestone_id": milestone.id})
    sync_project_progress(project)
    return milestone


@transaction.atomic
def update_project_milestone(*, milestone: ProjectMilestone, actor, **data) -> ProjectMilestone:
    milestone = ProjectMilestone.objects.select_for_update().select_related("project").get(id=milestone.id)
    for field, value in data.items():
        setattr(milestone, field, value)
    if milestone.status == ProjectMilestoneStatus.COMPLETED and not milestone.completed_at:
        milestone.completed_at = timezone.now()
    milestone.save()
    log_project_activity(project=milestone.project, actor=actor, action="project.milestone_updated", metadata={"milestone_id": milestone.id})
    sync_project_progress(milestone.project)
    return milestone


@transaction.atomic
def create_project_comment(*, project: Project, actor, content: str, mentions=None) -> ProjectComment:
    comment = ProjectComment.objects.create(workspace=project.workspace, project=project, author=actor, content=content, mentions=mentions or [])
    log_project_activity(project=project, actor=actor, action="project.comment_created", metadata={"comment_id": comment.id})
    return comment


def project_risk_score(project: Project) -> dict:
    causes = []
    score = 0
    today = timezone.localdate()
    budget = project_budget_summary(project)
    if project.end_date and project.end_date < today and project.status not in {ProjectStatus.COMPLETED, ProjectStatus.CANCELLED, ProjectStatus.ARCHIVED}:
        score += 35
        causes.append("Projet en retard")
    if budget["consumed_rate"] >= 100:
        score += 35
        causes.append("Budget depasse")
    elif budget["consumed_rate"] >= 90:
        score += 25
        causes.append("Budget au-dessus de 90%")
    blocked = project.tasks.filter(status=ProjectTaskStatus.BLOCKED).count()
    if blocked:
        score += min(blocked * 10, 25)
        causes.append("Taches bloquees")
    delayed_milestones = project.milestones.filter(due_date__lt=today).exclude(status=ProjectMilestoneStatus.COMPLETED).count()
    if delayed_milestones:
        score += min(delayed_milestones * 15, 30)
        causes.append("Jalons en retard")
    level = ProjectRiskLevel.LOW
    if score >= 80:
        level = ProjectRiskLevel.CRITICAL
    elif score >= 55:
        level = ProjectRiskLevel.HIGH
    elif score >= 25:
        level = ProjectRiskLevel.MEDIUM
    return {"score": score, "level": level, "causes": causes, "recommended_action": "Revoir planning, budget et taches bloquees." if causes else "Continuer le suivi normal."}


def evaluate_project_alerts(project: Project) -> list[ProjectAlert]:
    alerts = []
    risk = project_risk_score(project)
    budget = project_budget_summary(project)
    candidates = []
    if project.tasks.filter(due_date__lt=timezone.localdate()).exclude(status__in=[ProjectTaskStatus.DONE, ProjectTaskStatus.CANCELLED]).exists():
        candidates.append((ProjectAlertType.TASK_OVERDUE, ProjectRiskLevel.HIGH, "Des taches du projet sont en retard."))
    if project.end_date and 0 <= (project.end_date - timezone.localdate()).days <= 15:
        candidates.append((ProjectAlertType.DEADLINE_NEAR, ProjectRiskLevel.MEDIUM, "L'echeance du projet est proche."))
    if budget["consumed_rate"] >= 100:
        candidates.append((ProjectAlertType.BUDGET_EXCEEDED, ProjectRiskLevel.CRITICAL, "Le budget du projet est depasse."))
    elif budget["consumed_rate"] >= 90:
        candidates.append((ProjectAlertType.BUDGET_NEAR_LIMIT, ProjectRiskLevel.HIGH, "Le budget du projet approche sa limite."))
    if project.milestones.filter(due_date__lt=timezone.localdate()).exclude(status=ProjectMilestoneStatus.COMPLETED).exists():
        candidates.append((ProjectAlertType.MILESTONE_DELAYED, ProjectRiskLevel.HIGH, "Un jalon du projet est en retard."))
    for alert_type, severity, message in candidates:
        alert, created = ProjectAlert.objects.get_or_create(workspace=project.workspace, project=project, alert_type=alert_type, is_resolved=False, defaults={"severity": severity, "message": message})
        if created:
            alerts.append(alert)
            log_project_activity(project=project, actor=None, action=alert_type, metadata={"risk": risk["level"]})
    return alerts


def project_analytics(project: Project) -> dict:
    sync_project_progress(project)
    budget = project_budget_summary(project)
    risk = project_risk_score(project)
    tasks = project.tasks.aggregate(
        task_count=Count("id"),
        completed_tasks=Count("id", filter=Q(status=ProjectTaskStatus.DONE)),
        blocked_tasks=Count("id", filter=Q(status=ProjectTaskStatus.BLOCKED)),
        overdue_tasks=Count("id", filter=Q(due_date__lt=timezone.localdate()) & ~Q(status__in=[ProjectTaskStatus.DONE, ProjectTaskStatus.CANCELLED])),
    )
    milestones = project.milestones.aggregate(milestone_count=Count("id"), completed_milestones=Count("id", filter=Q(status=ProjectMilestoneStatus.COMPLETED)))
    return {
        "progress": project.progress,
        "budget": budget["budget"],
        "actual_expense": budget["actual_expense"],
        "remaining_budget": budget["remaining"],
        "funding_received": budget["funding_received"],
        "project_balance": budget["project_balance"],
        "task_count": tasks["task_count"] or 0,
        "completed_tasks": tasks["completed_tasks"] or 0,
        "blocked_tasks": tasks["blocked_tasks"] or 0,
        "overdue_tasks": tasks["overdue_tasks"] or 0,
        "milestone_count": milestones["milestone_count"] or 0,
        "completed_milestones": milestones["completed_milestones"] or 0,
        "objective_count": project.objective_items.count(),
        "risk_level": risk["level"],
        "risk_score": risk["score"],
        "risk_causes": risk["causes"],
    }


def project_report_payload(project: Project) -> dict:
    return {
        "presentation": {"id": project.id, "code": project.code, "name": project.name, "status": project.status, "priority": project.priority},
        "objectives": [{"name": item.name, "target": item.target, "current": item.current_value, "unit": item.unit, "progress": objective_progress(item)} for item in project.objective_items.all()],
        "analytics": project_analytics(project),
        "budget": project_budget_summary(project),
        "team": [{"member": str(item.member), "role": item.role} for item in project.team_members.select_related("member").filter(is_active=True)],
        "activity": [{"action": item.action, "created_at": item.created_at, "metadata": item.metadata} for item in project.activities.order_by("-created_at")[:30]],
        "export_formats_prepared": ["pdf", "xlsx"],
    }
