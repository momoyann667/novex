from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDay, TruncMonth, TruncWeek
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.contributions.models import Contribution
from apps.contributions.services import refresh_contribution_status
from apps.contributions.statuses import ContributionStatus
from apps.members.models import Member
from apps.projects.models import Project
from apps.projects.statuses import ProjectStatus
from apps.workspaces.models import Workspace
from .models import FinancialAdjustment, Payment, PaymentDocument, PaymentEvent, PaymentWebhookEvent, Receipt
from .providers import get_payment_provider
from .statuses import ALLOWED_PAYMENT_TRANSITIONS, PaymentEventType, PaymentMethod, PaymentStatus, ReceiptStatus, ReconciliationStatus


ZERO = Decimal("0.00")
MAX_PAYMENT_DOCUMENT_BYTES = 10 * 1024 * 1024
ALLOWED_PAYMENT_DOCUMENT_MIME_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/webp"}
ALLOWED_PAYMENT_DOCUMENT_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}


def build_payment_reference() -> str:
    return f"NOVEX-{timezone.now():%Y}-{uuid4().hex[:12].upper()}"


def build_receipt_reference(payment: Payment) -> str:
    if payment.metadata.get("payment_type") == "SUBSCRIPTION":
        return f"INV-{payment.created_at:%Y}-{payment.id:06d}"
    return f"NVX-{payment.created_at:%Y}-{payment.id:06d}"


def build_subscription_payment_reference() -> str:
    return f"SUB-PAY-{timezone.now():%Y}-{uuid4().hex[:10].upper()}"


def ensure_payment_reference() -> str:
    reference = build_payment_reference()
    while Payment.objects.filter(reference=reference).exists():
        reference = build_payment_reference()
    return reference


def ensure_subscription_payment_reference() -> str:
    reference = build_subscription_payment_reference()
    while Payment.objects.filter(reference=reference).exists():
        reference = build_subscription_payment_reference()
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


def log_receipt_audit(*, receipt: Receipt, action: str, actor=None, metadata: dict | None = None) -> None:
    AuditLog.objects.create(
        workspace=receipt.workspace,
        actor=actor,
        action=action,
        resource="receipt",
        resource_id=str(receipt.id),
        metadata=metadata or {},
    )


def pdf_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build_receipt_pdf_bytes(receipt: Receipt) -> bytes:
    payment = receipt.payment
    contribution = receipt.contribution
    workspace = receipt.workspace
    is_subscription = payment.metadata.get("payment_type") == "SUBSCRIPTION"
    member_name = f"{payment.member.first_name} {payment.member.last_name}" if payment.member_id else "Non applicable"
    member_number = payment.member.membership_number if payment.member_id else "Non applicable"
    lines = [
        "NOVEX - Facture abonnement" if is_subscription else "NOVEX - Recu de paiement",
        f"Recu: {receipt.receipt_number}",
        f"Association: {workspace.name}",
        f"Membre: {member_name}",
        f"Identifiant membre: {member_number}",
        f"Montant: {receipt.amount} {receipt.currency}",
        f"Methode: {payment.payment_method}",
        f"Reference paiement: {payment.reference}",
        f"Provider: {payment.provider}",
        f"Date: {(payment.paid_at or receipt.issued_at).strftime('%Y-%m-%d %H:%M')}",
    ]
    if is_subscription:
        lines.extend(
            [
                f"Offre: {payment.metadata.get('plan_name', 'Abonnement NOVEX')}",
                f"Periode couverte: {payment.metadata.get('period_start', '')} -> {payment.metadata.get('period_end', '')}",
            ]
        )
    if contribution:
        lines.extend(
            [
                f"Cotisation: {contribution.campaign.name}",
                f"Echeance: {contribution.due_date or 'Non disponible'}",
            ]
        )
    text = ["BT", "/F1 18 Tf", "72 780 Td", f"({pdf_escape(lines[0])}) Tj", "/F1 11 Tf"]
    for line in lines[1:]:
        text.append("0 -24 Td")
        text.append(f"({pdf_escape(line)}) Tj")
    text.append("ET")
    stream = "\n".join(text).encode()
    objects = [
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
        b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
        b"5 0 obj << /Length " + str(len(stream)).encode() + b" >> stream\n" + stream + b"\nendstream endobj",
    ]
    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj + b"\n")
    xref_position = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode())
    pdf.extend(f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_position}\n%%EOF\n".encode())
    return bytes(pdf)


def generate_receipt_pdf(receipt: Receipt, *, actor=None) -> Receipt:
    if receipt.pdf_file:
        return receipt
    filename = f"{receipt.receipt_number}.pdf"
    receipt.pdf_file.save(filename, ContentFile(build_receipt_pdf_bytes(receipt)), save=False)
    receipt.storage_key = receipt.pdf_file.name
    receipt.pdf_url = receipt.pdf_file.url if hasattr(receipt.pdf_file, "url") else ""
    receipt.save(update_fields=["pdf_file", "storage_key", "pdf_url", "updated_at"])
    log_receipt_audit(receipt=receipt, action=PaymentEventType.RECEIPT_GENERATED, actor=actor, metadata={"storage_key": receipt.storage_key})
    log_payment_event(payment=receipt.payment, event_type=PaymentEventType.RECEIPT_GENERATED, actor=actor, metadata={"receipt_number": receipt.receipt_number})
    return receipt


def create_receipt_for_payment(payment: Payment, *, actor=None) -> Receipt:
    receipt_number = build_receipt_reference(payment)
    receipt, created = Receipt.objects.get_or_create(
        workspace=payment.workspace,
        payment=payment,
        defaults={
            "contribution": payment.contribution,
            "member": payment.member,
            "reference": receipt_number,
            "receipt_number": receipt_number,
            "amount": payment.amount,
            "currency": payment.currency,
            "status": ReceiptStatus.GENERATED,
        },
    )
    if created:
        log_receipt_audit(receipt=receipt, action=PaymentEventType.RECEIPT_CREATED, actor=actor, metadata={"payment_id": payment.id})
        log_payment_event(payment=payment, event_type=PaymentEventType.RECEIPT_CREATED, actor=actor, metadata={"receipt_number": receipt.receipt_number})
    return generate_receipt_pdf(receipt, actor=actor)


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


def member_for_payment_user(*, workspace: Workspace, user) -> Member:
    member = Member.objects.filter(workspace=workspace, linked_user=user, status=Member.Status.ACTIVE).first()
    if member:
        return member
    email = getattr(user, "email", "")
    if email:
        member = Member.objects.filter(workspace=workspace, email__iexact=email, status=Member.Status.ACTIVE).first()
        if member:
            return member
    raise ValueError("Votre compte n'est pas associe a un membre actif de cette association.")


def payable_contributions_for_member(*, workspace: Workspace, user) -> dict:
    member = member_for_payment_user(workspace=workspace, user=user)
    queryset = (
        Contribution.objects.select_related("campaign", "member")
        .filter(workspace=workspace, member=member)
        .exclude(status__in=[ContributionStatus.PAID, ContributionStatus.WAIVED, ContributionStatus.CANCELLED])
        .order_by("due_date", "created_at")
    )
    rows = [item for item in queryset if item.remaining_amount > ZERO]
    return {"member": member, "contributions": rows}


def donation_projects_for_workspace(*, workspace: Workspace):
    return (
        Project.objects.filter(workspace=workspace)
        .exclude(status__in=[ProjectStatus.CANCELLED, ProjectStatus.ARCHIVED])
        .order_by("-updated_at", "name")
    )


def validate_donation_payment(*, workspace: Workspace, project: Project, amount: Decimal) -> None:
    if project.workspace_id != workspace.id:
        raise ValueError("Le projet appartient a un autre workspace.")
    if project.status in {ProjectStatus.CANCELLED, ProjectStatus.ARCHIVED}:
        raise ValueError("Ce projet n'est plus disponible pour les dons.")
    if amount <= ZERO:
        raise ValueError("Le montant du don doit etre positif.")


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
    from apps.subscriptions.services import workspace_has_entitlement

    if not workspace_has_entitlement(workspace, "ONLINE_CONTRIBUTION_PAYMENT"):
        raise ValueError("Le paiement en ligne des cotisations est disponible avec NOVEX Pro.")
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
def initialize_self_contribution_payments(
    *,
    workspace: Workspace,
    actor,
    items: list[dict],
    payment_method: str,
    idempotency_key: str,
    provider_code: str | None = None,
) -> list[Payment]:
    member = member_for_payment_user(workspace=workspace, user=actor)
    if not items:
        raise ValueError("Selectionnez au moins une cotisation.")
    payments = []
    for index, item in enumerate(items, start=1):
        contribution = Contribution.objects.select_for_update().select_related("member", "workspace").get(id=item["contribution"].id)
        if contribution.member_id != member.id:
            raise ValueError("Cette cotisation ne vous appartient pas.")
        payment = initialize_contribution_payment(
            workspace=workspace,
            actor=actor,
            contribution=contribution,
            amount=item["amount"],
            payment_method=payment_method,
            idempotency_key=f"{idempotency_key}-contribution-{contribution.id}-{index}",
            provider_code=provider_code,
        )
        payments.append(payment)
    return payments


@transaction.atomic
def initialize_donation_payment(
    *,
    workspace: Workspace,
    actor,
    project: Project,
    amount: Decimal,
    payment_method: str,
    idempotency_key: str,
    provider_code: str | None = None,
) -> Payment:
    member = member_for_payment_user(workspace=workspace, user=actor)
    project = Project.objects.select_for_update().get(id=project.id)
    validate_donation_payment(workspace=workspace, project=project, amount=amount)
    provider = get_payment_provider(provider_code)
    payment, created = Payment.objects.get_or_create(
        workspace=workspace,
        idempotency_key=idempotency_key,
        defaults={
            "reference": ensure_payment_reference(),
            "member": member,
            "amount": amount,
            "currency": workspace.currency,
            "provider": provider.code,
            "payment_method": payment_method,
            "status": PaymentStatus.PENDING,
            "net_amount": amount,
            "metadata": {
                "payment_type": "DONATION",
                "project_id": project.id,
                "project_name": project.name,
                "initialized_by": getattr(actor, "id", None),
            },
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
    log_payment_event(payment=payment, actor=actor, event_type=PaymentEventType.INITIALIZED, to_status=payment.status, metadata={"provider": provider.code, "payment_type": "DONATION"})
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
    payment.reconciliation_status = ReconciliationStatus.MATCHED if payment.contribution_id else ReconciliationStatus.REVIEW_REQUIRED
    payment.save(update_fields=["reconciliation_status", "updated_at"])
    create_receipt_for_payment(payment, actor=actor)
    if payment.metadata.get("payment_type") == "SUBSCRIPTION":
        from apps.subscriptions.services import activate_subscription_from_payment

        activate_subscription_from_payment(payment=payment, actor=actor)
        return payment
    from apps.finance.services import sync_payment_to_finance

    sync_payment_to_finance(payment=payment, actor=actor)
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
    existing_payment = Payment.objects.filter(workspace=workspace, idempotency_key=idempotency_key).first()
    if existing_payment:
        return existing_payment
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
    log_payment_event(payment=payment, event_type=PaymentEventType.REFUND_REQUESTED, actor=actor, metadata={"refund_amount": str(refund_amount)})
    status = PaymentStatus.REFUNDED if refund_amount >= payment.amount else PaymentStatus.PARTIALLY_REFUNDED
    payment.refund_amount = refund_amount
    payment.refund_reference = f"RF-{payment.reference}"
    payment.refunded_at = timezone.now()
    payment.save(update_fields=["refund_amount", "refund_reference", "refunded_at", "updated_at"])
    return transition_payment_status(payment=payment, to_status=status, actor=actor, metadata={"refund_amount": str(refund_amount), "provider_refund": "not_configured"})


def payment_dashboard(*, workspace: Workspace, range_code: str | None = "30d", group_by: str | None = "day") -> dict:
    today = timezone.localdate()
    month_start = today.replace(day=1)
    queryset = Payment.objects.filter(workspace=workspace)
    days_by_range = {"7d": 7, "30d": 30, "3m": 90, "6m": 180, "12m": 365}
    start = timezone.now() - timedelta(days=days_by_range.get(range_code or "30d", 30))
    trunc = TruncMonth("created_at") if group_by == "month" else TruncWeek("created_at") if group_by == "week" else TruncDay("created_at")
    stats = queryset.aggregate(
        today_count=Count("id", filter=Q(created_at__date=today)),
        today_amount=Sum("amount", filter=Q(created_at__date=today, status=PaymentStatus.SUCCESS)),
        month_count=Count("id", filter=Q(created_at__date__gte=month_start)),
        month_amount=Sum("amount", filter=Q(created_at__date__gte=month_start, status=PaymentStatus.SUCCESS)),
        successful_count=Count("id", filter=Q(status=PaymentStatus.SUCCESS)),
        failed_count=Count("id", filter=Q(status=PaymentStatus.FAILED)),
        pending_count=Count("id", filter=Q(status__in=[PaymentStatus.PENDING, PaymentStatus.PROCESSING])),
        total_paid=Sum("amount", filter=Q(status=PaymentStatus.SUCCESS)),
        total_pending=Sum("amount", filter=Q(status__in=[PaymentStatus.PENDING, PaymentStatus.PROCESSING])),
        total_failed=Sum("amount", filter=Q(status=PaymentStatus.FAILED)),
    )
    total_decided = (stats["successful_count"] or 0) + (stats["failed_count"] or 0)
    success_rate = round(((stats["successful_count"] or 0) / total_decided) * 100, 2) if total_decided else 0
    series = (
        queryset.filter(status=PaymentStatus.SUCCESS, created_at__gte=start)
        .annotate(bucket=trunc)
        .values("bucket")
        .annotate(amount=Sum("amount"), count=Count("id"))
        .order_by("bucket")
    )
    method_rows = queryset.values("payment_method").annotate(count=Count("id"), amount=Sum("amount")).order_by("payment_method")
    total_amount = sum((row["amount"] or ZERO for row in method_rows), ZERO)
    return {
        **stats,
        "today_amount": stats["today_amount"] or ZERO,
        "month_amount": stats["month_amount"] or ZERO,
        "total_paid": stats["total_paid"] or ZERO,
        "total_pending": stats["total_pending"] or ZERO,
        "total_failed": stats["total_failed"] or ZERO,
        "payment_success_rate": success_rate,
        "payment_failure_rate": round(100 - success_rate, 2) if total_decided else 0,
        "series": [{"period": row["bucket"].date().isoformat(), "amount": row["amount"] or ZERO, "count": row["count"]} for row in series],
        "methods": [
            {
                "method": row["payment_method"],
                "count": row["count"],
                "amount": row["amount"] or ZERO,
                "percentage": round(((row["amount"] or ZERO) / total_amount) * 100, 2) if total_amount else 0,
            }
            for row in method_rows
        ],
    }


def receipt_downloaded(*, receipt: Receipt, actor=None) -> Receipt:
    log_receipt_audit(receipt=receipt, action=PaymentEventType.RECEIPT_DOWNLOADED, actor=actor)
    log_payment_event(payment=receipt.payment, event_type=PaymentEventType.RECEIPT_DOWNLOADED, actor=actor, metadata={"receipt_number": receipt.receipt_number})
    return receipt


def send_receipt(*, receipt: Receipt, actor=None, channel: str = "in_app") -> dict:
    result = {"channel": channel, "delivery": "recorded" if channel == "in_app" else "not_configured"}
    receipt.status = ReceiptStatus.SENT if channel == "in_app" else receipt.status
    receipt.save(update_fields=["status", "updated_at"])
    log_receipt_audit(receipt=receipt, action=PaymentEventType.RECEIPT_SENT, actor=actor, metadata=result)
    log_payment_event(payment=receipt.payment, event_type=PaymentEventType.RECEIPT_SENT, actor=actor, metadata={**result, "receipt_number": receipt.receipt_number})
    return result


def validate_payment_document_file(file_obj) -> tuple[str, int]:
    size = getattr(file_obj, "size", 0) or 0
    name = getattr(file_obj, "name", "")
    extension = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
    mime_type = getattr(file_obj, "content_type", "") or ""
    if size > MAX_PAYMENT_DOCUMENT_BYTES:
        raise ValueError("Le fichier depasse la taille maximale autorisee.")
    if extension not in ALLOWED_PAYMENT_DOCUMENT_EXTENSIONS:
        raise ValueError("Extension de fichier non autorisee.")
    if mime_type not in ALLOWED_PAYMENT_DOCUMENT_MIME_TYPES:
        raise ValueError("Type MIME non autorise.")
    return mime_type, size


@transaction.atomic
def attach_payment_document(*, payment: Payment, actor, title: str, file, document_type: str, notes: str = "") -> PaymentDocument:
    payment = Payment.objects.select_for_update().get(id=payment.id)
    mime_type, size = validate_payment_document_file(file)
    document = PaymentDocument.objects.create(
        workspace=payment.workspace,
        payment=payment,
        title=title,
        file=file,
        document_type=document_type,
        mime_type=mime_type,
        size_bytes=size,
        uploaded_by=actor,
    )
    metadata = {"document_id": document.id, "document_type": document.document_type, "scan_status": document.scan_status, "notes": notes}
    log_payment_event(payment=payment, event_type=PaymentEventType.PAYMENT_DOCUMENT_UPLOADED, actor=actor, metadata=metadata)
    return document


@transaction.atomic
def delete_payment_document(*, document: PaymentDocument, actor) -> PaymentDocument:
    document.deleted_at = timezone.now()
    document.save(update_fields=["deleted_at"])
    log_payment_event(payment=document.payment, event_type=PaymentEventType.PAYMENT_DOCUMENT_DELETED, actor=actor, metadata={"document_id": document.id})
    return document


def member_financial_history(*, workspace: Workspace, member: Member) -> dict:
    if member.workspace_id != workspace.id:
        raise ValueError("Le membre appartient a un autre workspace.")
    contributions = Contribution.objects.filter(workspace=workspace, member=member)
    payments = Payment.objects.filter(workspace=workspace, member=member).select_related("contribution", "receipt").order_by("-created_at")
    totals = contributions.aggregate(total_due=Sum("amount_due"), total_paid=Sum("amount_paid"))
    overdue_count = contributions.filter(status=ContributionStatus.OVERDUE).count()
    total_due = totals["total_due"] or ZERO
    total_paid = totals["total_paid"] or ZERO
    return {
        "member": {"id": member.id, "name": str(member), "membership_number": member.membership_number, "phone": member.phone},
        "total_due": total_due,
        "total_paid": total_paid,
        "remaining_to_pay": max(total_due - total_paid, ZERO),
        "payment_count": payments.count(),
        "overdue_count": overdue_count,
        "last_payment_at": payments.values_list("paid_at", flat=True).first(),
        "rows": [
            {
                "date": payment.paid_at or payment.created_at,
                "contribution": payment.contribution.campaign.name if payment.contribution_id else "",
                "amount": payment.amount,
                "method": payment.payment_method,
                "status": payment.status,
                "receipt": payment.receipt.receipt_number if hasattr(payment, "receipt") else "",
                "payment_id": payment.id,
            }
            for payment in payments
        ],
    }


def financial_history(*, workspace: Workspace, filters: dict | None = None) -> list[dict]:
    filters = filters or {}
    payments = Payment.objects.filter(workspace=workspace).select_related("member", "contribution")
    adjustments = FinancialAdjustment.objects.filter(workspace=workspace).select_related("member")
    if filters.get("date_from"):
        payments = payments.filter(created_at__date__gte=filters["date_from"])
        adjustments = adjustments.filter(created_at__date__gte=filters["date_from"])
    if filters.get("date_to"):
        payments = payments.filter(created_at__date__lte=filters["date_to"])
        adjustments = adjustments.filter(created_at__date__lte=filters["date_to"])
    if filters.get("member"):
        payments = payments.filter(member_id=filters["member"])
        adjustments = adjustments.filter(member_id=filters["member"])
    if filters.get("reference"):
        payments = payments.filter(Q(reference__icontains=filters["reference"]) | Q(provider_transaction_id__icontains=filters["reference"]))
        adjustments = adjustments.filter(reference__icontains=filters["reference"])
    if filters.get("status"):
        payments = payments.filter(status=filters["status"])
    requested_type = (filters.get("type") or "").lower()
    include_payments = requested_type in {"", "payment", "payments", "cotisation", "cotisations", "remboursement", "refund"}
    include_adjustments = requested_type in {"", "adjustment", "adjustments", "ajustement", "ajustements"}
    rows = [
        {
            "date": payment.paid_at or payment.created_at,
            "type": "Cotisation" if payment.contribution_id else "Paiement",
            "description": f"{payment.contribution.campaign.name if payment.contribution_id else 'Paiement'} - {payment.member}",
            "entry": payment.amount if payment.status == PaymentStatus.SUCCESS else ZERO,
            "out": payment.refund_amount if payment.status in {PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED} else ZERO,
            "reference": payment.reference,
            "user": "",
            "status": payment.status,
        }
        for payment in payments
    ] if include_payments else []
    if include_adjustments:
        rows.extend(
            {
                "date": adjustment.created_at,
                "type": "Ajustement",
                "description": adjustment.reason,
                "entry": adjustment.amount if adjustment.direction == "IN" else ZERO,
                "out": adjustment.amount if adjustment.direction == "OUT" else ZERO,
                "reference": adjustment.reference,
                "user": str(adjustment.created_by or ""),
                "status": adjustment.status,
            }
            for adjustment in adjustments
        )
    return sorted(rows, key=lambda row: row["date"], reverse=True)


@transaction.atomic
def create_financial_adjustment(*, workspace: Workspace, actor, **data) -> FinancialAdjustment:
    for field in ["payment", "contribution", "member"]:
        item = data.get(field)
        if item and item.workspace_id != workspace.id:
            raise ValueError("Une ressource d'ajustement appartient a un autre workspace.")
    data.setdefault("currency", workspace.currency)
    adjustment = FinancialAdjustment.objects.create(workspace=workspace, created_by=actor, **data)
    AuditLog.objects.create(
        workspace=workspace,
        actor=actor,
        action=PaymentEventType.FINANCIAL_ADJUSTMENT_CREATED,
        resource="financial_adjustment",
        resource_id=str(adjustment.id),
        metadata={"amount": str(adjustment.amount), "direction": adjustment.direction},
    )
    return adjustment
