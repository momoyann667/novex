from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.documents.models import Document
from apps.members.models import Member
from apps.payments.models import Payment
from apps.payments.statuses import PaymentStatus
from apps.workspaces.models import Workspace
from .models import Plan, Subscription


TRIAL_DAYS = 14

FEATURES = {
    "MEMBERS": "Gestion des membres",
    "CONTRIBUTIONS_MANAGEMENT": "Cotisations",
    "ONLINE_CONTRIBUTION_PAYMENT": "Paiement en ligne des cotisations",
    "DONATIONS": "Dons",
    "PROJECTS": "Projets",
    "EVENTS": "Evenements",
    "EXPENSES": "Depenses",
    "REVENUES": "Recettes",
    "DOCUMENTS": "Documents",
    "REPORTS": "Rapports",
    "ADVANCED_REPORTS": "Rapports avances",
    "AI_ASSISTANT": "Assistant IA",
    "ADVANCED_FINANCE": "Finance avancee",
    "ADVANCED_COMMUNICATION": "Communication avancee",
}

PLAN_CATALOG = {
    Plan.Code.FREEMIUM: {
        "name": "Freemium",
        "description": "Decouverte de NOVEX pendant 14 jours.",
        "price": Decimal("0.00"),
        "currency": "XOF",
        "billing_period": "trial",
        "limits": {"members": 25, "documents_mb": 250, "users": 2},
        "entitlements": {
            "MEMBERS": True,
            "CONTRIBUTIONS_MANAGEMENT": True,
            "DOCUMENTS": True,
            "REPORTS": "LIMITED",
        },
    },
    Plan.Code.NOVEX_START: {
        "name": "NOVEX Start",
        "description": "Pour les associations qui souhaitent structurer leur gestion.",
        "price": Decimal("5000.00"),
        "currency": "XOF",
        "billing_period": "month",
        "limits": {"members": 200, "documents_mb": 5120, "users": 5},
        "entitlements": {
            "MEMBERS": True,
            "CONTRIBUTIONS_MANAGEMENT": True,
            "DONATIONS": True,
            "PROJECTS": True,
            "EVENTS": True,
            "EXPENSES": True,
            "REVENUES": True,
            "DOCUMENTS": True,
            "REPORTS": True,
            "ONLINE_CONTRIBUTION_PAYMENT": False,
        },
    },
    Plan.Code.NOVEX_PRO: {
        "name": "NOVEX Pro",
        "description": "L'offre complete pour les associations.",
        "price": Decimal("15000.00"),
        "currency": "XOF",
        "billing_period": "month",
        "limits": {"members": 2000, "documents_mb": 51200, "users": 25},
        "entitlements": {
            "MEMBERS": True,
            "CONTRIBUTIONS_MANAGEMENT": True,
            "ONLINE_CONTRIBUTION_PAYMENT": True,
            "DONATIONS": True,
            "PROJECTS": True,
            "EVENTS": True,
            "EXPENSES": True,
            "REVENUES": True,
            "DOCUMENTS": True,
            "REPORTS": True,
            "ADVANCED_REPORTS": True,
            "AI_ASSISTANT": True,
            "ADVANCED_FINANCE": True,
            "ADVANCED_COMMUNICATION": True,
        },
    },
}


def log_subscription_action(*, workspace: Workspace, actor, action: str, metadata: dict | None = None) -> None:
    AuditLog.objects.create(workspace=workspace, actor=actor, action=action, resource="subscription", resource_id=str(workspace.id), metadata=metadata or {})


def catalog_payload(plan_code: str) -> dict:
    plan = PLAN_CATALOG[plan_code]
    return {
        "code": plan_code,
        "name": plan["name"],
        "description": plan["description"],
        "price": plan["price"],
        "currency": plan["currency"],
        "billing_period": plan["billing_period"],
        "limits": plan["limits"],
        "entitlements": plan["entitlements"],
    }


def ensure_plan_catalog() -> None:
    for code, payload in PLAN_CATALOG.items():
        Plan.objects.update_or_create(
            code=code,
            defaults={"name": payload["name"], "limits": payload["limits"], "entitlements": payload["entitlements"], "is_active": True},
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


def subscription_usage(workspace: Workspace, limits: dict) -> list[dict]:
    rows = []
    if "members" in limits:
        rows.append({"key": "members", "label": "Membres", "used": Member.objects.filter(workspace=workspace).exclude(status=Member.Status.ARCHIVED).count(), "limit": limits["members"]})
    if "users" in limits:
        rows.append({"key": "users", "label": "Utilisateurs", "used": workspace.memberships.filter(status="active").count(), "limit": limits["users"]})
    if "documents_mb" in limits:
        total_bytes = Document.objects.filter(workspace=workspace).aggregate(count=Count("id"))["count"] * 0
        rows.append({"key": "documents_mb", "label": "Documents", "used": total_bytes, "limit": limits["documents_mb"]})
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
        "payments": subscription_payments(workspace=workspace),
    }


def subscription_payments(*, workspace: Workspace) -> list[dict]:
    rows = Payment.objects.filter(workspace=workspace, metadata__payment_type="SUBSCRIPTION").order_by("-created_at")[:20]
    return [
        {
            "id": payment.id,
            "date": payment.paid_at or payment.created_at,
            "reference": payment.reference,
            "plan": payment.metadata.get("plan_name", ""),
            "amount": payment.amount,
            "currency": payment.currency,
            "method": payment.payment_method,
            "status": payment.status,
            "receipt": getattr(getattr(payment, "receipt", None), "receipt_number", ""),
        }
        for payment in rows
    ]


@transaction.atomic
def create_subscription_checkout(*, workspace: Workspace, actor, plan_code: str) -> dict:
    if plan_code not in {Plan.Code.NOVEX_START, Plan.Code.NOVEX_PRO}:
        raise ValueError("Offre invalide.")
    ensure_plan_catalog()
    plan_payload = PLAN_CATALOG[plan_code]
    log_subscription_action(workspace=workspace, actor=actor, action="subscription.checkout_requested", metadata={"plan": plan_code, "amount": str(plan_payload["price"])})
    return {
        "plan": catalog_payload(plan_code),
        "status": PaymentStatus.PENDING,
        "checkout_url": "",
        "online_available": False,
        "message": "Le paiement d'abonnement en ligne n'est pas encore configure.",
    }


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
