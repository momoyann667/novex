from django.db import models

from apps.contributions.models import Contribution
from apps.members.models import Member
from apps.workspaces.models import Workspace
from .statuses import (
    FinancialAdjustmentDirection,
    FinancialAdjustmentStatus,
    PaymentDocumentType,
    PaymentEventType,
    PaymentMethod,
    PaymentStatus,
    ReceiptStatus,
    ReconciliationStatus,
    ScanStatus,
)


class Payment(models.Model):
    Status = PaymentStatus

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="payments")
    member = models.ForeignKey(Member, on_delete=models.PROTECT, related_name="payments", null=True, blank=True)
    contribution = models.ForeignKey(Contribution, on_delete=models.PROTECT, related_name="payments", null=True, blank=True)
    reference = models.CharField(max_length=80, unique=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    provider_fee = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    novex_fee = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    net_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="XOF")
    provider = models.CharField(max_length=64, default="manual")
    provider_transaction_id = models.CharField(max_length=160, blank=True)
    checkout_url = models.URLField(blank=True)
    idempotency_key = models.CharField(max_length=160)
    status = models.CharField(max_length=24, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    payment_method = models.CharField(max_length=64, choices=PaymentMethod.choices, default=PaymentMethod.MANUAL)
    paid_at = models.DateTimeField(null=True, blank=True)
    reconciliation_status = models.CharField(max_length=24, choices=ReconciliationStatus.choices, default=ReconciliationStatus.UNMATCHED)
    refund_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    refund_reference = models.CharField(max_length=120, blank=True)
    refund_reason = models.TextField(blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["workspace", "idempotency_key"], name="uniq_payment_workspace_idempotency"),
            models.UniqueConstraint(fields=["provider", "provider_transaction_id"], condition=~models.Q(provider_transaction_id=""), name="uniq_payment_provider_transaction"),
        ]
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "created_at"]),
            models.Index(fields=["workspace", "member"]),
            models.Index(fields=["workspace", "contribution"]),
            models.Index(fields=["workspace", "reference"]),
            models.Index(fields=["workspace", "reconciliation_status"]),
            models.Index(fields=["provider", "provider_transaction_id"]),
        ]


class PaymentEvent(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="payment_events")
    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name="events")
    event_type = models.CharField(max_length=80, choices=PaymentEventType.choices)
    from_status = models.CharField(max_length=24, blank=True)
    to_status = models.CharField(max_length=24, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "payment", "-created_at"]), models.Index(fields=["event_type", "-created_at"])]


class Receipt(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="receipts")
    payment = models.OneToOneField(Payment, on_delete=models.CASCADE, related_name="receipt")
    contribution = models.ForeignKey(Contribution, on_delete=models.PROTECT, related_name="receipts", null=True, blank=True)
    member = models.ForeignKey(Member, on_delete=models.PROTECT, related_name="receipts", null=True, blank=True)
    reference = models.CharField(max_length=80, unique=True)
    receipt_number = models.CharField(max_length=80, unique=True, null=True, blank=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="XOF")
    status = models.CharField(max_length=24, choices=ReceiptStatus.choices, default=ReceiptStatus.GENERATED)
    verification_token_hash = models.CharField(max_length=160, blank=True)
    storage_key = models.CharField(max_length=255, blank=True)
    pdf_url = models.URLField(blank=True)
    issued_at = models.DateTimeField(auto_now_add=True)
    pdf_file = models.FileField(upload_to="receipts/", blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "member", "-issued_at"]), models.Index(fields=["workspace", "receipt_number"])]


class PaymentDocument(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="payment_documents")
    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name="documents")
    title = models.CharField(max_length=180)
    file = models.FileField(upload_to="payment-documents/")
    document_type = models.CharField(max_length=32, choices=PaymentDocumentType.choices, default=PaymentDocumentType.PROOF_OF_PAYMENT)
    mime_type = models.CharField(max_length=120, blank=True)
    size_bytes = models.PositiveBigIntegerField(default=0)
    scan_status = models.CharField(max_length=24, choices=ScanStatus.choices, default=ScanStatus.NOT_CONFIGURED)
    uploaded_by = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "payment", "-created_at"]), models.Index(fields=["document_type", "-created_at"])]


class FinancialAdjustment(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="financial_adjustments")
    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name="adjustments", null=True, blank=True)
    contribution = models.ForeignKey(Contribution, on_delete=models.PROTECT, related_name="financial_adjustments", null=True, blank=True)
    member = models.ForeignKey(Member, on_delete=models.PROTECT, related_name="financial_adjustments", null=True, blank=True)
    direction = models.CharField(max_length=8, choices=FinancialAdjustmentDirection.choices)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, default="XOF")
    reason = models.TextField()
    reference = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=24, choices=FinancialAdjustmentStatus.choices, default=FinancialAdjustmentStatus.POSTED)
    created_by = models.ForeignKey("users.User", on_delete=models.SET_NULL, null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancellation_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "-created_at"]), models.Index(fields=["workspace", "status"])]


class PaymentWebhookEvent(models.Model):
    provider = models.CharField(max_length=64)
    event_id = models.CharField(max_length=160)
    signature_valid = models.BooleanField(default=False)
    processed_at = models.DateTimeField(null=True, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["provider", "event_id"], name="uniq_payment_webhook_event")]
