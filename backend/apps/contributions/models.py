from decimal import Decimal

from django.db import models

from apps.members.models import Member, MemberCategory
from apps.workspaces.models import Workspace


class ContributionCampaign(models.Model):
    class Frequency(models.TextChoices):
        ONCE = "once", "Unique"
        MONTHLY = "monthly", "Mensuelle"
        QUARTERLY = "quarterly", "Trimestrielle"
        SEMIANNUAL = "semiannual", "Semestrielle"
        ANNUAL = "annual", "Annuelle"
        CUSTOM = "custom", "Personnalisee"

    class Status(models.TextChoices):
        DRAFT = "draft", "Brouillon"
        ACTIVE = "active", "Active"
        PAUSED = "paused", "En pause"
        CLOSED = "closed", "Cloturee"
        CANCELLED = "cancelled", "Annulee"

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="contribution_campaigns")
    name = models.CharField(max_length=180)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, default="XOF")
    frequency = models.CharField(max_length=20, choices=Frequency.choices, default=Frequency.MONTHLY)
    period_label = models.CharField(max_length=120, blank=True)
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    target_category = models.ForeignKey(MemberCategory, on_delete=models.SET_NULL, null=True, blank=True)
    is_required = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
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
    class Status(models.TextChoices):
        DUE = "due", "Due"
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        PARTIALLY_PAID = "partially_paid", "Partially paid"
        OVERDUE = "overdue", "Overdue"
        CANCELLED = "cancelled", "Cancelled"

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="contributions")
    campaign = models.ForeignKey(ContributionCampaign, on_delete=models.CASCADE, related_name="contributions")
    member = models.ForeignKey(Member, on_delete=models.PROTECT, related_name="contributions")
    amount_due = models.DecimalField(max_digits=14, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=3, default="XOF")
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.DUE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["campaign", "member"], name="uniq_contribution_campaign_member")]
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "due_date"]),
            models.Index(fields=["workspace", "member"]),
        ]

    @property
    def remaining_amount(self) -> Decimal:
        return max(self.amount_due - self.amount_paid, Decimal("0.00"))


class ReminderRule(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="contribution_reminder_rules")
    name = models.CharField(max_length=120)
    days_from_due_date = models.IntegerField()
    is_active = models.BooleanField(default=True)
    channel = models.CharField(max_length=24, default="notification")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
