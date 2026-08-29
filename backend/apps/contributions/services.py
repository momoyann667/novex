from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.members.models import Member
from apps.workspaces.models import Workspace
from .models import Contribution, ContributionCampaign


@transaction.atomic
def create_campaign(*, workspace: Workspace, actor, **data) -> ContributionCampaign:
    data.setdefault("currency", workspace.currency)
    campaign = ContributionCampaign.objects.create(workspace=workspace, **data)
    AuditLog.objects.create(workspace=workspace, actor=actor, action="contribution_campaign.created", resource="contribution_campaign", resource_id=str(campaign.id))
    return campaign


@transaction.atomic
def generate_contributions_for_campaign(*, campaign: ContributionCampaign, actor) -> int:
    members = Member.objects.filter(workspace=campaign.workspace, status=Member.Status.ACTIVE)
    if campaign.target_category_id:
        members = members.filter(category=campaign.target_category)

    created = 0
    for member in members.iterator():
        category_amount = campaign.category_amounts.filter(category=member.category).first()
        amount = category_amount.amount if category_amount else campaign.amount
        _, was_created = Contribution.objects.get_or_create(
            workspace=campaign.workspace,
            campaign=campaign,
            member=member,
            defaults={"amount_due": amount, "currency": campaign.currency, "due_date": campaign.due_date},
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


def refresh_contribution_status(contribution: Contribution) -> Contribution:
    today = timezone.localdate()
    if contribution.amount_paid >= contribution.amount_due:
        contribution.status = Contribution.Status.PAID
    elif contribution.amount_paid > Decimal("0.00"):
        contribution.status = Contribution.Status.PARTIALLY_PAID
    elif contribution.due_date and contribution.due_date < today:
        contribution.status = Contribution.Status.OVERDUE
    else:
        contribution.status = Contribution.Status.DUE
    contribution.save(update_fields=["amount_paid", "status", "updated_at"])
    return contribution


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
        "late_members": queryset.filter(status=Contribution.Status.OVERDUE).values("member_id").distinct().count(),
        "current_members": queryset.filter(status=Contribution.Status.PAID).values("member_id").distinct().count(),
    }
