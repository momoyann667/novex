from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.members.models import Member
from apps.contributions.models import Contribution
from apps.contributions.statuses import ContributionStatus
from apps.contributions.services import contribution_stats
from apps.documents.models import Document
from apps.documents.statuses import DocumentStatus
from apps.events.services import workspace_event_stats
from apps.finance.models import FinancialTransaction
from apps.finance.statuses import FinancialTransactionStatus, FinancialTransactionType
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
    "all": DashboardPeriod("all", "Tout"),
}


def resolve_period(period: str | None) -> DashboardPeriod:
    return SUPPORTED_PERIODS.get(period or "month", SUPPORTED_PERIODS["month"])


def format_money(value: Decimal, currency: str) -> str:
    amount = int(value)
    return f"{amount:,}".replace(",", " ") + f" {currency}"


def period_bounds(code: str, now):
    today = timezone.localdate()
    if code == "today":
        return today, today
    if code == "week":
        start = today - timedelta(days=today.weekday())
        return start, today
    if code == "month":
        return today.replace(day=1), today
    if code == "quarter":
        month = ((today.month - 1) // 3) * 3 + 1
        return today.replace(month=month, day=1), today
    if code == "year":
        return today.replace(month=1, day=1), today
    if code == "previous_year":
        year = today.year - 1
        return today.replace(year=year, month=1, day=1), today.replace(year=year, month=12, day=31)
    return None, None


def contribution_totals_for_period(*, workspace: Workspace, start_date, end_date) -> dict:
    queryset = Contribution.objects.filter(workspace=workspace)
    if start_date:
        queryset = queryset.filter(due_date__gte=start_date)
    if end_date:
        queryset = queryset.filter(due_date__lte=end_date)
    totals = queryset.aggregate(
        expected=Sum("amount_due"),
        collected=Sum("amount_paid", filter=Q(status__in=[ContributionStatus.PAID, ContributionStatus.PARTIALLY_PAID, ContributionStatus.WAIVED])),
        waived=Sum("waived_amount"),
    )
    expected = totals["expected"] or Decimal("0")
    collected = totals["collected"] or Decimal("0")
    waived = totals["waived"] or Decimal("0")
    remaining = max(expected - collected - waived, Decimal("0"))
    return {
        "expected": expected,
        "collected": collected,
        "remaining": remaining,
        "recovery_rate": round((collected / expected) * 100, 1) if expected else 0,
        "late_members": queryset.filter(status=ContributionStatus.OVERDUE).values("member_id").distinct().count(),
        "current_members": queryset.filter(status__in=[ContributionStatus.PAID, ContributionStatus.WAIVED]).values("member_id").distinct().count(),
    }


def financial_totals(*, workspace: Workspace, start_date, end_date) -> dict:
    all_transactions = FinancialTransaction.objects.filter(workspace=workspace, status=FinancialTransactionStatus.VALIDATED)
    period_transactions = all_transactions
    if start_date:
        period_transactions = period_transactions.filter(transaction_date__gte=start_date)
    if end_date:
        period_transactions = period_transactions.filter(transaction_date__lte=end_date)

    all_totals = all_transactions.aggregate(
        revenues=Sum("amount", filter=Q(transaction_type=FinancialTransactionType.INCOME)),
        expenses=Sum("amount", filter=Q(transaction_type=FinancialTransactionType.EXPENSE)),
    )
    period_totals = period_transactions.aggregate(
        revenues=Sum("amount", filter=Q(transaction_type=FinancialTransactionType.INCOME)),
        expenses=Sum("amount", filter=Q(transaction_type=FinancialTransactionType.EXPENSE)),
    )
    zero = Decimal("0")
    balance = (all_totals["revenues"] or zero) - (all_totals["expenses"] or zero)
    revenues = period_totals["revenues"] or zero
    expenses = period_totals["expenses"] or zero

    payment_total = Payment.objects.filter(workspace=workspace, status=Payment.Status.SUCCESS).aggregate(total=Sum("amount"))["total"] or zero
    contribution_payment_total = (
        Payment.objects.filter(workspace=workspace, status=Payment.Status.SUCCESS, contribution__isnull=False).aggregate(total=Sum("amount"))["total"] or zero
    )

    if not revenues:
        revenues = payment_total

    return {
        "balance": balance,
        "revenues": revenues,
        "expenses": expenses,
        "net_flow": revenues - expenses,
        "payments_total": payment_total,
        "contribution_payments_total": contribution_payment_total,
        "queryset": period_transactions,
    }


def financial_series(*, workspace: Workspace) -> list[dict]:
    since = timezone.localdate() - timedelta(days=365)
    rows = (
        FinancialTransaction.objects.filter(workspace=workspace, status=FinancialTransactionStatus.VALIDATED, transaction_date__gte=since)
        .annotate(month=TruncMonth("transaction_date"))
        .values("month")
        .annotate(
            revenues=Sum("amount", filter=Q(transaction_type=FinancialTransactionType.INCOME)),
            expenses=Sum("amount", filter=Q(transaction_type=FinancialTransactionType.EXPENSE)),
        )
        .order_by("month")
    )
    return [
        {
            "label": row["month"].strftime("%m/%Y"),
            "revenues": int(row["revenues"] or 0),
            "expenses": int(row["expenses"] or 0),
            "net": int((row["revenues"] or 0) - (row["expenses"] or 0)),
        }
        for row in rows
    ]


def breakdown(queryset, transaction_type: str) -> list[dict]:
    total = queryset.filter(transaction_type=transaction_type).aggregate(total=Sum("amount"))["total"] or Decimal("0")
    rows = (
        queryset.filter(transaction_type=transaction_type)
        .values("category__name")
        .annotate(value=Sum("amount"))
        .order_by("-value")[:6]
    )
    return [
        {
            "label": row["category__name"] or "Non categorise",
            "value": int(row["value"] or 0),
            "percentage": round(((row["value"] or Decimal("0")) / total) * 100, 1) if total else 0,
        }
        for row in rows
    ]


def get_dashboard_overview(*, workspace: Workspace, period_code: str | None, user_permissions: set[str]) -> dict:
    period = resolve_period(period_code)
    now = timezone.now()
    start_date, end_date = period_bounds(period.code, now)

    members = Member.objects.filter(workspace=workspace)
    member_stats = members.aggregate(
        total=Count("id"),
        active=Count("id", filter=Q(status="active")),
    )
    total_members = member_stats["total"] or 0
    active_members = member_stats["active"] or 0
    active_rate = round((active_members / total_members) * 100, 1) if total_members else 0

    can_view_finance = bool({"*", "finance.view", "contributions.view", "expenses.view", "revenues.view"} & user_permissions)

    contribution_totals = contribution_totals_for_period(workspace=workspace, start_date=start_date, end_date=end_date)
    global_contribution_totals = contribution_stats(workspace)
    finances = financial_totals(workspace=workspace, start_date=start_date, end_date=end_date)
    project_totals = workspace_project_stats(workspace)
    event_totals = workspace_event_stats(workspace)
    recent_documents = Document.objects.filter(workspace=workspace, status__in=[DocumentStatus.ACTIVE, DocumentStatus.APPROVED])
    if start_date:
        recent_documents = recent_documents.filter(updated_at__date__gte=start_date)
    if end_date:
        recent_documents = recent_documents.filter(updated_at__date__lte=end_date)
    finance = {
        "current_balance": format_money(finances["balance"], workspace.currency),
        "revenues": format_money(finances["revenues"], workspace.currency),
        "expenses": format_money(finances["expenses"], workspace.currency),
        "net_flow": format_money(finances["net_flow"], workspace.currency),
        "payments_total": format_money(finances["payments_total"], workspace.currency),
        "contribution_payments_total": format_money(finances["contribution_payments_total"], workspace.currency),
        "masked": not can_view_finance,
    }

    if not can_view_finance:
        finance = {**finance, "current_balance": None, "revenues": None, "expenses": None, "net_flow": None, "payments_total": None, "contribution_payments_total": None}

    return {
        "workspace": {"id": workspace.id, "name": workspace.name, "slug": workspace.slug, "currency": workspace.currency},
        "period": {"code": period.code, "label": period.label, "server_now": now.isoformat()},
        "kpis": {
            "finance": finance,
            "members": {
                "total": total_members,
                "active": active_members,
                "active_rate": active_rate,
                "new_members": members.filter(join_date__gte=start_date).count() if start_date else total_members,
                "contribution_current": global_contribution_totals["current_members"],
                "contribution_current_rate": round((global_contribution_totals["current_members"] / active_members) * 100, 1) if active_members else 0,
            },
            "contributions": {
                "objective": format_money(contribution_totals["expected"], workspace.currency) if can_view_finance else None,
                "collected": format_money(contribution_totals["collected"], workspace.currency) if can_view_finance else None,
                "collected_all": format_money(finances["contribution_payments_total"], workspace.currency) if can_view_finance else None,
                "remaining": format_money(contribution_totals["remaining"], workspace.currency) if can_view_finance else None,
                "remaining_all": format_money(global_contribution_totals["remaining"], workspace.currency) if can_view_finance else None,
                "recovery_rate": contribution_totals["recovery_rate"],
                "late_members": contribution_totals["late_members"],
            },
            "projects": {
                "total": project_totals["total_projects"],
                "active": project_totals["active_projects"],
                "at_risk": project_totals["delayed_projects"],
                "late": project_totals["delayed_projects"],
            },
            "events": {"upcoming": event_totals["upcoming_events"]},
            "documents": {"recent": recent_documents.count()},
        },
        "series": {
            "financial_overview": financial_series(workspace=workspace) if can_view_finance else [],
            "expense_breakdown": breakdown(finances["queryset"], FinancialTransactionType.EXPENSE) if can_view_finance else [],
            "revenue_breakdown": breakdown(finances["queryset"], FinancialTransactionType.INCOME) if can_view_finance else [],
            "cash_flow": {"in": int(finances["revenues"]), "out": int(finances["expenses"]), "net": int(finances["net_flow"])},
        },
        "alerts": [
            item
            for item in [
                {
                    "title": "Cotisations",
                    "description": f"{contribution_totals['late_members']} membre(s) ont des cotisations en retard.",
                    "level": "warning",
                }
                if contribution_totals["late_members"]
                else None,
                {"title": "Membres", "description": "Aucun membre actif enregistre.", "level": "info"} if not active_members else None,
                {"title": "Tresorerie", "description": "Les depenses de la periode depassent les recettes.", "level": "danger"} if can_view_finance and finances["expenses"] > finances["revenues"] else None,
            ]
            if item
        ],
        "activity": [
            {
                "title": "Paiement recu",
                "description": f"{payment.member.full_name if payment.member_id else 'Paiement'} - {format_money(payment.amount, payment.currency)}",
                "occurred_at": (payment.paid_at or payment.created_at).isoformat(),
            }
            for payment in Payment.objects.select_related("member").filter(workspace=workspace, status=Payment.Status.SUCCESS).order_by("-created_at")[:6]
        ],
        "insights": [],
        "empty_state": total_members == 0,
        "last_updated_at": now.isoformat(),
    }
