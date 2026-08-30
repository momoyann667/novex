from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.events.models import Event
from apps.finance.models import FinancialCategory, FinancialTransaction
from apps.projects.models import Project
from apps.workspaces.models import Workspace
from .statuses import BudgetAlertSeverity, BudgetAlertType, BudgetPeriodType, BudgetScopeType, BudgetStatus


def default_budget_thresholds() -> dict:
    return {"watch": 50, "attention": 75, "critical": 90, "exceeded": 100}


class BudgetSettings(models.Model):
    workspace = models.OneToOneField(Workspace, on_delete=models.CASCADE, related_name="budget_settings")
    allow_over_budget_expense = models.BooleanField(default=True)
    thresholds = models.JSONField(default=default_budget_thresholds, blank=True)
    notify_in_app = models.BooleanField(default=True)
    notify_email = models.BooleanField(default=True)
    notify_whatsapp = models.BooleanField(default=False)
    notify_sms = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Budget(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="budgets")
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    period_type = models.CharField(max_length=16, choices=BudgetPeriodType.choices, default=BudgetPeriodType.ANNUAL)
    scope_type = models.CharField(max_length=16, choices=BudgetScopeType.choices, default=BudgetScopeType.WORKSPACE)
    start_date = models.DateField()
    end_date = models.DateField()
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=3, default="XOF")
    status = models.CharField(max_length=16, choices=BudgetStatus.choices, default=BudgetStatus.DRAFT)
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name="budgets")
    event = models.ForeignKey(Event, on_delete=models.SET_NULL, null=True, blank=True, related_name="budgets")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_budgets")
    closed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="closed_budgets")
    closed_at = models.DateTimeField(null=True, blank=True)
    archived_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="archived_budgets")
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "scope_type"]),
            models.Index(fields=["workspace", "start_date", "end_date"]),
            models.Index(fields=["workspace", "project"]),
            models.Index(fields=["workspace", "event"]),
            models.Index(fields=["workspace", "created_at"]),
        ]

    def __str__(self) -> str:
        return self.name


class BudgetLine(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="budget_lines")
    budget = models.ForeignKey(Budget, on_delete=models.CASCADE, related_name="lines")
    category = models.ForeignKey(FinancialCategory, on_delete=models.PROTECT, related_name="budget_lines")
    planned_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    committed_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["budget", "category"], name="uniq_budget_line_category")]
        indexes = [
            models.Index(fields=["workspace", "budget"]),
            models.Index(fields=["workspace", "category"]),
            models.Index(fields=["workspace", "is_active"]),
        ]

    def __str__(self) -> str:
        return f"{self.budget} - {self.category}"


class BudgetAssignment(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="budget_assignments")
    budget = models.ForeignKey(Budget, on_delete=models.PROTECT, related_name="assignments")
    budget_line = models.ForeignKey(BudgetLine, on_delete=models.PROTECT, related_name="assignments")
    transaction = models.OneToOneField(FinancialTransaction, on_delete=models.CASCADE, related_name="budget_assignment")
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    is_manual = models.BooleanField(default=False)
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["workspace", "budget"]),
            models.Index(fields=["workspace", "budget_line"]),
            models.Index(fields=["workspace", "transaction"]),
        ]


class BudgetAlert(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="budget_alerts")
    budget = models.ForeignKey(Budget, on_delete=models.CASCADE, related_name="alerts")
    budget_line = models.ForeignKey(BudgetLine, on_delete=models.CASCADE, null=True, blank=True, related_name="alerts")
    alert_type = models.CharField(max_length=64, choices=BudgetAlertType.choices)
    severity = models.CharField(max_length=16, choices=BudgetAlertSeverity.choices, default=BudgetAlertSeverity.INFO)
    threshold_percent = models.PositiveSmallIntegerField(default=0)
    current_percent = models.DecimalField(max_digits=7, decimal_places=2, default=Decimal("0.00"))
    message = models.CharField(max_length=255)
    channels = models.JSONField(default=list, blank=True)
    is_resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["workspace", "budget", "is_resolved"]),
            models.Index(fields=["workspace", "severity", "-created_at"]),
            models.Index(fields=["alert_type", "-created_at"]),
        ]


class BudgetActivity(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="budget_activities")
    budget = models.ForeignKey(Budget, on_delete=models.CASCADE, related_name="activities")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=120)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "budget", "-created_at"]), models.Index(fields=["action", "-created_at"])]

