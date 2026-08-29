from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.contributions.models import Contribution
from apps.contributions.services import refresh_contribution_status
from apps.members.models import Member
from apps.workspaces.models import Workspace
from .models import Payment, PaymentWebhookEvent, Receipt


def build_receipt_reference(payment: Payment) -> str:
    return f"NVX-{payment.created_at:%Y%m}-{payment.id:06d}"


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
) -> Payment:
    if member.workspace_id != workspace.id:
        raise ValueError("Le membre appartient a un autre workspace.")
    if contribution and contribution.workspace_id != workspace.id:
        raise ValueError("La cotisation appartient a un autre workspace.")

    payment, created = Payment.objects.get_or_create(
        workspace=workspace,
        idempotency_key=idempotency_key,
        defaults={
            "member": member,
            "contribution": contribution,
            "amount": amount,
            "currency": workspace.currency,
            "provider": "manual",
            "payment_method": "manual",
            "status": Payment.Status.SUCCESSFUL,
            "paid_at": paid_at or timezone.now(),
        },
    )
    if not created:
        return payment

    if contribution:
        contribution.amount_paid += amount
        refresh_contribution_status(contribution)

    receipt = Receipt.objects.create(workspace=workspace, payment=payment, reference="pending")
    receipt.reference = build_receipt_reference(payment)
    receipt.save(update_fields=["reference"])

    AuditLog.objects.create(
        workspace=workspace,
        actor=actor,
        action="payment.recorded",
        resource="payment",
        resource_id=str(payment.id),
        metadata={"amount": str(amount), "receipt": receipt.reference},
    )
    return payment


@transaction.atomic
def register_webhook_event(*, provider: str, event_id: str, payload: dict, signature_valid: bool) -> tuple[PaymentWebhookEvent, bool]:
    event, created = PaymentWebhookEvent.objects.get_or_create(
        provider=provider,
        event_id=event_id,
        defaults={"payload": payload, "signature_valid": signature_valid},
    )
    return event, created
