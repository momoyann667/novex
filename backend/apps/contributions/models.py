from decimal import Decimal

from django.db import models

from apps.members.models import Member, MemberCategory
from apps.workspaces.models import Workspace
from .statuses import (
    CampaignStatus,
    CampaignTargetMode,
    ContributionExportFormat,
    ContributionPeriodicity,
    ContributionReminderChannel,
    ContributionReminderKind,
    ContributionReminderStatus,
    ContributionStatus,
    ContributionType,
)


class ContributionCampaign(models.Model):
    Status = CampaignStatus
    Frequency = ContributionPeriodicity

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="contribution_campaigns")
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    contribution_type = models.CharField(max_length=24, choices=ContributionType.choices, default=ContributionType.MONTHLY)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, default="XOF")
    periodicity = models.CharField(max_length=24, choices=ContributionPeriodicity.choices, default=ContributionPeriodicity.MONTHLY)
    period_label = models.CharField(max_length=120, blank=True)
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    target_mode = models.CharField(max_length=24, choices=CampaignTargetMode.choices, default=CampaignTargetMode.ALL_ACTIVE)
    target_category = models.ForeignKey(MemberCategory, on_delete=models.SET_NULL, null=True, blank=True)
    target_members = models.ManyToManyField(Member, blank=True, related_name="targeted_contribution_campaigns")
    target_segment = models.JSONField(default=dict, blank=True)
    is_required = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=CampaignStatus.choices, default=CampaignStatus.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "due_date"]),
        ]

    @property
    def expected_total(self) -> Decimal:
        return self.amount * Decimal(self.contributions.count())


class ContributionCategoryAmount(models.Model):
    campaign = models.ForeignKey(ContributionCampaign, on_delete=models.CASCADE, related_name="category_amounts")
    category = models.ForeignKey(MemberCategory, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["campaign", "category"], name="uniq_campaign_category_amount")]


class Contribution(models.Model):
    Status = ContributionStatus

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="contributions")
    campaign = models.ForeignKey(ContributionCampaign, on_delete=models.CASCADE, related_name="contributions")
    member = models.ForeignKey(Member, on_delete=models.PROTECT, related_name="contributions")
    amount_due = models.DecimalField(max_digits=14, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    waived_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=3, default="XOF")
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=24, choices=ContributionStatus.choices, default=ContributionStatus.PENDING)
    paid_at = models.DateTimeField(null=True, blank=True)
    waived_at = models.DateTimeField(null=True, blank=True)
    waiver_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["campaign", "member"], name="uniq_contribution_campaign_member")]
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "due_date"]),
            models.Index(fields=["workspace", "member"]),
            models.Index(fields=["workspace", "campaign"]),
            models.Index(fields=["workspace", "created_at"]),
        ]

    @property
    def remaining_amount(self) -> Decimal:
        return max(self.amount_due - self.amount_paid - self.waived_amount, Decimal("0.00"))


class ReminderRule(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="contribution_reminder_rules")
    name = models.CharField(max_length=120)
    days_from_due_date = models.IntegerField()
    is_active = models.BooleanField(default=True)
    channel = models.CharField(max_length=24, default="notification")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class ContributionRecoverySettings(models.Model):
    workspace = models.OneToOneField(Workspace, on_delete=models.CASCADE, related_name="contribution_recovery_settings")
    collection_goal_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("90.00"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class ContributionReminder(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="contribution_reminders")
    contribution = models.ForeignKey(Contribution, on_delete=models.CASCADE, related_name="reminders")
    campaign = models.ForeignKey(ContributionCampaign, on_delete=models.CASCADE, related_name="reminders")
    member = models.ForeignKey(Member, on_delete=models.PROTECT, related_name="contribution_reminders")
    reminder_kind = models.CharField(max_length=24, choices=ContributionReminderKind.choices, default=ContributionReminderKind.REMINDER)
    channel = models.CharField(max_length=24, choices=ContributionReminderChannel.choices, default=ContributionReminderChannel.IN_APP)
    status = models.CharField(max_length=24, choices=ContributionReminderStatus.choices, default=ContributionReminderStatus.DRAFT)
    subject = models.CharField(max_length=180)
    message = models.TextField()
    idempotency_key = models.CharField(max_length=160, blank=True)
    scheduled_for = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    result = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["workspace", "idempotency_key"], condition=~models.Q(idempotency_key=""), name="uniq_contribution_reminder_idempotency"),
        ]
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "channel"]),
            models.Index(fields=["workspace", "scheduled_for"]),
            models.Index(fields=["workspace", "contribution"]),
            models.Index(fields=["workspace", "member"]),
        ]


class ContributionExportRequest(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="contribution_export_requests")
    export_format = models.CharField(max_length=16, choices=ContributionExportFormat.choices, default=ContributionExportFormat.CSV)
    export_type = models.CharField(max_length=40, default="recovery")
    filters = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=24, default="queued")
    file = models.FileField(upload_to="contribution-exports/", blank=True)
    requested_by = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "status", "-created_at"])]
