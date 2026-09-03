from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.documents.models import Document
from apps.members.models import Member
from apps.payments.models import Payment
from apps.payments.providers import get_payment_provider
from apps.payments.services import create_receipt_for_payment, ensure_subscription_payment_reference, log_payment_event
from apps.payments.statuses import PaymentEventType, PaymentMethod, PaymentStatus
from apps.workspaces.models import Workspace
from .models import Plan, Subscription


TRIAL_DAYS = 14

FEATURES = {
    "DASHBOARD": "Dashboard",
    "MEMBERS_MANAGEMENT": "Gestion des membres",
    "CONTRIBUTIONS_MANAGEMENT": "Cotisations",
    "ONLINE_CONTRIBUTION_PAYMENT": "Paiement en ligne des cotisations",
    "PROJECTS_MANAGEMENT": "Projets",
    "EVENTS_MANAGEMENT": "Evenements",
    "EXPENSES_MANAGEMENT": "Depenses",
    "REVENUES_MANAGEMENT": "Recettes",
    "DOCUMENTS": "Documents",
    "REPORTS_BASIC": "Rapports",
    "ADVANCED_REPORTS": "Rapports avances",
    "COMMUNICATION": "Communication",
    "AI_ASSISTANT": "Assistant IA",
    "ADVANCED_FINANCE": "Finance avancee",
    "ADVANCED_COMMUNICATION": "Communication avancee",
    "EXPORTS": "Exports",
}

PLAN_CATALOG = {
    Plan.Code.FREEMIUM: {
        "name": "Freemium",
        "description": "Decouverte de NOVEX pendant 14 jours.",
        "price": Decimal("0.00"),
        "currency": "XOF",
        "billing_period": "trial",
        "limits": {"MAX_MEMBERS": 25, "MAX_DOCUMENTS_MB": 250, "MAX_USERS": 2},
        "entitlements": {
            "DASHBOARD": True,
            "MEMBERS_MANAGEMENT": True,
            "CONTRIBUTIONS_MANAGEMENT": True,
            "REVENUES_MANAGEMENT": True,
            "EXPENSES_MANAGEMENT": True,
            "PROJECTS_MANAGEMENT": True,
            "EVENTS_MANAGEMENT": True,
            "DOCUMENTS": True,
            "REPORTS_BASIC": True,
        },
    },
    Plan.Code.NOVEX_START: {
        "name": "NOVEX Start",
        "description": "Pour les associations qui souhaitent structurer leur gestion.",
        "price": Decimal("5000.00"),
        "currency": "XOF",
        "billing_period": "month",
        "limits": {"MAX_MEMBERS": 200, "MAX_DOCUMENTS_MB": 5120, "MAX_USERS": 5, "MAX_EXPORTS": 20},
        "entitlements": {
            "DASHBOARD": True,
            "MEMBERS_MANAGEMENT": True,
            "CONTRIBUTIONS_MANAGEMENT": True,
            "PROJECTS_MANAGEMENT": True,
            "EVENTS_MANAGEMENT": True,
            "EXPENSES_MANAGEMENT": True,
            "REVENUES_MANAGEMENT": True,
            "DOCUMENTS": True,
            "REPORTS_BASIC": True,
            "COMMUNICATION": True,
            "AI_ASSISTANT": True,
            "EXPORTS": True,
            "ONLINE_CONTRIBUTION_PAYMENT": False,
        },
    },
    Plan.Code.NOVEX_PRO: {
        "name": "NOVEX Pro",
        "description": "L'offre complete pour les associations.",
        "price": Decimal("10000.00"),
        "currency": "XOF",
        "billing_period": "month",
        "limits": {"MAX_MEMBERS": 2000, "MAX_DOCUMENTS_MB": 51200, "MAX_USERS": 25, "MAX_EXPORTS": None, "MAX_AI_REQUESTS": None},
        "entitlements": {
            "DASHBOARD": True,
            "MEMBERS_MANAGEMENT": True,
            "CONTRIBUTIONS_MANAGEMENT": True,
            "ONLINE_CONTRIBUTION_PAYMENT": True,
            "PROJECTS_MANAGEMENT": True,
            "EVENTS_MANAGEMENT": True,
            "EXPENSES_MANAGEMENT": True,
            "REVENUES_MANAGEMENT": True,
            "DOCUMENTS": True,
            "REPORTS_BASIC": True,
            "ADVANCED_REPORTS": True,
            "COMMUNICATION": True,
            "AI_ASSISTANT": True,
            "ADVANCED_FINANCE": True,
            "ADVANCED_COMMUNICATION": True,
            "EXPORTS": True,
        },
    },
}


def log_subscription_action(*, workspace: Workspace, actor, action: str, metadata: dict | None = None) -> None:
    AuditLog.objects.create(workspace=workspace, actor=actor, action=action, resource="subscription", resource_id=str(workspace.id), metadata=metadata or {})


def catalog_payload(plan_code: str) -> dict:
    plan = PLAN_CATALOG[plan_code]
    db_plan = Plan.objects.filter(code=plan_code).first()
    return {
        "code": plan_code,
        "name": db_plan.name if db_plan else plan["name"],
        "description": plan["description"],
        "price": db_plan.price if db_plan else plan["price"],
        "currency": db_plan.currency if db_plan else plan["currency"],
        "billing_period": db_plan.billing_period if db_plan else plan["billing_period"],
        "limits": db_plan.limits if db_plan else plan["limits"],
        "quotas": quota_payload(db_plan.limits if db_plan else plan["limits"]),
        "entitlements": db_plan.entitlements if db_plan else plan["entitlements"],
    }


def quota_payload(limits: dict) -> list[dict]:
    labels = {
        "MAX_MEMBERS": "Membres",
        "MAX_DOCUMENTS_MB": "Stockage documents",
        "MAX_USERS": "Utilisateurs",
        "MAX_EXPORTS": "Exports",
        "MAX_AI_REQUESTS": "Requetes IA",
    }
    rows = []
    for code, limit in limits.items():
        rows.append({"code": code, "label": labels.get(code, code), "limit": limit, "period": "monthly" if code in {"MAX_EXPORTS", "MAX_AI_REQUESTS"} else "workspace"})
    return rows


def ensure_plan_catalog() -> None:
    for code, payload in PLAN_CATALOG.items():
        Plan.objects.update_or_create(
            code=code,
            defaults={
                "name": payload["name"],
                "price": payload["price"],
                "currency": payload["currency"],
                "billing_period": payload["billing_period"],
                "limits": payload["limits"],
                "entitlements": payload["entitlements"],
                "is_active": True,
            },
        )


def ensure_workspace_subscription(workspace: Workspace) -> Subscription:
    ensure_plan_catalog()
    subscription = getattr(workspace, "subscription", None)
    if subscription:
        refresh_subscription_status(subscription)
        return subscription
    plan = Plan.objects.get(code=Plan.Code.FREEMIUM)
    now = timezone.now()
    return Subscription.objects.create(workspace=workspace, plan=plan, status=Subscription.Status.TRIAL, trial_started_at=now, trial_ends_at=now + timedelta(days=TRIAL_DAYS))


def refresh_subscription_status(subscription: Subscription) -> Subscription:
    now = timezone.now()
    if subscription.status == Subscription.Status.TRIAL and subscription.trial_ends_at and subscription.trial_ends_at < now:
        subscription.status = Subscription.Status.EXPIRED
        subscription.save(update_fields=["status"])
    elif subscription.status == Subscription.Status.ACTIVE and subscription.current_period_ends_at and subscription.current_period_ends_at < now:
        subscription.status = Subscription.Status.EXPIRED
        subscription.save(update_fields=["status"])
    return subscription


def active_entitlements(subscription: Subscription) -> dict:
    subscription = refresh_subscription_status(subscription)
    if subscription.status == Subscription.Status.EXPIRED:
        return PLAN_CATALOG[Plan.Code.FREEMIUM]["entitlements"]
    catalog = PLAN_CATALOG.get(subscription.plan.code, PLAN_CATALOG[Plan.Code.FREEMIUM])
    return {**catalog["entitlements"], **(subscription.plan.entitlements or {})}


def workspace_has_entitlement(workspace: Workspace, entitlement: str) -> bool:
    subscription = ensure_workspace_subscription(workspace)
    return active_entitlements(subscription).get(entitlement) is True


def quota_limit(workspace: Workspace, quota_code: str):
    subscription = ensure_workspace_subscription(workspace)
    catalog = catalog_payload(subscription.plan.code)
    return catalog["limits"].get(quota_code)


def check_subscription_quota(workspace: Workspace, quota_code: str, *, current_usage: int, increment: int = 1) -> None:
    limit = quota_limit(workspace, quota_code)
    if limit is None:
        return
    if current_usage + increment > int(limit):
        raise ValueError("Vous avez atteint la limite de votre forfait. Passez a une offre superieure pour continuer.")


def subscription_usage(workspace: Workspace, limits: dict) -> list[dict]:
    rows = []
    if "MAX_MEMBERS" in limits:
        rows.append({"key": "MAX_MEMBERS", "label": "Membres", "used": Member.objects.filter(workspace=workspace).exclude(status=Member.Status.ARCHIVED).count(), "limit": limits["MAX_MEMBERS"]})
    if "MAX_USERS" in limits:
        rows.append({"key": "MAX_USERS", "label": "Utilisateurs", "used": workspace.memberships.filter(status="active").count(), "limit": limits["MAX_USERS"]})
    if "MAX_DOCUMENTS_MB" in limits:
        total_bytes = Document.objects.filter(workspace=workspace).aggregate(count=Count("id"))["count"] * 0
        rows.append({"key": "MAX_DOCUMENTS_MB", "label": "Documents", "used": total_bytes, "limit": limits["MAX_DOCUMENTS_MB"]})
    return rows


def subscription_overview(*, workspace: Workspace) -> dict:
    subscription = ensure_workspace_subscription(workspace)
    catalog = catalog_payload(subscription.plan.code)
    entitlements = active_entitlements(subscription)
    now = timezone.now()
    trial_total = None
    trial_used = None
    days_remaining = None
    if subscription.trial_started_at and subscription.trial_ends_at:
        trial_total = max((subscription.trial_ends_at - subscription.trial_started_at).days, 1)
        trial_used = min(max((now - subscription.trial_started_at).days, 0), trial_total)
        days_remaining = max((subscription.trial_ends_at.date() - now.date()).days, 0)
    period_end = subscription.current_period_ends_at or subscription.trial_ends_at
    return {
        "subscription": {
            "plan": subscription.plan.code,
            "plan_name": catalog["name"],
            "status": subscription.status,
            "price": catalog["price"],
            "currency": catalog["currency"],
            "billing_period": catalog["billing_period"],
            "description": catalog["description"],
            "trial_started_at": subscription.trial_started_at,
            "trial_ends_at": subscription.trial_ends_at,
            "current_period_started_at": subscription.current_period_started_at,
            "current_period_ends_at": subscription.current_period_ends_at,
            "cancelled_at": subscription.cancelled_at,
            "period_ends_at": period_end,
            "days_remaining": days_remaining,
            "trial_progress": round((trial_used / trial_total) * 100, 2) if trial_total else None,
            "limits": catalog["limits"],
            "entitlements": entitlements,
        },
        "plans": [catalog_payload(code) for code in PLAN_CATALOG],
        "features": [{"code": code, "label": label} for code, label in FEATURES.items()],
        "usage": subscription_usage(workspace, catalog["limits"]),
        "payments": subscription_payments(workspace=workspace)["results"][:5],
    }


def subscription_payment_queryset(*, workspace: Workspace, filters: dict | None = None):
    filters = filters or {}
    queryset = Payment.objects.filter(workspace=workspace, metadata__payment_type="SUBSCRIPTION").select_related("receipt").order_by("-created_at")
    if filters.get("status"):
        queryset = queryset.filter(status=filters["status"])
    if filters.get("plan"):
        queryset = queryset.filter(metadata__plan_code=filters["plan"])
    if filters.get("search"):
        value = filters["search"]
        queryset = queryset.filter(Q(reference__icontains=value) | Q(provider_transaction_id__icontains=value) | Q(receipt__receipt_number__icontains=value))
    period = filters.get("period")
    today = timezone.localdate()
    if period == "this_year":
        queryset = queryset.filter(created_at__date__gte=today.replace(month=1, day=1))
    elif period == "previous_year":
        start = today.replace(year=today.year - 1, month=1, day=1)
        end = today.replace(year=today.year - 1, month=12, day=31)
        queryset = queryset.filter(created_at__date__gte=start, created_at__date__lte=end)
    if filters.get("date_from"):
        queryset = queryset.filter(created_at__date__gte=filters["date_from"])
    if filters.get("date_to"):
        queryset = queryset.filter(created_at__date__lte=filters["date_to"])
    return queryset


def serialize_subscription_payment(payment: Payment) -> dict:
    return {
        "id": payment.id,
        "date": payment.paid_at or payment.created_at,
        "reference": payment.reference,
        "plan": payment.metadata.get("plan_name", ""),
        "plan_code": payment.metadata.get("plan_code", ""),
        "amount": payment.amount,
        "currency": payment.currency,
        "method": payment.payment_method,
        "status": payment.status,
        "provider": payment.provider,
        "provider_reference": payment.provider_transaction_id,
        "period_start": payment.metadata.get("period_start", ""),
        "period_end": payment.metadata.get("period_end", ""),
        "receipt": getattr(getattr(payment, "receipt", None), "receipt_number", ""),
        "receipt_id": getattr(getattr(payment, "receipt", None), "id", None),
        "checkout_url": payment.checkout_url,
        "created_at": payment.created_at,
        "paid_at": payment.paid_at,
    }


def subscription_payments(*, workspace: Workspace, filters: dict | None = None, page: int = 1, page_size: int = 10) -> dict:
    queryset = subscription_payment_queryset(workspace=workspace, filters=filters)
    page = max(page, 1)
    page_size = min(max(page_size, 1), 50)
    total = queryset.count()
    start = (page - 1) * page_size
    rows = list(queryset[start : start + page_size])
    return {
        "count": total,
        "page": page,
        "page_size": page_size,
        "next": page + 1 if start + page_size < total else None,
        "previous": page - 1 if page > 1 else None,
        "results": [serialize_subscription_payment(payment) for payment in rows],
    }


def subscription_invoices(*, workspace: Workspace, filters: dict | None = None, page: int = 1, page_size: int = 10) -> dict:
    payments = subscription_payment_queryset(workspace=workspace, filters=filters).filter(status=PaymentStatus.SUCCESS, receipt__isnull=False)
    page = max(page, 1)
    page_size = min(max(page_size, 1), 50)
    total = payments.count()
    start = (page - 1) * page_size
    rows = list(payments[start : start + page_size])
    return {
        "count": total,
        "page": page,
        "page_size": page_size,
        "next": page + 1 if start + page_size < total else None,
        "previous": page - 1 if page > 1 else None,
        "results": [
            {
                "id": payment.receipt.id,
                "date": payment.receipt.issued_at,
                "number": payment.receipt.receipt_number,
                "plan": payment.metadata.get("plan_name", ""),
                "amount": payment.amount,
                "currency": payment.currency,
                "status": payment.receipt.status,
                "payment": payment.id,
                "download_url": f"/api/backend/receipts/{payment.receipt.id}/download/",
            }
            for payment in rows
        ],
    }


def subscription_payment_summary(*, workspace: Workspace) -> dict:
    queryset = subscription_payment_queryset(workspace=workspace)
    aggregates = queryset.aggregate(
        total_paid=Sum("amount", filter=Q(status=PaymentStatus.SUCCESS)),
        pending_count=Count("id", filter=Q(status__in=[PaymentStatus.PENDING, PaymentStatus.PROCESSING])),
        failed_count=Count("id", filter=Q(status=PaymentStatus.FAILED)),
        success_count=Count("id", filter=Q(status=PaymentStatus.SUCCESS)),
    )
    last_payment = queryset.first()
    subscription = ensure_workspace_subscription(workspace)
    catalog = catalog_payload(subscription.plan.code)
    next_date = subscription.current_period_ends_at or subscription.trial_ends_at
    return {
        "total_paid": aggregates["total_paid"] or Decimal("0.00"),
        "currency": catalog["currency"],
        "pending_count": aggregates["pending_count"],
        "failed_count": aggregates["failed_count"],
        "success_count": aggregates["success_count"],
        "last_payment": serialize_subscription_payment(last_payment) if last_payment else None,
        "next_renewal": {
            "plan": catalog["name"],
            "plan_code": subscription.plan.code,
            "amount": catalog["price"],
            "currency": catalog["currency"],
            "date": next_date,
            "frequency": catalog["billing_period"],
            "status": subscription.status,
            "days_remaining": max((next_date.date() - timezone.localdate()).days, 0) if next_date else None,
        },
        "auto_renew_supported": False,
    }


def subscription_renewals(*, workspace: Workspace) -> list[dict]:
    subscription = ensure_workspace_subscription(workspace)
    catalog = catalog_payload(subscription.plan.code)
    next_date = subscription.current_period_ends_at or subscription.trial_ends_at
    return [
        {
            "plan": catalog["name"],
            "amount": catalog["price"],
            "currency": catalog["currency"],
            "period": catalog["billing_period"],
            "scheduled_for": next_date,
            "status": subscription.status,
        }
    ] if next_date else []


def subscription_payments_overview(*, workspace: Workspace, filters: dict | None = None, page: int = 1, page_size: int = 10) -> dict:
    return {
        "summary": subscription_payment_summary(workspace=workspace),
        "payments": subscription_payments(workspace=workspace, filters=filters, page=page, page_size=page_size),
        "invoices": subscription_invoices(workspace=workspace, filters=filters, page=1, page_size=10),
        "renewals": subscription_renewals(workspace=workspace),
        "plans": [catalog_payload(code) for code in PLAN_CATALOG if code != Plan.Code.FREEMIUM],
    }


@transaction.atomic
def create_subscription_checkout(*, workspace: Workspace, actor, plan_code: str) -> dict:
    if plan_code not in {Plan.Code.NOVEX_START, Plan.Code.NOVEX_PRO}:
        raise ValueError("Offre invalide.")
    ensure_plan_catalog()
    subscription = ensure_workspace_subscription(workspace)
    if subscription.plan.code == plan_code and subscription.status == Subscription.Status.ACTIVE:
        raise ValueError("Ce forfait est deja actif.")
    plan = Plan.objects.get(code=plan_code, is_active=True)
    plan_payload = catalog_payload(plan_code)
    existing_payment = (
        Payment.objects.filter(
            workspace=workspace,
            metadata__payment_type="SUBSCRIPTION",
            metadata__plan_code=plan_code,
            status__in=[PaymentStatus.PENDING, PaymentStatus.PROCESSING],
        )
        .order_by("-created_at")
        .first()
    )
    if existing_payment:
        log_subscription_action(workspace=workspace, actor=actor, action="subscription.checkout_reused", metadata={"plan": plan_code, "payment_id": existing_payment.id})
        return {
            "plan": catalog_payload(plan_code),
            "payment": serialize_subscription_payment(existing_payment),
            "status": existing_payment.status,
            "checkout_url": existing_payment.checkout_url,
            "online_available": bool(existing_payment.checkout_url),
            "message": "Paiement d'abonnement deja en attente. Votre forfait sera active apres confirmation.",
        }
    period_start = timezone.now()
    period_end = period_start + timedelta(days=31)
    provider = get_payment_provider(None)
    payment, created = Payment.objects.get_or_create(
        workspace=workspace,
        idempotency_key=f"subscription-{workspace.id}-{plan_code}-{period_start:%Y%m%d%H%M%S}",
        defaults={
            "reference": ensure_subscription_payment_reference(),
            "member": None,
            "amount": plan.price,
            "currency": plan.currency,
            "provider": provider.code,
            "payment_method": PaymentMethod.AGGREGATOR,
            "status": PaymentStatus.PENDING,
            "net_amount": plan.price,
            "metadata": {
                "payment_type": "SUBSCRIPTION",
                "plan_code": plan_code,
                "plan_name": plan.name,
                "period_start": period_start.date().isoformat(),
                "period_end": period_end.date().isoformat(),
                "initialized_by": getattr(actor, "id", None),
            },
        },
    )
    if created:
        result = provider.initialize_payment(payment=payment)
        payment.provider_transaction_id = result.provider_transaction_id
        payment.checkout_url = result.checkout_url
        payment.status = result.status
        payment.metadata = {**payment.metadata, "provider_init": result.raw_response}
        payment.save(update_fields=["provider_transaction_id", "checkout_url", "status", "metadata", "updated_at"])
        log_payment_event(payment=payment, actor=actor, event_type=PaymentEventType.INITIALIZED, to_status=payment.status, metadata={"provider": provider.code, "payment_type": "SUBSCRIPTION"})
    log_subscription_action(workspace=workspace, actor=actor, action="subscription.checkout_requested", metadata={"plan": plan_code, "amount": str(plan.price)})
    return {
        "plan": catalog_payload(plan_code),
        "payment": serialize_subscription_payment(payment),
        "status": payment.status,
        "checkout_url": payment.checkout_url,
        "online_available": bool(payment.checkout_url),
        "message": "Paiement d'abonnement initialise." if payment.checkout_url else "Le paiement d'abonnement en ligne n'est pas encore configure.",
    }


@transaction.atomic
def retry_subscription_payment(*, workspace: Workspace, actor, payment_id: int) -> dict:
    payment = Payment.objects.select_for_update().filter(workspace=workspace, id=payment_id, metadata__payment_type="SUBSCRIPTION").first()
    if not payment:
        raise ValueError("Paiement SaaS introuvable.")
    if payment.status not in {PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.EXPIRED}:
        raise ValueError("Ce paiement ne peut pas etre relance.")
    plan_code = payment.metadata.get("plan_code")
    if plan_code not in {Plan.Code.NOVEX_START, Plan.Code.NOVEX_PRO}:
        raise ValueError("Plan de paiement invalide.")
    log_subscription_action(workspace=workspace, actor=actor, action="subscription.payment_retry_requested", metadata={"payment_id": payment.id, "plan": plan_code})
    return create_subscription_checkout(workspace=workspace, actor=actor, plan_code=plan_code)


@transaction.atomic
def activate_subscription_from_payment(*, payment: Payment, actor=None) -> Subscription:
    if payment.metadata.get("payment_type") != "SUBSCRIPTION":
        raise ValueError("Ce paiement n'est pas un paiement d'abonnement.")
    if payment.status != PaymentStatus.SUCCESS:
        raise ValueError("Le paiement doit etre confirme avant activation de l'abonnement.")
    plan_code = payment.metadata.get("plan_code")
    if plan_code not in PLAN_CATALOG:
        raise ValueError("Plan d'abonnement invalide.")
    ensure_plan_catalog()
    plan = Plan.objects.get(code=plan_code)
    now = payment.paid_at or timezone.now()
    period_end = now + timedelta(days=31)
    subscription, _created = Subscription.objects.update_or_create(
        workspace=payment.workspace,
        defaults={
            "plan": plan,
            "status": Subscription.Status.ACTIVE,
            "current_period_started_at": now,
            "current_period_ends_at": period_end,
            "cancelled_at": None,
        },
    )
    payment.metadata = {**payment.metadata, "period_start": now.date().isoformat(), "period_end": period_end.date().isoformat()}
    payment.save(update_fields=["metadata", "updated_at"])
    create_receipt_for_payment(payment, actor=actor)
    log_subscription_action(workspace=payment.workspace, actor=actor, action="subscription.payment_confirmed", metadata={"payment_id": payment.id, "plan": plan_code})
    return subscription


@transaction.atomic
def cancel_subscription(*, workspace: Workspace, actor) -> Subscription:
    subscription = ensure_workspace_subscription(workspace)
    if subscription.status not in {Subscription.Status.CANCELLED, Subscription.Status.EXPIRED}:
        subscription.status = Subscription.Status.CANCELLED
        subscription.cancelled_at = timezone.now()
        subscription.save(update_fields=["status", "cancelled_at"])
        log_subscription_action(workspace=workspace, actor=actor, action="subscription.cancelled", metadata={"plan": subscription.plan.code})
    return subscription


@transaction.atomic
def reactivate_subscription(*, workspace: Workspace, actor) -> Subscription:
    subscription = ensure_workspace_subscription(workspace)
    if subscription.status == Subscription.Status.CANCELLED:
        subscription.status = Subscription.Status.ACTIVE if subscription.plan.code != Plan.Code.FREEMIUM else Subscription.Status.TRIAL
        subscription.cancelled_at = None
        subscription.save(update_fields=["status", "cancelled_at"])
        log_subscription_action(workspace=workspace, actor=actor, action="subscription.reactivated", metadata={"plan": subscription.plan.code})
    return subscription
