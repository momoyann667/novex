from dataclasses import dataclass
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.members.models import Member
from apps.contributions.models import Contribution
from apps.contributions.services import contribution_stats
from apps.payments.models import Payment
from apps.projects.services import workspace_project_stats
from apps.workspaces.models import Workspace


@dataclass(frozen=True)
class DashboardPeriod:
    code: str
    label: str


SUPPORTED_PERIODS = {
    "today": DashboardPeriod("today", "Aujourd'hui"),
    "week": DashboardPeriod("week", "Cette semaine"),
    "month": DashboardPeriod("month", "Ce mois"),
    "quarter": DashboardPeriod("quarter", "Ce trimestre"),
    "year": DashboardPeriod("year", "Cette annee"),
    "previous_year": DashboardPeriod("previous_year", "Annee precedente"),
}


def resolve_period(period: str | None) -> DashboardPeriod:
    return SUPPORTED_PERIODS.get(period or "month", SUPPORTED_PERIODS["month"])


def format_money(value: Decimal, currency: str) -> str:
    amount = int(value)
    return f"{amount:,}".replace(",", " ") + f" {currency}"


def get_dashboard_overview(*, workspace: Workspace, period_code: str | None, user_permissions: set[str]) -> dict:
    period = resolve_period(period_code)
    now = timezone.now()

    member_stats = Member.objects.filter(workspace=workspace).aggregate(
        total=Count("id"),
        active=Count("id", filter=Q(status="active")),
    )
    total_members = member_stats["total"] or 0
    active_members = member_stats["active"] or 0
    active_rate = round((active_members / total_members) * 100, 1) if total_members else 0

    can_view_finance = bool({"*", "finance.view", "contributions.view", "expenses.view", "revenues.view"} & user_permissions)

    zero = Decimal("0")
    contribution_totals = contribution_stats(workspace)
    successful_payments = (
        Payment.objects.filter(workspace=workspace, status=Payment.Status.SUCCESSFUL).aggregate(total=Sum("amount"))["total"]
        or zero
    )
    expenses = zero
    project_totals = workspace_project_stats(workspace)
    net_flow = successful_payments - expenses
    finance = {
        "current_balance": format_money(zero, workspace.currency),
        "revenues": format_money(successful_payments, workspace.currency),
        "expenses": format_money(expenses, workspace.currency),
        "net_flow": format_money(net_flow, workspace.currency),
        "masked": not can_view_finance,
    }

    if not can_view_finance:
        finance = {**finance, "current_balance": None, "revenues": None, "expenses": None, "net_flow": None}

    return {
        "workspace": {"id": workspace.id, "name": workspace.name, "slug": workspace.slug, "currency": workspace.currency},
        "period": {"code": period.code, "label": period.label, "server_now": now.isoformat()},
        "kpis": {
            "finance": finance,
            "members": {
                "total": total_members,
                "active": active_members,
                "active_rate": active_rate,
                "new_members": 0,
                "contribution_current": contribution_totals["current_members"],
                "contribution_current_rate": round((contribution_totals["current_members"] / active_members) * 100, 1) if active_members else 0,
            },
            "contributions": {
                "objective": format_money(contribution_totals["expected"], workspace.currency) if can_view_finance else None,
                "collected": format_money(contribution_totals["collected"], workspace.currency) if can_view_finance else None,
                "remaining": format_money(contribution_totals["remaining"], workspace.currency) if can_view_finance else None,
                "recovery_rate": contribution_totals["recovery_rate"],
                "late_members": contribution_totals["late_members"],
            },
            "projects": {
                "total": project_totals["total_projects"],
                "active": project_totals["active_projects"],
                "at_risk": project_totals["delayed_projects"],
                "late": project_totals["delayed_projects"],
            },
            "events": {"upcoming": 0},
            "documents": {"recent": 0},
        },
        "series": {
            "financial_overview": [],
            "expense_breakdown": [],
            "revenue_breakdown": [],
            "cash_flow": {"in": int(successful_payments), "out": int(expenses), "net": int(net_flow)},
        },
        "alerts": [],
        "activity": [],
        "insights": [],
        "empty_state": total_members == 0,
        "last_updated_at": now.isoformat(),
    }
