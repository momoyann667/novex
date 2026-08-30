from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.events.models import Event
from apps.payments.models import Payment
from apps.projects.models import Project
from apps.workspaces.models import Workspace
from .statuses import (
    ExpensePaymentMethod,
    FinancialCategoryKind,
    FinancialDocumentType,
    FinancialTransactionSource,
    FinancialTransactionStatus,
    FinancialTransactionType,
    FiscalPeriodStatus,
)


class FinancialSettings(models.Model):
    workspace = models.OneToOneField(Workspace, on_delete=models.CASCADE, related_name="financial_settings")
    require_expense_receipt = models.BooleanField(default=False)
    expense_validation_threshold = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("100000.00"))
    large_expense_threshold = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("250000.00"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class FinancialCategory(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="financial_categories")
    kind = models.CharField(max_length=32, choices=FinancialCategoryKind.choices)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "kind", "name"], name="uniq_finance_category_workspace_kind_name")]
        indexes = [models.Index(fields=["workspace", "kind", "is_active"]), models.Index(fields=["workspace", "name"])]

    def __str__(self) -> str:
        return self.name


class CostCenter(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="cost_centers")
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=40, blank=True)
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name="cost_centers")
    event = models.ForeignKey(Event, on_delete=models.SET_NULL, null=True, blank=True, related_name="cost_centers")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "name"], name="uniq_cost_center_workspace_name")]
        indexes = [models.Index(fields=["workspace", "is_active"]), models.Index(fields=["workspace", "project"]), models.Index(fields=["workspace", "event"])]


class FiscalPeriod(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="fiscal_periods")
    name = models.CharField(max_length=120)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=16, choices=FiscalPeriodStatus.choices, default=FiscalPeriodStatus.OPEN)
    closing_summary = models.JSONField(default=dict, blank=True)
    closed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "status"]), models.Index(fields=["workspace", "start_date", "end_date"])]


class FinancialTransaction(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="financial_transactions")
    transaction_type = models.CharField(max_length=16, choices=FinancialTransactionType.choices)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, default="XOF")
    category = models.ForeignKey(FinancialCategory, on_delete=models.PROTECT, related_name="transactions")
    description = models.CharField(max_length=220)
    reference = models.CharField(max_length=120)
    transaction_date = models.DateField(default=timezone.localdate)
    status = models.CharField(max_length=16, choices=FinancialTransactionStatus.choices, default=FinancialTransactionStatus.VALIDATED)
    source = models.CharField(max_length=24, choices=FinancialTransactionSource.choices, default=FinancialTransactionSource.MANUAL)
    source_payment = models.OneToOneField(Payment, on_delete=models.PROTECT, null=True, blank=True, related_name="financial_transaction")
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name="financial_transactions")
    event = models.ForeignKey(Event, on_delete=models.SET_NULL, null=True, blank=True, related_name="financial_transactions")
    cost_center = models.ForeignKey(CostCenter, on_delete=models.SET_NULL, null=True, blank=True, related_name="transactions")
    supplier_name = models.CharField(max_length=160, blank=True)
    supplier_phone = models.CharField(max_length=32, blank=True)
    invoice_reference = models.CharField(max_length=120, blank=True)
    payment_method = models.CharField(max_length=24, choices=ExpensePaymentMethod.choices, blank=True)
    requires_receipt = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    cancellation_reason = models.TextField(blank=True)
    cancelled_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="cancelled_financial_transactions")
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_financial_transactions")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "reference"], name="uniq_finance_transaction_workspace_reference")]
        indexes = [
            models.Index(fields=["workspace", "transaction_date"]),
            models.Index(fields=["workspace", "transaction_type"]),
            models.Index(fields=["workspace", "category"]),
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "source"]),
            models.Index(fields=["workspace", "project"]),
            models.Index(fields=["workspace", "event"]),
            models.Index(fields=["workspace", "created_at"]),
        ]


class FinancialTransactionDocument(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="financial_documents")
    transaction = models.ForeignKey(FinancialTransaction, on_delete=models.CASCADE, related_name="documents")
    title = models.CharField(max_length=180)
    file = models.FileField(upload_to="financial-documents/")
    document_type = models.CharField(max_length=24, choices=FinancialDocumentType.choices, default=FinancialDocumentType.RECEIPT)
    mime_type = models.CharField(max_length=120, blank=True)
    size_bytes = models.PositiveBigIntegerField(default=0)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "transaction", "-created_at"])]
