from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal

from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.budgets.services import budget_dashboard
from apps.contributions.models import Contribution
from apps.contributions.services import contribution_stats
from apps.contributions.statuses import ContributionStatus
from apps.documents.services import document_analytics
from apps.events.models import Event, EventParticipant
from apps.events.services import workspace_event_stats
from apps.events.statuses import EventParticipantStatus, EventStatus
from apps.finance.models import FinancialTransaction
from apps.finance.services import category_breakdown, finance_dashboard, finance_totals, growth
from apps.finance.statuses import FinancialTransactionStatus, FinancialTransactionType
from apps.members.models import Member
from apps.projects.models import Project
from apps.projects.services import workspace_project_stats
from apps.projects.statuses import ProjectStatus
from apps.workspaces.models import Workspace


ZERO = Decimal("0.00")


@dataclass(frozen=True)
class AnalyticsPeriod:
    code: str
    label: str
    start: timezone.datetime
    end: timezone.datetime


def resolve_analytics_period(*, code: str | None = None, date_from=None, date_to=None) -> AnalyticsPeriod:
    now = timezone.now()
    today = timezone.localdate()
    if date_from and date_to:
        start = timezone.make_aware(timezone.datetime.fromisoformat(str(date_from)))
        end = timezone.make_aware(timezone.datetime.fromisoformat(str(date_to))) + timedelta(days=1)
        return AnalyticsPeriod("custom", "Personnalise", start, end)
    code = code or "month"
    if code == "today":
        start = timezone.make_aware(timezone.datetime.combine(today, timezone.datetime.min.time()))
        return AnalyticsPeriod(code, "Aujourd'hui", start, now)
    if code == "week":
        start_date = today - timedelta(days=today.weekday())
        start = timezone.make_aware(timezone.datetime.combine(start_date, timezone.datetime.min.time()))
        return AnalyticsPeriod(code, "Cette semaine", start, now)
    if code == "quarter":
        month = ((today.month - 1) // 3) * 3 + 1
        start = timezone.make_aware(timezone.datetime(today.year, month, 1))
        return AnalyticsPeriod(code, "Trimestre", start, now)
    if code == "year":
        start = timezone.make_aware(timezone.datetime(today.year, 1, 1))
        return AnalyticsPeriod(code, "Cette annee", start, now)
    if code == "previous_year":
        start = timezone.make_aware(timezone.datetime(today.year - 1, 1, 1))
        end = timezone.make_aware(timezone.datetime(today.year, 1, 1))
        return AnalyticsPeriod(code, "Annee precedente", start, end)
    start = timezone.make_aware(timezone.datetime(today.year, today.month, 1))
    return AnalyticsPeriod("month", "Ce mois", start, now)


def previous_period(period: AnalyticsPeriod) -> AnalyticsPeriod:
    delta = period.end - period.start
    end = period.start
    start = end - delta
    return AnalyticsPeriod(f"previous_{period.code}", "Periode precedente", start, end)


def percentage(current: Decimal | int, total: Decimal | int) -> Decimal:
    current = Decimal(str(current or 0))
    total = Decimal(str(total or 0))
    return round((current / total) * 100, 2) if total else Decimal("0.00")


def period_filter(field: str, period: AnalyticsPeriod) -> dict:
    return {f"{field}__gte": period.start, f"{field}__lt": period.end}


def date_period_filter(field: str, period: AnalyticsPeriod) -> dict:
    return {f"{field}__gte": period.start.date(), f"{field}__lt": period.end.date()}


def kpi(value, previous=None) -> dict:
    if previous is None:
        return {"value": value, "variation": None, "direction": "flat", "comparison": "periode precedente"}
    trend = growth(Decimal(str(value or 0)), Decimal(str(previous or 0)))
    return {"value": value, "variation": trend["value"], "direction": trend["direction"], "comparison": "periode precedente"}


def finance_analytics(*, workspace: Workspace, period: AnalyticsPeriod) -> dict:
    current_qs = FinancialTransaction.objects.filter(workspace=workspace, status=FinancialTransactionStatus.VALIDATED, **date_period_filter("transaction_date", period))
    previous_qs = FinancialTransaction.objects.filter(workspace=workspace, status=FinancialTransactionStatus.VALIDATED, **date_period_filter("transaction_date", previous_period(period)))
    current = finance_totals(current_qs)
    previous = finance_totals(previous_qs)
    budget = budget_dashboard(workspace=workspace)
    dashboard = finance_dashboard(workspace=workspace, range_code="12m", group_by="month")
    return {
        "period": period_payload(period),
        "balance": kpi(current["net_cashflow"], previous["net_cashflow"]),
        "income": kpi(current["income"], previous["income"]),
        "expense": kpi(current["expense"], previous["expense"]),
        "net_result": kpi(current["net_cashflow"], previous["net_cashflow"]),
        "budget": budget,
        "budget_variance": budget["remaining"],
        "income_series": dashboard["series"],
        "expense_series": dashboard["series"],
        "cash_flow": dashboard["series"],
        "income_breakdown": category_breakdown(workspace=workspace, transaction_type=FinancialTransactionType.INCOME),
        "expense_breakdown": category_breakdown(workspace=workspace, transaction_type=FinancialTransactionType.EXPENSE),
        "alerts": dashboard["alerts"] + budget.get("alerts", []),
    }


def contributions_analytics(*, workspace: Workspace, period: AnalyticsPeriod) -> dict:
    stats = contribution_stats(workspace)
    queryset = Contribution.objects.filter(workspace=workspace)
    current = queryset.filter(**period_filter("created_at", period)).aggregate(expected=Sum("amount_due"), paid=Sum("amount_paid"))
    monthly_rows = (
        queryset.annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(expected=Sum("amount_due"), paid=Sum("amount_paid"), overdue=Sum("amount_due", filter=Q(status=ContributionStatus.OVERDUE)))
        .order_by("month")
    )
    expected = stats["expected"]
    collected = stats["collected"]
    return {
        "expected": expected,
        "collected": collected,
        "unpaid": max(expected - collected, ZERO),
        "recovery_rate": percentage(collected, expected),
        "average_amount": queryset.aggregate(avg=Avg("amount_due"))["avg"] or ZERO,
        "current_members": stats["current_members"],
        "late_members": stats["late_members"],
        "period_expected": current["expected"] or ZERO,
        "period_collected": current["paid"] or ZERO,
        "monthly": [{"period": row["month"].date().isoformat() if row["month"] else "", "expected": row["expected"] or ZERO, "paid": row["paid"] or ZERO, "unpaid": max((row["expected"] or ZERO) - (row["paid"] or ZERO), ZERO)} for row in monthly_rows],
        "top_late_members": top_late_members(workspace),
    }


def top_late_members(workspace: Workspace) -> list[dict]:
    rows = (
        Contribution.objects.filter(workspace=workspace, status=ContributionStatus.OVERDUE)
        .values("member_id", "member__first_name", "member__last_name")
        .annotate(amount=Sum("amount_due"), count=Count("id"))
        .order_by("-amount")[:10]
    )
    return [{"member_id": row["member_id"], "member": f"{row['member__first_name']} {row['member__last_name']}".strip(), "amount": row["amount"] or ZERO, "count": row["count"]} for row in rows]


def members_analytics(*, workspace: Workspace, period: AnalyticsPeriod) -> dict:
    members = Member.objects.filter(workspace=workspace)
    start_count = members.filter(join_date__lt=period.start.date()).exclude(status__in=[Member.Status.RESIGNED, Member.Status.EXCLUDED, Member.Status.FORMER]).count()
    new_members = members.filter(join_date__gte=period.start.date(), join_date__lt=period.end.date()).count()
    left_members = members.filter(status__in=[Member.Status.RESIGNED, Member.Status.EXCLUDED, Member.Status.FORMER], updated_at__gte=period.start, updated_at__lt=period.end).count()
    end_count = members.exclude(status__in=[Member.Status.RESIGNED, Member.Status.EXCLUDED, Member.Status.FORMER]).count()
    by_status = list(members.values("status").annotate(count=Count("id")).order_by("status"))
    monthly = list(members.annotate(month=TruncMonth("join_date")).values("month").annotate(count=Count("id")).order_by("month"))
    retention = percentage(max(start_count - left_members, 0), start_count)
    return {
        "total_members": members.count(),
        "active_members": members.filter(status=Member.Status.ACTIVE).count(),
        "new_members": new_members,
        "left_members": left_members,
        "suspended_members": members.filter(status=Member.Status.SUSPENDED).count(),
        "start_members": start_count,
        "end_members": end_count,
        "growth_rate": percentage(new_members - left_members, start_count),
        "retention_rate": retention,
        "by_status": by_status,
        "monthly_growth": [{"period": row["month"].date().isoformat() if row["month"] else "", "count": row["count"]} for row in monthly],
        "engagement_formula": "40% cotisation a jour + 40% participation evenements + 20% activite auditee",
    }


def projects_analytics(*, workspace: Workspace, period: AnalyticsPeriod) -> dict:
    stats = workspace_project_stats(workspace)
    projects = Project.objects.filter(workspace=workspace)
    progress_rows = list(projects.values("id", "name", "progress", "budget", "status", "end_date").order_by("-updated_at")[:20])
    risks = []
    today = timezone.localdate()
    for project in projects:
        rules = []
        if project.end_date and project.end_date < today and project.progress < 100:
            rules.append("Retard")
        if project.end_date and 0 <= (project.end_date - today).days <= 14 and project.progress < 90:
            rules.append("Date limite proche")
        if project.progress < 25 and project.status == ProjectStatus.ACTIVE:
            rules.append("Progression faible")
        if rules:
            risks.append({"id": project.id, "name": project.name, "rules": rules, "progress": project.progress})
    return {**stats, "progress_by_project": progress_rows, "risk_items": risks[:12], "period_started": projects.filter(created_at__gte=period.start, created_at__lt=period.end).count()}


def events_analytics(*, workspace: Workspace, period: AnalyticsPeriod) -> dict:
    stats = workspace_event_stats(workspace)
    participants = EventParticipant.objects.filter(workspace=workspace)
    top_by_participants = list(Event.objects.filter(workspace=workspace).annotate(participant_count=Count("participants")).values("id", "title", "participant_count").order_by("-participant_count")[:10])
    return {
        **stats,
        "event_count": Event.objects.filter(workspace=workspace, start_at__gte=period.start, start_at__lt=period.end).count(),
        "participants": participants.count(),
        "attended": participants.filter(attendance_status=EventParticipantStatus.ATTENDED).count(),
        "attendance_rate": stats["average_attendance_rate"],
        "top_by_participants": top_by_participants,
        "top_by_attendance": top_by_participants,
        "top_by_revenue": [],
        "top_by_result": [],
    }


def documents_report(*, workspace: Workspace) -> dict:
    return document_analytics(workspace=workspace, include_sensitive=False)


def performance_scores(*, workspace: Workspace, period: AnalyticsPeriod) -> dict:
    finance = finance_analytics(workspace=workspace, period=period)
    contributions = contributions_analytics(workspace=workspace, period=period)
    projects = projects_analytics(workspace=workspace, period=period)
    events = events_analytics(workspace=workspace, period=period)
    budget_rate = Decimal(str(finance["budget"].get("consumption_rate", 0)))
    finance_score = int((min(max(Decimal("100") - budget_rate, 0), 100) * Decimal("0.25")) + (contributions["recovery_rate"] * Decimal("0.35")) + ((Decimal("100") if finance["net_result"]["value"] >= 0 else Decimal("40")) * Decimal("0.40")))
    contribution_score = int((contributions["recovery_rate"] * Decimal("0.75")) + (max(Decimal("100") - Decimal(str(contributions["late_members"] * 5)), 0) * Decimal("0.25")))
    project_score = int((Decimal(str(projects["average_progress"])) * Decimal("0.50")) + (max(Decimal("100") - Decimal(str(projects["delayed_projects"] * 10)), 0) * Decimal("0.50")))
    event_score = int(Decimal(str(events["attendance_rate"])) * Decimal("0.70") + (Decimal("100") if events["net_result"] >= 0 else Decimal("50")) * Decimal("0.30"))
    overall = round((finance_score + contribution_score + project_score + event_score) / 4, 2)
    return {
        "overall": overall,
        "financial_health": {"score": finance_score, "formula": "25% respect budget + 35% recouvrement + 40% resultat"},
        "contribution_health": {"score": contribution_score, "formula": "75% recouvrement + 25% retards"},
        "project_health": {"score": project_score, "formula": "50% progression + 50% respect delais"},
        "event_health": {"score": event_score, "formula": "70% presence + 30% resultat financier"},
    }


def analytics_alerts(*, workspace: Workspace, period: AnalyticsPeriod) -> list[dict]:
    alerts = []
    contributions = contributions_analytics(workspace=workspace, period=period)
    finance = finance_analytics(workspace=workspace, period=period)
    projects = projects_analytics(workspace=workspace, period=period)
    events = events_analytics(workspace=workspace, period=period)
    if contributions["recovery_rate"] < 60:
        alerts.append({"type": "contribution", "severity": "warning", "message": "Taux de recouvrement inferieur a 60 %.", "value": contributions["recovery_rate"]})
    if finance["expense"]["variation"] and finance["expense"]["variation"] > 20:
        alerts.append({"type": "financial", "severity": "warning", "message": "Depenses 20 % superieures a la periode precedente.", "value": finance["expense"]["variation"]})
    if projects["delayed_projects"]:
        alerts.append({"type": "project", "severity": "critical", "message": "Projets en retard detectes.", "value": projects["delayed_projects"]})
    if events["attendance_rate"] and events["attendance_rate"] < 50:
        alerts.append({"type": "event", "severity": "warning", "message": "Participation evenementielle faible.", "value": events["attendance_rate"]})
    return alerts


def overview_analytics(*, workspace: Workspace, period: AnalyticsPeriod) -> dict:
    finance = finance_analytics(workspace=workspace, period=period)
    members = members_analytics(workspace=workspace, period=period)
    contributions = contributions_analytics(workspace=workspace, period=period)
    projects = projects_analytics(workspace=workspace, period=period)
    events = events_analytics(workspace=workspace, period=period)
    documents = documents_report(workspace=workspace)
    return {
        "period": period_payload(period),
        "financial": finance,
        "members": members,
        "contributions": contributions,
        "projects": projects,
        "events": events,
        "documents": documents,
        "performance": performance_scores(workspace=workspace, period=period),
        "alerts": analytics_alerts(workspace=workspace, period=period),
        "empty_state": all([members["total_members"] == 0, contributions["expected"] == 0, finance["income"]["value"] == 0, projects["total_projects"] == 0, events["event_count"] == 0]),
        "last_updated_at": timezone.now().isoformat(),
    }


def annual_report(*, workspace: Workspace, year: int | None = None) -> dict:
    today = timezone.localdate()
    year = year or today.year
    period = AnalyticsPeriod("annual", str(year), timezone.make_aware(timezone.datetime(year, 1, 1)), timezone.make_aware(timezone.datetime(year + 1, 1, 1)))
    activity = AuditLog.objects.filter(workspace=workspace, created_at__gte=period.start, created_at__lt=period.end).values("action").annotate(count=Count("id")).order_by("-count")[:20]
    return {**overview_analytics(workspace=workspace, period=period), "year": year, "activity": list(activity)}


def period_payload(period: AnalyticsPeriod) -> dict:
    return {"code": period.code, "label": period.label, "date_from": period.start.date().isoformat(), "date_to": period.end.date().isoformat()}
