from decimal import Decimal
from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.members.models import Member
from apps.workspaces.models import Workspace
from .models import Contribution, ContributionCampaign
from .statuses import CampaignStatus, CampaignTargetMode, ContributionStatus


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
    payment_method: str = "manual",
    document_reference: str = "",
):
    from apps.payments.services import record_manual_payment

    payment = record_manual_payment(
        workspace=contribution.workspace,
        actor=actor,
        member=contribution.member,
        contribution=contribution,
        amount=amount,
        paid_at=paid_at,
        idempotency_key=idempotency_key,
        payment_method=payment_method,
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
        "remaining": max(expected - collected, Decimal("0.00")),
        "recovery_rate": recovery_rate,
        "late_members": queryset.filter(status=ContributionStatus.OVERDUE).values("member_id").distinct().count(),
        "current_members": queryset.filter(status__in=[ContributionStatus.PAID, ContributionStatus.WAIVED]).values("member_id").distinct().count(),
    }


def contribution_dashboard(*, workspace: Workspace, period: str | None = None) -> dict:
    queryset = Contribution.objects.filter(workspace=workspace)
    totals = contribution_stats(workspace)
    status_counts = queryset.aggregate(
        members_paid=Count("id", filter=Q(status=ContributionStatus.PAID)),
        members_partial=Count("id", filter=Q(status=ContributionStatus.PARTIALLY_PAID)),
        members_overdue=Count("id", filter=Q(status=ContributionStatus.OVERDUE)),
        members_unpaid=Count("id", filter=Q(status=ContributionStatus.PENDING)),
        waived=Count("id", filter=Q(status=ContributionStatus.WAIVED)),
    )
    active_campaigns = ContributionCampaign.objects.filter(workspace=workspace, status=CampaignStatus.ACTIVE).count()
    upcoming_due = queryset.filter(due_date__gte=timezone.localdate(), due_date__lte=timezone.localdate() + timedelta(days=7)).count()
    return {
        "total_expected": totals["expected"],
        "total_collected": totals["collected"],
        "total_remaining": totals["remaining"],
        "collection_rate": totals["recovery_rate"],
        "members_paid": status_counts["members_paid"] or 0,
        "members_partial": status_counts["members_partial"] or 0,
        "members_overdue": status_counts["members_overdue"] or 0,
        "members_unpaid": status_counts["members_unpaid"] or 0,
        "waived": status_counts["waived"] or 0,
        "active_campaigns": active_campaigns,
        "upcoming_due": upcoming_due,
        "period": period or "all",
        "series": [],
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
