from decimal import Decimal
from uuid import uuid4

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.contributions.models import Contribution
from apps.contributions.services import refresh_contribution_status
from apps.contributions.statuses import ContributionStatus
from apps.members.models import Member
from apps.workspaces.models import Workspace
from .models import Payment, PaymentEvent, PaymentWebhookEvent, Receipt
from .providers import get_payment_provider
from .statuses import ALLOWED_PAYMENT_TRANSITIONS, PaymentEventType, PaymentMethod, PaymentStatus


ZERO = Decimal("0.00")


def build_payment_reference() -> str:
    return f"NOVEX-{timezone.now():%Y}-{uuid4().hex[:12].upper()}"


def build_receipt_reference(payment: Payment) -> str:
    return f"NVX-{payment.created_at:%Y%m}-{payment.id:06d}"


def ensure_payment_reference() -> str:
    reference = build_payment_reference()
    while Payment.objects.filter(reference=reference).exists():
        reference = build_payment_reference()
    return reference


def log_payment_event(*, payment: Payment, event_type: str, from_status: str = "", to_status: str = "", metadata: dict | None = None, actor=None) -> PaymentEvent:
    clean_metadata = {key: value for key, value in (metadata or {}).items() if "secret" not in key.lower()}
    event = PaymentEvent.objects.create(
        workspace=payment.workspace,
        payment=payment,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        metadata=clean_metadata,
    )
    AuditLog.objects.create(
        workspace=payment.workspace,
        actor=actor,
        action=event_type,
        resource="payment",
        resource_id=str(payment.id),
        metadata=clean_metadata,
    )
    return event


def validate_contribution_payment(*, workspace: Workspace, contribution: Contribution, amount: Decimal) -> None:
    if contribution.workspace_id != workspace.id:
        raise ValueError("La cotisation appartient a un autre workspace.")
    if contribution.status in {ContributionStatus.PAID, ContributionStatus.WAIVED, ContributionStatus.CANCELLED}:
        raise ValueError("Cette cotisation ne peut plus etre payee.")
    if contribution.remaining_amount <= ZERO:
        raise ValueError("Aucun montant restant a payer.")
    if amount <= ZERO:
        raise ValueError("Le montant doit etre positif.")
    if amount > contribution.remaining_amount:
        raise ValueError("Le montant depasse le reste a payer.")


def transition_payment_status(*, payment: Payment, to_status: str, actor=None, metadata: dict | None = None) -> Payment:
    from_status = payment.status
    if from_status == to_status:
        return payment
    if to_status not in ALLOWED_PAYMENT_TRANSITIONS.get(from_status, set()):
        raise ValueError(f"Transition paiement invalide: {from_status} -> {to_status}")
    payment.status = to_status
    if to_status == PaymentStatus.SUCCESS:
        payment.paid_at = payment.paid_at or timezone.now()
    payment.save(update_fields=["status", "paid_at", "updated_at"])
    event_type = {
        PaymentStatus.PROCESSING: PaymentEventType.PROCESSING,
        PaymentStatus.SUCCESS: PaymentEventType.SUCCEEDED,
        PaymentStatus.FAILED: PaymentEventType.FAILED,
        PaymentStatus.CANCELLED: PaymentEventType.CANCELLED,
        PaymentStatus.EXPIRED: PaymentEventType.EXPIRED,
        PaymentStatus.REFUNDED: PaymentEventType.REFUNDED,
        PaymentStatus.PARTIALLY_REFUNDED: PaymentEventType.REFUNDED,
    }.get(to_status, PaymentEventType.PROCESSING)
    log_payment_event(payment=payment, actor=actor, event_type=event_type, from_status=from_status, to_status=to_status, metadata=metadata)
    return payment


@transaction.atomic
def initialize_contribution_payment(
    *,
    workspace: Workspace,
    actor,
    contribution: Contribution,
    amount: Decimal,
    payment_method: str,
    idempotency_key: str,
    provider_code: str | None = None,
) -> Payment:
    contribution = Contribution.objects.select_for_update().select_related("member", "workspace").get(id=contribution.id)
    validate_contribution_payment(workspace=workspace, contribution=contribution, amount=amount)
    provider = get_payment_provider(provider_code)
    payment, created = Payment.objects.get_or_create(
        workspace=workspace,
        idempotency_key=idempotency_key,
        defaults={
            "reference": ensure_payment_reference(),
            "member": contribution.member,
            "contribution": contribution,
            "amount": amount,
            "currency": contribution.currency,
            "provider": provider.code,
            "payment_method": payment_method,
            "status": PaymentStatus.PENDING,
            "net_amount": amount,
            "metadata": {"initialized_by": getattr(actor, "id", None)},
        },
    )
    if not created:
        return payment
    result = provider.initialize_payment(payment=payment)
    payment.provider_transaction_id = result.provider_transaction_id
    payment.checkout_url = result.checkout_url
    payment.status = result.status
    payment.metadata = {**payment.metadata, "provider_init": result.raw_response}
    payment.save(update_fields=["provider_transaction_id", "checkout_url", "status", "metadata", "updated_at"])
    log_payment_event(payment=payment, actor=actor, event_type=PaymentEventType.INITIALIZED, to_status=payment.status, metadata={"provider": provider.code})
    return payment


@transaction.atomic
def apply_successful_payment(*, payment: Payment, actor=None, metadata: dict | None = None) -> Payment:
    payment = Payment.objects.select_for_update().select_related("contribution", "member", "workspace").get(id=payment.id)
    if payment.status == PaymentStatus.SUCCESS:
        return payment
    if payment.contribution_id:
        contribution = Contribution.objects.select_for_update().get(id=payment.contribution_id)
        validate_contribution_payment(workspace=payment.workspace, contribution=contribution, amount=payment.amount)
        contribution.amount_paid += payment.amount
        refresh_contribution_status(contribution)
    transition_payment_status(payment=payment, to_status=PaymentStatus.SUCCESS, actor=actor, metadata=metadata)
    Receipt.objects.get_or_create(workspace=payment.workspace, payment=payment, defaults={"reference": build_receipt_reference(payment)})
    return payment


@transaction.atomic
def record_manual_payment(
    *,
    workspace: Workspace,
    actor,
    member: Member,
    amount: Decimal,
    contribution: Contribution | None = None,
    paid_at=None,
    idempotency_key: str,
    payment_method: str = PaymentMethod.MANUAL,
    metadata: dict | None = None,
) -> Payment:
    if member.workspace_id != workspace.id:
        raise ValueError("Le membre appartient a un autre workspace.")
    if contribution:
        contribution = Contribution.objects.select_for_update().get(id=contribution.id)
        validate_contribution_payment(workspace=workspace, contribution=contribution, amount=amount)
    payment, created = Payment.objects.get_or_create(
        workspace=workspace,
        idempotency_key=idempotency_key,
        defaults={
            "reference": ensure_payment_reference(),
            "member": member,
            "contribution": contribution,
            "amount": amount,
            "currency": workspace.currency,
            "provider": "manual",
            "payment_method": payment_method,
            "status": PaymentStatus.PENDING,
            "paid_at": paid_at or timezone.now(),
            "net_amount": amount,
            "metadata": metadata or {},
        },
    )
    if not created:
        return payment
    return apply_successful_payment(payment=payment, actor=actor, metadata={"manual": True})


@transaction.atomic
def register_webhook_event(*, provider: str, event_id: str, payload: dict, signature_valid: bool) -> tuple[PaymentWebhookEvent, bool]:
    event, created = PaymentWebhookEvent.objects.get_or_create(
        provider=provider,
        event_id=event_id,
        defaults={"payload": payload, "signature_valid": signature_valid},
    )
    return event, created


def normalize_provider_status(status: str) -> str:
    value = (status or "").upper()
    return {
        "SUCCESS": PaymentStatus.SUCCESS,
        "SUCCEEDED": PaymentStatus.SUCCESS,
        "SUCCESSFUL": PaymentStatus.SUCCESS,
        "PROCESSING": PaymentStatus.PROCESSING,
        "PENDING": PaymentStatus.PROCESSING,
        "FAILED": PaymentStatus.FAILED,
        "CANCELLED": PaymentStatus.CANCELLED,
        "CANCELED": PaymentStatus.CANCELLED,
        "EXPIRED": PaymentStatus.EXPIRED,
    }.get(value, PaymentStatus.PROCESSING)


def mark_webhook_processed(webhook_event: PaymentWebhookEvent) -> PaymentWebhookEvent:
    webhook_event.processed_at = timezone.now()
    webhook_event.save(update_fields=["processed_at"])
    return webhook_event


@transaction.atomic
def process_payment_webhook(*, provider_code: str, event_id: str, payload: dict, signature: str) -> tuple[PaymentWebhookEvent, Payment | None, bool]:
    provider = get_payment_provider(provider_code)
    signature_valid = provider.validate_webhook(payload=payload, signature=signature)
    webhook_event, created = register_webhook_event(provider=provider_code, event_id=event_id, payload=payload, signature_valid=signature_valid)
    if not created:
        return webhook_event, None, False
    if not signature_valid:
        AuditLog.objects.create(workspace=None, actor=None, action=PaymentEventType.WEBHOOK_REJECTED, resource="payment_webhook", resource_id=str(webhook_event.id), metadata={"provider": provider_code})
        mark_webhook_processed(webhook_event)
        return webhook_event, None, False
    data = provider.extract_transaction(payload=payload)
    payment = Payment.objects.select_for_update().filter(provider=provider.code, reference=data.get("reference", "")).first()
    if not payment:
        AuditLog.objects.create(workspace=None, actor=None, action=PaymentEventType.WEBHOOK_REJECTED, resource="payment_webhook", resource_id=str(webhook_event.id), metadata={"provider": provider_code, "reason": "payment_not_found"})
        mark_webhook_processed(webhook_event)
        return webhook_event, None, False
    log_payment_event(payment=payment, event_type=PaymentEventType.WEBHOOK_RECEIVED, metadata={"event_id": event_id, "provider": provider_code})
    if data.get("currency") and data["currency"] != payment.currency:
        log_payment_event(payment=payment, event_type=PaymentEventType.WEBHOOK_REJECTED, metadata={"reason": "currency_mismatch"})
        mark_webhook_processed(webhook_event)
        return webhook_event, payment, False
    if data.get("amount") is not None and Decimal(str(data["amount"])) != payment.amount:
        log_payment_event(payment=payment, event_type=PaymentEventType.WEBHOOK_REJECTED, metadata={"reason": "amount_mismatch"})
        mark_webhook_processed(webhook_event)
        return webhook_event, payment, False
    if data.get("provider_transaction_id"):
        payment.provider_transaction_id = data["provider_transaction_id"]
        payment.save(update_fields=["provider_transaction_id", "updated_at"])
    target_status = normalize_provider_status(data.get("status", ""))
    if target_status == PaymentStatus.SUCCESS:
        payment = apply_successful_payment(payment=payment, metadata={"webhook_event_id": webhook_event.id})
    else:
        try:
            payment = transition_payment_status(payment=payment, to_status=target_status, metadata={"webhook_event_id": webhook_event.id})
        except ValueError as exc:
            log_payment_event(payment=payment, event_type=PaymentEventType.WEBHOOK_REJECTED, metadata={"reason": str(exc)})
            mark_webhook_processed(webhook_event)
            return webhook_event, payment, False
    mark_webhook_processed(webhook_event)
    return webhook_event, payment, True


@transaction.atomic
def request_refund(*, payment: Payment, actor, amount: Decimal | None = None) -> Payment:
    payment = Payment.objects.select_for_update().get(id=payment.id)
    if payment.status != PaymentStatus.SUCCESS:
        raise ValueError("Seul un paiement reussi peut etre rembourse.")
    refund_amount = amount or payment.amount
    status = PaymentStatus.REFUNDED if refund_amount >= payment.amount else PaymentStatus.PARTIALLY_REFUNDED
    return transition_payment_status(payment=payment, to_status=status, actor=actor, metadata={"refund_amount": str(refund_amount), "provider_refund": "not_configured"})


def payment_dashboard(*, workspace: Workspace) -> dict:
    today = timezone.localdate()
    month_start = today.replace(day=1)
    queryset = Payment.objects.filter(workspace=workspace)
    stats = queryset.aggregate(
        today_count=Count("id", filter=Q(created_at__date=today)),
        month_count=Count("id", filter=Q(created_at__date__gte=month_start)),
        successful_count=Count("id", filter=Q(status=PaymentStatus.SUCCESS)),
        failed_count=Count("id", filter=Q(status=PaymentStatus.FAILED)),
        pending_count=Count("id", filter=Q(status__in=[PaymentStatus.PENDING, PaymentStatus.PROCESSING])),
        total_paid=Sum("amount", filter=Q(status=PaymentStatus.SUCCESS)),
        total_pending=Sum("amount", filter=Q(status__in=[PaymentStatus.PENDING, PaymentStatus.PROCESSING])),
        total_failed=Sum("amount", filter=Q(status=PaymentStatus.FAILED)),
    )
    total_decided = (stats["successful_count"] or 0) + (stats["failed_count"] or 0)
    success_rate = round(((stats["successful_count"] or 0) / total_decided) * 100, 2) if total_decided else 0
    return {
        **stats,
        "total_paid": stats["total_paid"] or ZERO,
        "total_pending": stats["total_pending"] or ZERO,
        "total_failed": stats["total_failed"] or ZERO,
        "payment_success_rate": success_rate,
        "payment_failure_rate": round(100 - success_rate, 2) if total_decided else 0,
    }
