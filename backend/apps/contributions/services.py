from decimal import Decimal
from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDay, TruncMonth
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.members.models import Member
from apps.workspaces.models import Workspace
from .models import Contribution, ContributionCampaign, ContributionExportRequest, ContributionRecoverySettings, ContributionReminder
from .statuses import (
    CampaignStatus,
    CampaignTargetMode,
    ContributionExportFormat,
    ContributionReminderChannel,
    ContributionReminderKind,
    ContributionReminderStatus,
    ContributionStatus,
)


@transaction.atomic
def create_campaign(*, workspace: Workspace, actor, **data) -> ContributionCampaign:
    data.setdefault("currency", workspace.currency)
    target_members = data.pop("target_members", None)
    campaign = ContributionCampaign.objects.create(workspace=workspace, **data)
    if target_members is not None:
        campaign.target_members.set(target_members)
    AuditLog.objects.create(workspace=workspace, actor=actor, action="contribution_campaign.created", resource="contribution_campaign", resource_id=str(campaign.id))
    return campaign


@transaction.atomic
def update_campaign(*, campaign: ContributionCampaign, actor, **data) -> ContributionCampaign:
    previous_status = campaign.status
    for field, value in data.items():
        if field == "target_members":
            continue
        setattr(campaign, field, value)
    campaign.save()
    if "target_members" in data:
        campaign.target_members.set(data["target_members"])
    AuditLog.objects.create(
        workspace=campaign.workspace,
        actor=actor,
        action="contribution_campaign.updated",
        resource="contribution_campaign",
        resource_id=str(campaign.id),
        metadata={"previous_status": previous_status, "status": campaign.status},
    )
    return campaign


@transaction.atomic
def generate_contributions_for_campaign(*, campaign: ContributionCampaign, actor) -> int:
    members = Member.objects.filter(workspace=campaign.workspace, status=Member.Status.ACTIVE)
    if campaign.target_mode == CampaignTargetMode.SELECTED:
        members = members.filter(id__in=campaign.target_members.values("id"))
    elif campaign.target_category_id:
        members = members.filter(category=campaign.target_category)

    created = 0
    for member in members.iterator():
        category_amount = campaign.category_amounts.filter(category=member.category).first()
        amount = category_amount.amount if category_amount else campaign.amount
        _, was_created = Contribution.objects.get_or_create(
            workspace=campaign.workspace,
            campaign=campaign,
            member=member,
            defaults={"amount_due": amount, "currency": campaign.currency, "due_date": campaign.due_date, "status": ContributionStatus.PENDING},
        )
        created += int(was_created)

    AuditLog.objects.create(
        workspace=campaign.workspace,
        actor=actor,
        action="contributions.generated",
        resource="contribution_campaign",
        resource_id=str(campaign.id),
        metadata={"created": created},
    )
    return created


@transaction.atomic
def activate_campaign(*, campaign: ContributionCampaign, actor) -> int:
    previous_status = campaign.status
    campaign.status = CampaignStatus.ACTIVE
    campaign.save(update_fields=["status", "updated_at"])
    created = generate_contributions_for_campaign(campaign=campaign, actor=actor)
    AuditLog.objects.create(
        workspace=campaign.workspace,
        actor=actor,
        action="contribution_campaign.activated",
        resource="contribution_campaign",
        resource_id=str(campaign.id),
        metadata={"previous_status": previous_status, "created": created},
    )
    return created


@transaction.atomic
def cancel_campaign(*, campaign: ContributionCampaign, actor) -> int:
    previous_status = campaign.status
    campaign.status = CampaignStatus.CANCELLED
    campaign.save(update_fields=["status", "updated_at"])
    updated = Contribution.objects.filter(campaign=campaign).exclude(status__in=[ContributionStatus.PAID, ContributionStatus.WAIVED]).update(status=ContributionStatus.CANCELLED)
    AuditLog.objects.create(
        workspace=campaign.workspace,
        actor=actor,
        action="contribution_campaign.cancelled",
        resource="contribution_campaign",
        resource_id=str(campaign.id),
        metadata={"previous_status": previous_status, "cancelled_contributions": updated},
    )
    return updated


def refresh_contribution_status(contribution: Contribution) -> Contribution:
    today = timezone.localdate()
    previous_status = contribution.status
    if contribution.waived_amount >= contribution.amount_due:
        contribution.status = ContributionStatus.WAIVED
    elif contribution.remaining_amount == Decimal("0.00"):
        contribution.status = ContributionStatus.PAID
        contribution.paid_at = contribution.paid_at or timezone.now()
    elif contribution.amount_paid > Decimal("0.00"):
        contribution.status = ContributionStatus.PARTIALLY_PAID
    elif contribution.due_date and contribution.due_date < today:
        contribution.status = ContributionStatus.OVERDUE
    else:
        contribution.status = ContributionStatus.PENDING
    contribution.save(update_fields=["amount_paid", "status", "paid_at", "updated_at"])
    if previous_status != contribution.status:
        AuditLog.objects.create(
            workspace=contribution.workspace,
            actor=None,
            action="contribution.status_changed",
            resource="contribution",
            resource_id=str(contribution.id),
            metadata={"previous_status": previous_status, "status": contribution.status},
        )
    return contribution


@transaction.atomic
def update_contribution(*, contribution: Contribution, actor, **data) -> Contribution:
    previous_status = contribution.status
    for field, value in data.items():
        setattr(contribution, field, value)
    contribution.save()
    refresh_contribution_status(contribution)
    AuditLog.objects.create(
        workspace=contribution.workspace,
        actor=actor,
        action="contribution.updated",
        resource="contribution",
        resource_id=str(contribution.id),
        metadata={"previous_status": previous_status, "status": contribution.status},
    )
    return contribution


@transaction.atomic
def cancel_contribution(*, contribution: Contribution, actor) -> Contribution:
    previous_status = contribution.status
    contribution.status = ContributionStatus.CANCELLED
    contribution.save(update_fields=["status", "updated_at"])
    AuditLog.objects.create(
        workspace=contribution.workspace,
        actor=actor,
        action="contribution.cancelled",
        resource="contribution",
        resource_id=str(contribution.id),
        metadata={"previous_status": previous_status},
    )
    return contribution


@transaction.atomic
def waive_contribution(*, contribution: Contribution, actor, amount: Decimal | None = None, reason: str = "") -> Contribution:
    previous_status = contribution.status
    contribution.waived_amount = amount if amount is not None else contribution.remaining_amount
    contribution.waived_at = timezone.now()
    contribution.waiver_reason = reason
    refresh_contribution_status(contribution)
    contribution.save(update_fields=["waived_amount", "waived_at", "waiver_reason", "status", "updated_at"])
    AuditLog.objects.create(
        workspace=contribution.workspace,
        actor=actor,
        action="contribution.waived",
        resource="contribution",
        resource_id=str(contribution.id),
        metadata={"previous_status": previous_status, "status": contribution.status, "amount": str(contribution.waived_amount)},
    )
    return contribution


def record_manual_contribution_payment(
    *,
    contribution: Contribution,
    actor,
    amount: Decimal,
    idempotency_key: str,
    paid_at=None,
    payment_method: str = "MANUAL",
    document_reference: str = "",
):
    from apps.payments.services import record_manual_payment
    from apps.payments.statuses import PaymentMethod

    method_map = {
        "manual": PaymentMethod.MANUAL,
        "cash": PaymentMethod.CASH,
        "external_mobile_money": PaymentMethod.EXTERNAL_MOBILE_MONEY,
        "bank_transfer": PaymentMethod.BANK_TRANSFER,
        "check": PaymentMethod.CHECK,
        "other": PaymentMethod.OTHER,
    }

    payment = record_manual_payment(
        workspace=contribution.workspace,
        actor=actor,
        member=contribution.member,
        contribution=contribution,
        amount=amount,
        paid_at=paid_at,
        idempotency_key=idempotency_key,
        payment_method=method_map.get(payment_method, payment_method),
        metadata={"document_reference": document_reference},
    )
    AuditLog.objects.create(
        workspace=contribution.workspace,
        actor=actor,
        action="contribution.manual_payment_added",
        resource="contribution",
        resource_id=str(contribution.id),
        metadata={"amount": str(amount), "payment_id": payment.id},
    )
    return payment


def contribution_stats(workspace: Workspace) -> dict:
    queryset = Contribution.objects.filter(workspace=workspace)
    totals = queryset.aggregate(expected=Sum("amount_due"), collected=Sum("amount_paid"))
    expected = totals["expected"] or Decimal("0.00")
    collected = totals["collected"] or Decimal("0.00")
    recovery_rate = round((collected / expected) * 100, 1) if expected else 0
    return {
        "expected": expected,
        "collected": collected,
        "remaining": max(expected - collected - (queryset.aggregate(waived=Sum("waived_amount"))["waived"] or Decimal("0.00")), Decimal("0.00")),
        "recovery_rate": recovery_rate,
        "late_members": queryset.filter(status=ContributionStatus.OVERDUE).values("member_id").distinct().count(),
        "current_members": queryset.filter(status__in=[ContributionStatus.PAID, ContributionStatus.WAIVED]).values("member_id").distinct().count(),
    }


def recovery_settings(workspace: Workspace) -> ContributionRecoverySettings:
    settings, _created = ContributionRecoverySettings.objects.get_or_create(workspace=workspace)
    return settings


def period_bounds(period: str | None) -> tuple:
    today = timezone.localdate()
    now = timezone.now()
    if period == "today":
        start = today
    elif period == "week":
        start = today - timedelta(days=today.weekday())
    elif period == "month":
        start = today.replace(day=1)
    elif period == "quarter":
        start = today.replace(month=((today.month - 1) // 3) * 3 + 1, day=1)
    elif period == "semester":
        start = today.replace(month=1 if today.month <= 6 else 7, day=1)
    elif period == "year":
        start = today.replace(month=1, day=1)
    else:
        return None, None, None, None
    days = max((today - start).days + 1, 1)
    previous_end = start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=days - 1)
    return start, now.date(), previous_start, previous_end


def contribution_queryset_for_period(workspace: Workspace, period: str | None, campaign_id: int | None = None):
    queryset = Contribution.objects.filter(workspace=workspace)
    if campaign_id:
        queryset = queryset.filter(campaign_id=campaign_id)
    start, end, _previous_start, _previous_end = period_bounds(period)
    if start and end:
        queryset = queryset.filter(created_at__date__gte=start, created_at__date__lte=end)
    return queryset


def totals_for_queryset(queryset) -> dict:
    totals = queryset.aggregate(expected=Sum("amount_due"), collected=Sum("amount_paid"), waived=Sum("waived_amount"))
    expected = totals["expected"] or Decimal("0.00")
    collected = totals["collected"] or Decimal("0.00")
    waived = totals["waived"] or Decimal("0.00")
    remaining = max(expected - collected - waived, Decimal("0.00"))
    return {
        "expected": expected,
        "collected": collected,
        "waived": waived,
        "remaining": remaining,
        "collection_rate": round((collected / expected) * 100, 2) if expected else 0,
    }


def variation(current, previous) -> dict:
    if previous in (0, Decimal("0.00")):
        return {"value": None, "direction": "flat"} if current else {"value": 0, "direction": "flat"}
    value = round(((current - previous) / previous) * 100, 2)
    return {"value": value, "direction": "up" if value > 0 else "down" if value < 0 else "flat"}


def overdue_days(contribution: Contribution) -> int:
    if not contribution.due_date or contribution.remaining_amount == Decimal("0.00"):
        return 0
    return max((timezone.localdate() - contribution.due_date).days, 0)


def overdue_queryset(workspace: Workspace):
    return Contribution.objects.select_related("member", "campaign").filter(
        workspace=workspace,
        due_date__lt=timezone.localdate(),
    ).exclude(status__in=[ContributionStatus.PAID, ContributionStatus.WAIVED, ContributionStatus.CANCELLED])


def overdue_segments(workspace: Workspace) -> list[dict]:
    segments = [
        ("1-7 jours", 1, 7),
        ("8-30 jours", 8, 30),
        ("31-60 jours", 31, 60),
        ("61-90 jours", 61, 90),
        ("90+ jours", 91, None),
    ]
    rows = []
    for label, start, end in segments:
        qs = overdue_queryset(workspace).filter(due_date__lte=timezone.localdate() - timedelta(days=start))
        if end:
            qs = qs.filter(due_date__gte=timezone.localdate() - timedelta(days=end))
        rows.append({"label": label, "count": qs.count(), "amount": sum((item.remaining_amount for item in qs), Decimal("0.00"))})
    return rows


def top_unpaid_members(workspace: Workspace, limit: int = 10) -> list[dict]:
    totals: dict[int, dict] = {}
    for contribution in overdue_queryset(workspace):
        member_id = contribution.member_id
        if member_id not in totals:
            totals[member_id] = {"member_id": member_id, "member_name": str(contribution.member), "phone": contribution.member.phone, "amount_remaining": Decimal("0.00")}
        totals[member_id]["amount_remaining"] += contribution.remaining_amount
    return sorted(totals.values(), key=lambda item: item["amount_remaining"], reverse=True)[:limit]


def upcoming_due(workspace: Workspace, days: int = 7, campaign_id: int | None = None) -> dict:
    today = timezone.localdate()
    queryset = Contribution.objects.filter(workspace=workspace, due_date__gte=today, due_date__lte=today + timedelta(days=days))
    if campaign_id:
        queryset = queryset.filter(campaign_id=campaign_id)
    totals = totals_for_queryset(queryset)
    return {"days": days, "members": queryset.values("member_id").distinct().count(), "amount_expected": totals["expected"], "items": queryset.count()}


def member_recovery_summary(workspace: Workspace) -> list[dict]:
    rows = []
    member_ids = Contribution.objects.filter(workspace=workspace).values_list("member_id", flat=True).distinct()
    members = Member.objects.filter(workspace=workspace, id__in=member_ids)
    for member in members:
        qs = Contribution.objects.filter(workspace=workspace, member=member)
        totals = totals_for_queryset(qs)
        has_overdue = qs.filter(status=ContributionStatus.OVERDUE).exists()
        status = "EN_RETARD" if has_overdue else "A_JOUR" if totals["remaining"] == Decimal("0.00") else "PARTIEL" if totals["collected"] else "NON_PAYE"
        next_due = qs.filter(due_date__gte=timezone.localdate()).order_by("due_date").values_list("due_date", flat=True).first()
        rows.append({**totals, "member_id": member.id, "member_name": str(member), "phone": member.phone, "status": status, "next_due": next_due})
    return rows


def campaign_performance(workspace: Workspace) -> list[dict]:
    rows = []
    for campaign in ContributionCampaign.objects.filter(workspace=workspace).order_by("-created_at"):
        stats = campaign_contribution_stats(campaign)
        rows.append({"campaign_id": campaign.id, "campaign_name": campaign.name, **stats})
    return rows


def type_performance(workspace: Workspace) -> list[dict]:
    rows = []
    for contribution_type, label in ContributionCampaign._meta.get_field("contribution_type").choices:
        qs = Contribution.objects.filter(workspace=workspace, campaign__contribution_type=contribution_type)
        totals = totals_for_queryset(qs)
        rows.append({"type": contribution_type, "label": label, **totals})
    return rows


def collection_series(workspace: Workspace, range_code: str | None = "30d", campaign_id: int | None = None) -> list[dict]:
    days_by_range = {"7d": 7, "30d": 30, "3m": 90, "6m": 180, "12m": 365}
    days = days_by_range.get(range_code or "30d", 30)
    start = timezone.now() - timedelta(days=days)
    trunc = TruncMonth("created_at") if days > 90 else TruncDay("created_at")
    queryset = Contribution.objects.filter(workspace=workspace, created_at__gte=start)
    if campaign_id:
        queryset = queryset.filter(campaign_id=campaign_id)
    rows = (
        queryset
        .annotate(bucket=trunc)
        .values("bucket")
        .annotate(expected=Sum("amount_due"), collected=Sum("amount_paid"))
        .order_by("bucket")
    )
    return [{"period": row["bucket"].date().isoformat(), "expected": row["expected"] or Decimal("0.00"), "collected": row["collected"] or Decimal("0.00")} for row in rows]


def payment_method_distribution(workspace: Workspace, *, period: str | None = "month", campaign_id: int | None = None) -> list[dict]:
    from apps.payments.models import Payment
    from apps.payments.statuses import PaymentStatus

    queryset = Payment.objects.filter(workspace=workspace, contribution__isnull=False, status=PaymentStatus.SUCCESS)
    if campaign_id:
        queryset = queryset.filter(contribution__campaign_id=campaign_id)
    start, end, _previous_start, _previous_end = period_bounds(period)
    if start and end:
        queryset = queryset.filter(paid_at__date__gte=start, paid_at__date__lte=end)
    return [
        {"method": row["payment_method"], "label": row["payment_method"].replace("_", " ").title(), "amount": row["amount"] or Decimal("0.00"), "count": row["count"]}
        for row in queryset.values("payment_method").annotate(amount=Sum("amount"), count=Count("id")).order_by("-amount")
    ]


def contribution_analytics(*, workspace: Workspace, period: str | None = "month", range_code: str | None = "30d", campaign_id: int | None = None) -> dict:
    current_qs = contribution_queryset_for_period(workspace, period, campaign_id=campaign_id)
    start, _end, previous_start, previous_end = period_bounds(period)
    previous_qs = Contribution.objects.filter(workspace=workspace)
    if campaign_id:
        previous_qs = previous_qs.filter(campaign_id=campaign_id)
    if previous_start and previous_end:
        previous_qs = previous_qs.filter(created_at__date__gte=previous_start, created_at__date__lte=previous_end)
    current = totals_for_queryset(current_qs)
    previous = totals_for_queryset(previous_qs)
    overdue = overdue_queryset(workspace)
    if campaign_id:
        overdue = overdue.filter(campaign_id=campaign_id)
    overdue_totals = totals_for_queryset(overdue)
    settings = recovery_settings(workspace)
    return {
        "expected_amount": current["expected"],
        "collected_amount": current["collected"],
        "remaining_amount": current["remaining"],
        "collection_rate": current["collection_rate"],
        "collection_goal": settings.collection_goal_percent,
        "overdue_amount": overdue_totals["remaining"],
        "overdue_members": overdue.values("member_id").distinct().count(),
        "paid_members": current_qs.filter(status=ContributionStatus.PAID).values("member_id").distinct().count(),
        "partial_members": current_qs.filter(status=ContributionStatus.PARTIALLY_PAID).values("member_id").distinct().count(),
        "unpaid_members": current_qs.filter(status=ContributionStatus.PENDING).values("member_id").distinct().count(),
        "trend": {
            "expected": variation(current["expected"], previous["expected"]),
            "collected": variation(current["collected"], previous["collected"]),
            "collection_rate": variation(Decimal(str(current["collection_rate"])), Decimal(str(previous["collection_rate"]))),
        },
        "series": collection_series(workspace, range_code, campaign_id=campaign_id),
        "payment_methods": payment_method_distribution(workspace, period=period, campaign_id=campaign_id),
        "overdue_segments": overdue_segments(workspace),
        "top_unpaid": top_unpaid_members(workspace),
        "upcoming": {
            "week": upcoming_due(workspace, 7),
            "month": upcoming_due(workspace, 30),
            "next_month": upcoming_due(workspace, 60),
        },
        "campaign_performance": campaign_performance(workspace),
        "type_performance": type_performance(workspace),
    }


def render_reminder_template(*, contribution: Contribution) -> dict:
    member_name = str(contribution.member)
    association_name = contribution.workspace.name
    contribution_name = contribution.campaign.name
    return {
        "subject": f"Rappel de cotisation - {contribution_name}",
        "message": (
            f"Bonjour {member_name}, votre cotisation {contribution_name} pour {association_name} presente un reste "
            f"a payer de {contribution.remaining_amount} {contribution.currency}. Echeance: {contribution.due_date or 'non definie'}. "
            "Le lien de paiement NOVEX sera disponible apres activation du paiement en ligne."
        ),
        "variables": {
            "member_name": member_name,
            "association_name": association_name,
            "contribution_name": contribution_name,
            "amount_due": str(contribution.amount_due),
            "amount_remaining": str(contribution.remaining_amount),
            "due_date": str(contribution.due_date or ""),
            "payment_link": "",
        },
    }


@transaction.atomic
def create_manual_reminder(*, contribution: Contribution, actor, channel: str = ContributionReminderChannel.IN_APP, reminder_kind: str = ContributionReminderKind.REMINDER, send_now: bool = False) -> ContributionReminder:
    rendered = render_reminder_template(contribution=contribution)
    status = ContributionReminderStatus.SENT if send_now and channel == ContributionReminderChannel.IN_APP else ContributionReminderStatus.QUEUED
    reminder = ContributionReminder.objects.create(
        workspace=contribution.workspace,
        contribution=contribution,
        campaign=contribution.campaign,
        member=contribution.member,
        reminder_kind=reminder_kind,
        channel=channel,
        status=status,
        subject=rendered["subject"],
        message=rendered["message"],
        sent_at=timezone.now() if status == ContributionReminderStatus.SENT else None,
        result={"delivery": "in_app_recorded" if status == ContributionReminderStatus.SENT else "queued_for_provider"},
        created_by=actor,
    )
    AuditLog.objects.create(
        workspace=contribution.workspace,
        actor=actor,
        action="reminder.sent" if status == ContributionReminderStatus.SENT else "reminder.created",
        resource="contribution_reminder",
        resource_id=str(reminder.id),
        metadata={"channel": channel, "contribution_id": contribution.id},
    )
    return reminder


def bulk_reminder_preview(workspace: Workspace, *, days_overdue: int | None = None, campaign_id: int | None = None) -> dict:
    queryset = overdue_queryset(workspace)
    if days_overdue:
        queryset = queryset.filter(due_date__lte=timezone.localdate() - timedelta(days=days_overdue))
    if campaign_id:
        queryset = queryset.filter(campaign_id=campaign_id)
    return {"recipients": queryset.values("member_id").distinct().count(), "contributions": queryset.count(), "amount_remaining": totals_for_queryset(queryset)["remaining"]}


@transaction.atomic
def create_export_request(*, workspace: Workspace, actor, export_type: str, export_format: str = ContributionExportFormat.CSV, filters: dict | None = None) -> ContributionExportRequest:
    request = ContributionExportRequest.objects.create(workspace=workspace, requested_by=actor, export_type=export_type, export_format=export_format, filters=filters or {})
    AuditLog.objects.create(workspace=workspace, actor=actor, action="contribution.export_requested", resource="contribution_export", resource_id=str(request.id), metadata={"export_type": export_type, "format": export_format})
    return request


def cache_key_for_contribution_analytics(workspace: Workspace, period: str | None, range_code: str | None) -> str:
    return f"workspace:{workspace.id}:contributions:analytics:{period or 'all'}:{range_code or '30d'}"


def contribution_dashboard(*, workspace: Workspace, period: str | None = None, campaign_id: int | None = None) -> dict:
    queryset = contribution_queryset_for_period(workspace, period, campaign_id=campaign_id)
    totals = totals_for_queryset(queryset)
    overdue = queryset.filter(due_date__lt=timezone.localdate()).exclude(status__in=[ContributionStatus.PAID, ContributionStatus.WAIVED, ContributionStatus.CANCELLED])
    overdue_totals = totals_for_queryset(overdue)
    status_counts = queryset.aggregate(
        members_paid=Count("member_id", filter=Q(status=ContributionStatus.PAID), distinct=True),
        members_partial=Count("member_id", filter=Q(status=ContributionStatus.PARTIALLY_PAID), distinct=True),
        members_overdue=Count("member_id", filter=Q(status=ContributionStatus.OVERDUE), distinct=True),
        members_unpaid=Count("member_id", filter=Q(status=ContributionStatus.PENDING), distinct=True),
        waived=Count("id", filter=Q(status=ContributionStatus.WAIVED)),
    )
    active_campaigns = ContributionCampaign.objects.filter(workspace=workspace, status=CampaignStatus.ACTIVE).count()
    upcoming_due = queryset.filter(due_date__gte=timezone.localdate(), due_date__lte=timezone.localdate() + timedelta(days=7)).count()
    status_breakdown = {
        ContributionStatus.PAID: status_counts["members_paid"] or 0,
        ContributionStatus.PARTIALLY_PAID: status_counts["members_partial"] or 0,
        ContributionStatus.PENDING: status_counts["members_unpaid"] or 0,
        ContributionStatus.OVERDUE: status_counts["members_overdue"] or 0,
        ContributionStatus.WAIVED: status_counts["waived"] or 0,
    }
    return {
        "total_expected": totals["expected"],
        "total_collected": totals["collected"],
        "total_remaining": totals["remaining"],
        "collection_rate": totals["collection_rate"],
        "total_overdue": overdue_totals["remaining"],
        "members_concerned": queryset.values("member_id").distinct().count(),
        "members_paid": status_counts["members_paid"] or 0,
        "members_partial": status_counts["members_partial"] or 0,
        "members_overdue": status_counts["members_overdue"] or 0,
        "members_unpaid": status_counts["members_unpaid"] or 0,
        "waived": status_counts["waived"] or 0,
        "active_campaigns": active_campaigns,
        "upcoming_due": upcoming_due,
        "period": period or "all",
        "statuses": status_breakdown,
        "series": collection_series(workspace, "12m", campaign_id=campaign_id),
        "payment_methods": payment_method_distribution(workspace, period=period, campaign_id=campaign_id),
        "categories": type_performance(workspace),
    }


def campaign_contribution_stats(campaign: ContributionCampaign) -> dict:
    queryset = Contribution.objects.filter(workspace=campaign.workspace, campaign=campaign)
    totals = queryset.aggregate(expected=Sum("amount_due"), collected=Sum("amount_paid"), waived=Sum("waived_amount"))
    expected = totals["expected"] or Decimal("0.00")
    collected = totals["collected"] or Decimal("0.00")
    waived = totals["waived"] or Decimal("0.00")
    remaining = max(expected - collected - waived, Decimal("0.00"))
    return {
        "campaign_id": campaign.id,
        "total_expected": expected,
        "total_collected": collected,
        "total_waived": waived,
        "total_remaining": remaining,
        "collection_rate": round((collected / expected) * 100, 1) if expected else 0,
        "members_paid": queryset.filter(status=ContributionStatus.PAID).count(),
        "members_partial": queryset.filter(status=ContributionStatus.PARTIALLY_PAID).count(),
        "members_overdue": queryset.filter(status=ContributionStatus.OVERDUE).count(),
        "members_unpaid": queryset.filter(status=ContributionStatus.PENDING).count(),
    }
