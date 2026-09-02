from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.finance.models import FinancialTransaction
from apps.finance.statuses import FinancialCategoryKind, FinancialTransactionStatus, FinancialTransactionType
from apps.workspaces.models import Workspace
from .models import Budget, BudgetActivity, BudgetAlert, BudgetAssignment, BudgetLine, BudgetSettings
from .statuses import BudgetAlertSeverity, BudgetAlertType, BudgetRiskLevel, BudgetScopeType, BudgetStatus


ZERO = Decimal("0.00")


def budget_settings(workspace: Workspace) -> BudgetSettings:
    settings, _created = BudgetSettings.objects.get_or_create(workspace=workspace)
    return settings


def log_budget_action(*, budget: Budget, actor, action: str, metadata: dict | None = None) -> None:
    payload = metadata or {}
    BudgetActivity.objects.create(workspace=budget.workspace, budget=budget, actor=actor, action=action, metadata=payload)
    AuditLog.objects.create(workspace=budget.workspace, actor=actor, action=action, resource="budget", resource_id=str(budget.id), metadata=payload)


def validate_workspace_relation(workspace: Workspace, item, field: str) -> None:
    if item and item.workspace_id != workspace.id:
        raise ValueError(f"{field} appartient a un autre workspace.")


def validate_budget_scope(*, workspace: Workspace, scope_type: str, project=None, event=None) -> None:
    validate_workspace_relation(workspace, project, "Le projet")
    validate_workspace_relation(workspace, event, "L'evenement")
    if scope_type == BudgetScopeType.PROJECT and not project:
        raise ValueError("Un budget de projet doit etre associe a un projet.")
    if scope_type == BudgetScopeType.EVENT and not event:
        raise ValueError("Un budget d'evenement doit etre associe a un evenement.")
    if scope_type == BudgetScopeType.WORKSPACE and (project or event):
        raise ValueError("Un budget association ne doit pas etre lie a un projet ou un evenement.")


def validate_budget_dates(start_date, end_date) -> None:
    if end_date < start_date:
        raise ValueError("La date de fin doit etre posterieure au debut.")


def validate_budget_lines_total(budget: Budget) -> None:
    planned = budget.lines.filter(is_active=True).aggregate(total=Sum("planned_amount"))["total"] or ZERO
    if planned > budget.total_amount:
        raise ValueError("La somme des lignes budgetaires depasse le budget total.")


@transaction.atomic
def create_budget(*, workspace: Workspace, actor, **data) -> Budget:
    validate_budget_dates(data["start_date"], data["end_date"])
    if data.get("total_amount", ZERO) <= ZERO:
        raise ValueError("Le montant alloue doit etre positif.")
    validate_budget_scope(workspace=workspace, scope_type=data.get("scope_type") or BudgetScopeType.WORKSPACE, project=data.get("project"), event=data.get("event"))
    data.setdefault("currency", workspace.currency)
    budget = Budget.objects.create(workspace=workspace, created_by=actor, **data)
    log_budget_action(budget=budget, actor=actor, action="budget.created", metadata={"total_amount": str(budget.total_amount)})
    return budget


@transaction.atomic
def update_budget(*, budget: Budget, actor, **data) -> Budget:
    budget = Budget.objects.select_for_update().get(id=budget.id)
    if budget.status in {BudgetStatus.CLOSED, BudgetStatus.ARCHIVED}:
        raise ValueError("Un budget cloture ou archive ne peut pas etre modifie.")
    start_date = data.get("start_date", budget.start_date)
    end_date = data.get("end_date", budget.end_date)
    validate_budget_dates(start_date, end_date)
    scope_type = data.get("scope_type", budget.scope_type)
    project = data.get("project", budget.project)
    event = data.get("event", budget.event)
    validate_budget_scope(workspace=budget.workspace, scope_type=scope_type, project=project, event=event)
    for field, value in data.items():
        setattr(budget, field, value)
    budget.save()
    validate_budget_lines_total(budget)
    log_budget_action(budget=budget, actor=actor, action="budget.updated")
    return budget


@transaction.atomic
def activate_budget(*, budget: Budget, actor) -> Budget:
    budget = Budget.objects.select_for_update().get(id=budget.id)
    validate_budget_lines_total(budget)
    if budget.status in {BudgetStatus.CLOSED, BudgetStatus.ARCHIVED}:
        raise ValueError("Un budget cloture ou archive ne peut pas etre active.")
    budget.status = BudgetStatus.ACTIVE
    budget.save(update_fields=["status", "updated_at"])
    log_budget_action(budget=budget, actor=actor, action="budget.activated")
    return budget


@transaction.atomic
def close_budget(*, budget: Budget, actor) -> Budget:
    budget = Budget.objects.select_for_update().get(id=budget.id)
    if budget.status == BudgetStatus.ARCHIVED:
        raise ValueError("Un budget archive est deja hors exploitation.")
    budget.status = BudgetStatus.CLOSED
    budget.closed_by = actor
    budget.closed_at = timezone.now()
    budget.save(update_fields=["status", "closed_by", "closed_at", "updated_at"])
    log_budget_action(budget=budget, actor=actor, action="budget.closed")
    return budget


@transaction.atomic
def archive_budget(*, budget: Budget, actor) -> Budget:
    budget = Budget.objects.select_for_update().get(id=budget.id)
    if budget.status != BudgetStatus.CLOSED:
        raise ValueError("Seul un budget cloture peut etre archive.")
    budget.status = BudgetStatus.ARCHIVED
    budget.archived_by = actor
    budget.archived_at = timezone.now()
    budget.save(update_fields=["status", "archived_by", "archived_at", "updated_at"])
    log_budget_action(budget=budget, actor=actor, action="budget.archived")
    return budget


@transaction.atomic
def create_budget_line(*, budget: Budget, actor, **data) -> BudgetLine:
    budget = Budget.objects.select_for_update().get(id=budget.id)
    if budget.status in {BudgetStatus.CLOSED, BudgetStatus.ARCHIVED}:
        raise ValueError("Un budget cloture ou archive ne peut pas recevoir de ligne.")
    if data.get("planned_amount", ZERO) <= ZERO:
        raise ValueError("Le montant de la ligne budgetaire doit etre positif.")
    category = data["category"]
    validate_workspace_relation(budget.workspace, category, "La categorie")
    if category.kind != FinancialCategoryKind.EXPENSE_CATEGORY:
        raise ValueError("Une ligne budgetaire doit pointer vers une categorie de depense.")
    line = BudgetLine.objects.create(workspace=budget.workspace, budget=budget, **data)
    validate_budget_lines_total(budget)
    log_budget_action(budget=budget, actor=actor, action="budget_line.created", metadata={"line_id": line.id, "category": category.name})
    return line


@transaction.atomic
def update_budget_line(*, line: BudgetLine, actor, **data) -> BudgetLine:
    line = BudgetLine.objects.select_for_update().select_related("budget").get(id=line.id)
    if line.budget.status in {BudgetStatus.CLOSED, BudgetStatus.ARCHIVED}:
        raise ValueError("Une ligne d'un budget cloture ou archive ne peut pas etre modifiee.")
    if data.get("category"):
        validate_workspace_relation(line.workspace, data["category"], "La categorie")
    for field, value in data.items():
        setattr(line, field, value)
    line.save()
    validate_budget_lines_total(line.budget)
    log_budget_action(budget=line.budget, actor=actor, action="budget_line.updated", metadata={"line_id": line.id})
    return line


@transaction.atomic
def archive_budget_line(*, line: BudgetLine, actor) -> BudgetLine:
    line = BudgetLine.objects.select_for_update().select_related("budget").get(id=line.id)
    if line.assignments.exists():
        line.is_active = False
        line.save(update_fields=["is_active", "updated_at"])
    else:
        line.delete()
    log_budget_action(budget=line.budget, actor=actor, action="budget_line.updated", metadata={"line_id": line.id, "archived": True})
    return line


def expense_sum_for_line(line: BudgetLine, *, status: str, year: int | None = None) -> Decimal:
    queryset = BudgetAssignment.objects.filter(
        budget_line=line,
        transaction__transaction_type=FinancialTransactionType.EXPENSE,
        transaction__status=status,
    )
    if year:
        queryset = queryset.filter(transaction__transaction_date__year=year)
    return queryset.aggregate(total=Sum("transaction__amount"))["total"] or ZERO


def line_summary(line: BudgetLine, *, year: int | None = None) -> dict:
    actual = expense_sum_for_line(line, status=FinancialTransactionStatus.VALIDATED, year=year)
    pending = expense_sum_for_line(line, status=FinancialTransactionStatus.PENDING, year=year)
    committed = line.committed_amount + pending
    remaining = line.planned_amount - actual - committed
    rate = round((actual / line.planned_amount) * 100, 2) if line.planned_amount else Decimal("0.00")
    return {
        "id": line.id,
        "category": line.category.name,
        "category_id": line.category_id,
        "planned": line.planned_amount,
        "committed": committed,
        "actual": actual,
        "remaining": remaining,
        "variance": line.planned_amount - actual,
        "consumption_rate": rate,
        "risk_level": risk_level(rate, line.budget.workspace),
    }


def budget_summary(budget: Budget, *, year: int | None = None) -> dict:
    lines = [line_summary(line, year=year) for line in budget.lines.filter(is_active=True).select_related("category", "budget", "budget__workspace")]
    planned = sum((item["planned"] for item in lines), ZERO) or budget.total_amount
    actual = sum((item["actual"] for item in lines), ZERO)
    committed = sum((item["committed"] for item in lines), ZERO)
    remaining = budget.total_amount - actual - committed
    rate = round((actual / budget.total_amount) * 100, 2) if budget.total_amount else Decimal("0.00")
    return {
        "id": budget.id,
        "name": budget.name,
        "status": budget.status,
        "scope_type": budget.scope_type,
        "planned": planned,
        "budget_total": budget.total_amount,
        "committed": committed,
        "actual": actual,
        "remaining": remaining,
        "variance": budget.total_amount - actual,
        "consumption_rate": rate,
        "overrun": max(actual - budget.total_amount, ZERO),
        "risk_level": risk_level(rate, budget.workspace),
        "lines": lines,
    }


def risk_level(rate: Decimal, workspace: Workspace) -> str:
    thresholds = budget_settings(workspace).thresholds or {}
    if rate >= Decimal(str(thresholds.get("exceeded", 100))):
        return BudgetRiskLevel.EXCEEDED
    if rate >= Decimal(str(thresholds.get("critical", 90))):
        return BudgetRiskLevel.CRITICAL
    if rate >= Decimal(str(thresholds.get("attention", 75))):
        return BudgetRiskLevel.ATTENTION
    if rate >= Decimal(str(thresholds.get("watch", 50))):
        return BudgetRiskLevel.WATCH
    return BudgetRiskLevel.NORMAL


def matching_budget_queryset(transaction_obj: FinancialTransaction):
    scope_filter = Q(scope_type=BudgetScopeType.WORKSPACE)
    if transaction_obj.project_id:
        scope_filter |= Q(scope_type=BudgetScopeType.PROJECT, project_id=transaction_obj.project_id)
    if transaction_obj.event_id:
        scope_filter |= Q(scope_type=BudgetScopeType.EVENT, event_id=transaction_obj.event_id)
    return Budget.objects.filter(
        workspace=transaction_obj.workspace,
        status=BudgetStatus.ACTIVE,
        start_date__lte=transaction_obj.transaction_date,
        end_date__gte=transaction_obj.transaction_date,
    ).filter(scope_filter)


def find_matching_budget_line(transaction_obj: FinancialTransaction) -> BudgetLine | None:
    if transaction_obj.transaction_type != FinancialTransactionType.EXPENSE or not transaction_obj.category_id:
        return None
    lines = BudgetLine.objects.select_related("budget", "category").filter(
        workspace=transaction_obj.workspace,
        is_active=True,
        category=transaction_obj.category,
        budget__in=matching_budget_queryset(transaction_obj),
    )
    return lines.first() if lines.count() == 1 else None


@transaction.atomic
def assign_expense_to_budget(*, transaction_obj: FinancialTransaction, actor=None, budget_line: BudgetLine, is_manual: bool = False) -> BudgetAssignment:
    transaction_obj = FinancialTransaction.objects.select_for_update().select_related("workspace", "category").get(id=transaction_obj.id)
    line = BudgetLine.objects.select_for_update().select_related("budget", "category").get(id=budget_line.id)
    if transaction_obj.transaction_type != FinancialTransactionType.EXPENSE:
        raise ValueError("Seules les depenses peuvent etre affectees a un budget.")
    validate_workspace_relation(transaction_obj.workspace, line, "La ligne budgetaire")
    if line.category_id != transaction_obj.category_id:
        raise ValueError("La ligne budgetaire ne correspond pas a la categorie de la depense.")
    if line.budget.status != BudgetStatus.ACTIVE:
        raise ValueError("La ligne budgetaire doit appartenir a un budget actif.")
    if not (line.budget.start_date <= transaction_obj.transaction_date <= line.budget.end_date):
        raise ValueError("La depense est hors periode budgetaire.")
    if line.budget.scope_type == BudgetScopeType.PROJECT and line.budget.project_id != transaction_obj.project_id:
        raise ValueError("La depense ne correspond pas au projet du budget.")
    if line.budget.scope_type == BudgetScopeType.EVENT and line.budget.event_id != transaction_obj.event_id:
        raise ValueError("La depense ne correspond pas a l'evenement du budget.")
    remaining = line_summary(line)["remaining"]
    if not budget_settings(transaction_obj.workspace).allow_over_budget_expense and transaction_obj.amount > remaining:
        raise ValueError("Budget insuffisant pour cette depense.")
    try:
        previous = transaction_obj.budget_assignment
    except BudgetAssignment.DoesNotExist:
        previous = None
    assignment, created = BudgetAssignment.objects.update_or_create(
        transaction=transaction_obj,
        defaults={"workspace": transaction_obj.workspace, "budget": line.budget, "budget_line": line, "assigned_by": actor, "is_manual": is_manual},
    )
    action = "budget.expense_assigned" if created else "budget.expense_reassigned"
    log_budget_action(
        budget=line.budget,
        actor=actor,
        action=action,
        metadata={"transaction_id": transaction_obj.id, "line_id": line.id, "previous_budget_id": getattr(previous, "budget_id", None)},
    )
    evaluate_budget_alerts(line.budget, actor=actor)
    return assignment


def auto_assign_expense(*, transaction_obj: FinancialTransaction, actor=None) -> BudgetAssignment | None:
    line = find_matching_budget_line(transaction_obj)
    if not line:
        return None
    return assign_expense_to_budget(transaction_obj=transaction_obj, actor=actor, budget_line=line, is_manual=False)


def evaluate_budget_alerts(budget: Budget, actor=None) -> list[BudgetAlert]:
    summary = budget_summary(budget)
    rate = Decimal(str(summary["consumption_rate"]))
    settings = budget_settings(budget.workspace)
    channels = []
    if settings.notify_in_app:
        channels.append("in_app")
    if settings.notify_email:
        channels.append("email")
    if settings.notify_whatsapp:
        channels.append("whatsapp")
    if settings.notify_sms:
        channels.append("sms")
    alerts = []
    thresholds = settings.thresholds or {}
    candidates = [
        ("watch", thresholds.get("watch", 50), BudgetAlertType.THRESHOLD_REACHED, BudgetAlertSeverity.INFO),
        ("attention", thresholds.get("attention", 75), BudgetAlertType.THRESHOLD_REACHED, BudgetAlertSeverity.WARNING),
        ("critical", thresholds.get("critical", 90), BudgetAlertType.NEARLY_EXCEEDED, BudgetAlertSeverity.CRITICAL),
        ("exceeded", thresholds.get("exceeded", 100), BudgetAlertType.EXCEEDED, BudgetAlertSeverity.CRITICAL),
    ]
    for _key, threshold, alert_type, severity in candidates:
        if rate < Decimal(str(threshold)):
            continue
        exists = BudgetAlert.objects.filter(budget=budget, alert_type=alert_type, threshold_percent=threshold, is_resolved=False).exists()
        if exists:
            continue
        alert = BudgetAlert.objects.create(
            workspace=budget.workspace,
            budget=budget,
            alert_type=alert_type,
            severity=severity,
            threshold_percent=threshold,
            current_percent=rate,
            channels=channels,
            message=f"{budget.name}: seuil budgetaire de {threshold}% atteint.",
        )
        log_budget_action(budget=budget, actor=actor, action=alert_type, metadata={"threshold": threshold, "rate": str(rate)})
        alerts.append(alert)
    return alerts


def budget_period_filter(queryset, *, year: int | None = None):
    if not year:
        return queryset
    return queryset.filter(start_date__year__lte=year, end_date__year__gte=year)


def budget_dashboard(*, workspace: Workspace, year: int | None = None) -> dict:
    budgets = budget_period_filter(Budget.objects.filter(workspace=workspace, status=BudgetStatus.ACTIVE), year=year).prefetch_related("lines__category").select_related("workspace", "project", "event")
    cards = [budget_summary(item, year=year) for item in budgets]
    total = sum((item["budget_total"] for item in cards), ZERO)
    actual = sum((item["actual"] for item in cards), ZERO)
    committed = sum((item["committed"] for item in cards), ZERO)
    remaining = total - actual - committed
    rate = round((actual / total) * 100, 2) if total else Decimal("0.00")
    unbudgeted = FinancialTransaction.objects.filter(
        workspace=workspace,
        transaction_type=FinancialTransactionType.EXPENSE,
        status=FinancialTransactionStatus.VALIDATED,
        budget_assignment__isnull=True,
    ).aggregate(total=Sum("amount"))["total"] or ZERO
    return {
        "year": year or timezone.localdate().year,
        "currency": workspace.currency,
        "budget_total": total,
        "committed": committed,
        "actual": actual,
        "remaining": remaining,
        "consumption_rate": rate,
        "overrun": sum((item["overrun"] for item in cards), ZERO),
        "risk_count": sum(1 for item in cards if item["risk_level"] in {BudgetRiskLevel.ATTENTION, BudgetRiskLevel.CRITICAL}),
        "exceeded_count": sum(1 for item in cards if item["risk_level"] == BudgetRiskLevel.EXCEEDED),
        "unbudgeted_expense": unbudgeted,
        "budgets": cards,
        "alerts": budget_alerts(workspace=workspace)[:8],
    }


def budget_analytics(*, budget: Budget) -> dict:
    summary = budget_summary(budget)
    monthly_rows = (
        BudgetAssignment.objects.filter(budget=budget, transaction__status=FinancialTransactionStatus.VALIDATED)
        .annotate(month=TruncMonth("transaction__transaction_date"))
        .values("month")
        .annotate(actual=Sum("transaction__amount"))
        .order_by("month")
    )
    by_month = [{"period": (row["month"].date() if hasattr(row["month"], "date") else row["month"]).isoformat(), "actual": row["actual"] or ZERO} for row in monthly_rows]
    by_category = summary["lines"]
    transactions = [
        {
            "id": assignment.transaction_id,
            "date": assignment.transaction.transaction_date,
            "description": assignment.transaction.description,
            "category": assignment.transaction.category.name,
            "amount": assignment.transaction.amount,
            "project": str(assignment.transaction.project or ""),
            "event": str(assignment.transaction.event or ""),
            "status": assignment.transaction.status,
        }
        for assignment in BudgetAssignment.objects.filter(budget=budget).select_related("transaction", "transaction__category", "transaction__project", "transaction__event").order_by("-transaction__transaction_date")
    ]
    return {**summary, "by_month": by_month, "by_category": by_category, "transactions": transactions}


def budget_alerts(*, workspace: Workspace, filters: dict | None = None) -> list[dict]:
    filters = filters or {}
    queryset = BudgetAlert.objects.filter(workspace=workspace).select_related("budget", "budget_line", "budget_line__category").order_by("-created_at")
    if filters.get("status") == "resolved":
        queryset = queryset.filter(is_resolved=True)
    elif filters.get("status") == "open":
        queryset = queryset.filter(is_resolved=False)
    if filters.get("budget"):
        queryset = queryset.filter(budget_id=filters["budget"])
    if filters.get("severity"):
        queryset = queryset.filter(severity=filters["severity"])
    if filters.get("date"):
        queryset = queryset.filter(created_at__date=filters["date"])
    return [
        {
            "id": alert.id,
            "budget": alert.budget.name,
            "budget_id": alert.budget_id,
            "line": alert.budget_line.category.name if alert.budget_line_id else "",
            "type": alert.alert_type,
            "severity": alert.severity,
            "threshold_percent": alert.threshold_percent,
            "current_percent": alert.current_percent,
            "message": alert.message,
            "channels": alert.channels,
            "is_resolved": alert.is_resolved,
            "created_at": alert.created_at,
        }
        for alert in queryset
    ]


def budget_export_payload(*, budget: Budget) -> dict:
    analytics = budget_analytics(budget=budget)
    return {
        "budget": {"id": budget.id, "name": budget.name, "period": f"{budget.start_date} - {budget.end_date}", "currency": budget.currency},
        "summary": {key: analytics[key] for key in ["planned", "committed", "actual", "remaining", "variance", "consumption_rate"]},
        "lines": analytics["lines"],
        "formats_prepared": ["pdf", "xlsx", "csv"],
    }
