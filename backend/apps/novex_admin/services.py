from datetime import datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.members.models import Member
from apps.payments.models import Payment
from apps.payments.statuses import PaymentStatus
from apps.subscriptions.models import Plan, Subscription
from apps.subscriptions.services import PLAN_CATALOG, ensure_plan_catalog
from apps.workspaces.models import Permission, Role, RolePermission, Workspace

User = get_user_model()

NOVEX_ADMIN_ROLE = "NOVEX_ADMIN"
ADMIN_PERMISSIONS = {
    "ADMIN_DASHBOARD_VIEW": "Voir le dashboard admin NOVEX",
    "ASSOCIATIONS_VIEW": "Voir toutes les associations",
    "ASSOCIATIONS_MANAGE": "Administrer les associations",
    "USERS_VIEW": "Voir les utilisateurs",
    "USERS_MANAGE": "Administrer les utilisateurs",
    "SUBSCRIPTIONS_VIEW": "Voir les abonnements",
    "SUBSCRIPTIONS_MANAGE": "Administrer les abonnements",
    "SAAS_PAYMENTS_VIEW": "Voir les paiements SaaS",
    "SAAS_PAYMENTS_MANAGE": "Administrer les paiements SaaS",
    "PLANS_VIEW": "Voir les plans",
    "PLANS_MANAGE": "Administrer les plans",
    "REPORTS_VIEW": "Voir les rapports NOVEX",
    "SYSTEM_ACTIVITY_VIEW": "Voir l'activite globale",
    "AUDIT_LOGS_VIEW": "Voir les audits",
    "ADMIN_SETTINGS_MANAGE": "Administrer les parametres NOVEX",
}


def ensure_admin_rbac() -> Role:
    role, _created = Role.objects.get_or_create(workspace=None, code=NOVEX_ADMIN_ROLE, defaults={"label": "Admin NOVEX", "is_system": True})
    for code, description in ADMIN_PERMISSIONS.items():
        permission, _created = Permission.objects.get_or_create(code=code, defaults={"description": description})
        RolePermission.objects.get_or_create(role=role, permission=permission)
    ensure_plan_catalog()
    return role


def period_bounds(period: str | None) -> tuple:
    now = timezone.now()
    today = timezone.localdate()
    if period == "today":
        start = timezone.make_aware(datetime.combine(today, time.min))
        return start, now
    if period == "7d":
        return now - timedelta(days=7), now
    if period == "30d":
        return now - timedelta(days=30), now
    if period == "month":
        start = timezone.make_aware(datetime(today.year, today.month, 1))
        return start, now
    if period == "quarter":
        quarter_month = ((today.month - 1) // 3) * 3 + 1
        start = timezone.make_aware(datetime(today.year, quarter_month, 1))
        return start, now
    if period == "year":
        start = timezone.make_aware(datetime(today.year, 1, 1))
        return start, now
    return now - timedelta(days=30), now


def filter_by_period(queryset, period: str | None, field: str = "created_at"):
    start, end = period_bounds(period)
    return queryset.filter(**{f"{field}__gte": start, f"{field}__lte": end})


def saas_payments_queryset():
    return Payment.objects.filter(metadata__payment_type="SUBSCRIPTION").select_related("workspace", "receipt")


def money(value) -> Decimal:
    return value or Decimal("0.00")


def serialize_workspace(workspace: Workspace) -> dict:
    subscription = getattr(workspace, "subscription", None)
    plan = subscription.plan.name if subscription else "Non configure"
    return {
        "id": workspace.id,
        "name": workspace.name,
        "slug": workspace.slug,
        "status": workspace.status,
        "country": workspace.country,
        "currency": workspace.currency,
        "admin": workspace.owner.email,
        "plan": plan,
        "members": getattr(workspace, "members_count", None) or workspace.association_members.count(),
        "created_at": workspace.created_at,
        "last_activity": getattr(workspace, "last_activity", None),
    }


def serialize_user(user) -> dict:
    memberships = list(user.workspace_memberships.select_related("workspace", "role").all()[:5])
    return {
        "id": user.id,
        "name": user.get_full_name() or user.username or user.email,
        "email": user.email,
        "username": user.username,
        "status": "active" if user.is_active else "disabled",
        "is_staff": user.is_staff,
        "joined_at": user.date_joined,
        "last_login": user.last_login,
        "workspaces": [{"name": item.workspace.name, "slug": item.workspace.slug, "role": item.role.label} for item in memberships],
    }


def serialize_subscription(subscription: Subscription) -> dict:
    last_payment = saas_payments_queryset().filter(workspace=subscription.workspace).order_by("-created_at").first()
    return {
        "id": subscription.id,
        "association": subscription.workspace.name,
        "workspace_slug": subscription.workspace.slug,
        "plan": subscription.plan.name,
        "plan_code": subscription.plan.code,
        "status": subscription.status,
        "started_at": subscription.current_period_started_at or subscription.trial_started_at,
        "ends_at": subscription.current_period_ends_at or subscription.trial_ends_at,
        "amount": PLAN_CATALOG.get(subscription.plan.code, {}).get("price", Decimal("0.00")),
        "currency": PLAN_CATALOG.get(subscription.plan.code, {}).get("currency", subscription.workspace.currency),
        "last_payment": last_payment.reference if last_payment else "",
    }


def serialize_payment(payment: Payment) -> dict:
    return {
        "id": payment.id,
        "date": payment.paid_at or payment.created_at,
        "association": payment.workspace.name,
        "workspace_slug": payment.workspace.slug,
        "plan": payment.metadata.get("plan_name", ""),
        "amount": payment.amount,
        "currency": payment.currency,
        "method": payment.payment_method,
        "status": payment.status,
        "reference": payment.reference,
        "provider": payment.provider,
        "provider_reference": payment.provider_transaction_id,
        "invoice": getattr(getattr(payment, "receipt", None), "receipt_number", ""),
    }


def paginate(queryset, serializer, page: int = 1, page_size: int = 25) -> dict:
    page = max(int(page or 1), 1)
    page_size = min(max(int(page_size or 25), 1), 100)
    total = queryset.count()
    start = (page - 1) * page_size
    rows = list(queryset[start : start + page_size])
    return {
        "count": total,
        "page": page,
        "page_size": page_size,
        "next": page + 1 if start + page_size < total else None,
        "previous": page - 1 if page > 1 else None,
        "results": [serializer(row) for row in rows],
    }


def admin_dashboard(period: str | None = "30d") -> dict:
    ensure_admin_rbac()
    period_workspaces = filter_by_period(Workspace.objects.all(), period)
    period_users = filter_by_period(User.objects.all(), period, "date_joined")
    period_start, period_end = period_bounds(period)
    period_subscriptions = Subscription.objects.select_related("plan", "workspace").filter(
        Q(trial_started_at__gte=period_start, trial_started_at__lte=period_end)
        | Q(current_period_started_at__gte=period_start, current_period_started_at__lte=period_end)
    )
    all_saas_payments = saas_payments_queryset()
    period_saas_payments = filter_by_period(all_saas_payments, period)
    paid_payments = period_saas_payments.filter(status=PaymentStatus.SUCCESS)
    revenue_by_plan = list(
        paid_payments.values("metadata__plan_name").annotate(total=Sum("amount"), count=Count("id")).order_by("-total")
    )
    plan_distribution = list(Subscription.objects.values("plan__name").annotate(count=Count("id")).order_by("plan__name"))
    monthly_associations = list(Workspace.objects.annotate(month=TruncMonth("created_at")).values("month").annotate(new=Count("id")).order_by("month"))[-12:]
    monthly_users = list(User.objects.annotate(month=TruncMonth("date_joined")).values("month").annotate(new=Count("id")).order_by("month"))[-12:]
    monthly_revenue = list(all_saas_payments.filter(status=PaymentStatus.SUCCESS).annotate(month=TruncMonth("created_at")).values("month").annotate(total=Sum("amount")).order_by("month"))[-12:]
    expiring_limit = timezone.now() + timedelta(days=14)
    alerts = []
    failed_count = all_saas_payments.filter(status=PaymentStatus.FAILED).count()
    if failed_count:
        alerts.append({"level": "critical", "title": "Paiements SaaS echoues", "description": f"{failed_count} paiement(s) necessitent une verification."})
    expiring_count = Subscription.objects.filter(status=Subscription.Status.ACTIVE, current_period_ends_at__lte=expiring_limit).count()
    if expiring_count:
        alerts.append({"level": "warning", "title": "Abonnements proches expiration", "description": f"{expiring_count} abonnement(s) arrivent a echeance sous 14 jours."})
    return {
        "period": period,
        "kpis": {
            "associations_total": Workspace.objects.count(),
            "associations_active": Workspace.objects.filter(status=Workspace.Status.ACTIVE).count(),
            "users_total": User.objects.count(),
            "subscriptions_active": Subscription.objects.filter(status=Subscription.Status.ACTIVE).count(),
            "revenue_paid": money(paid_payments.aggregate(total=Sum("amount"))["total"]),
            "currency": "XOF",
            "payments_pending": period_saas_payments.filter(status__in=[PaymentStatus.PENDING, PaymentStatus.PROCESSING]).count(),
            "payments_failed": period_saas_payments.filter(status=PaymentStatus.FAILED).count(),
            "new_subscriptions": period_subscriptions.count(),
            "new_associations": period_workspaces.count(),
            "new_users": period_users.count(),
        },
        "charts": {
            "associations_growth": monthly_associations,
            "registrations": monthly_users,
            "revenue": monthly_revenue,
            "plan_distribution": plan_distribution,
            "revenue_by_plan": revenue_by_plan,
        },
        "recent_activity": [
            {
                "id": item.id,
                "action": item.action,
                "resource": item.resource,
                "association": item.workspace.name if item.workspace else "NOVEX",
                "actor": item.actor.email if item.actor else "Systeme",
                "created_at": item.created_at,
            }
            for item in AuditLog.objects.select_related("workspace", "actor").order_by("-created_at")[:12]
        ],
        "recent_associations": [serialize_workspace(workspace) for workspace in Workspace.objects.select_related("owner", "subscription__plan").annotate(members_count=Count("association_members")).order_by("-created_at")[:10]],
        "alerts": alerts,
    }


def admin_associations(params: dict) -> dict:
    queryset = Workspace.objects.select_related("owner", "subscription__plan").annotate(members_count=Count("association_members")).order_by("-created_at")
    if params.get("search"):
        search = params["search"]
        queryset = queryset.filter(Q(name__icontains=search) | Q(slug__icontains=search) | Q(owner__email__icontains=search))
    if params.get("status"):
        queryset = queryset.filter(status=params["status"])
    if params.get("plan"):
        queryset = queryset.filter(subscription__plan__code=params["plan"])
    return paginate(queryset, serialize_workspace, params.get("page", 1), params.get("page_size", 25))


def admin_association_detail(workspace_id: int) -> dict:
    workspace = Workspace.objects.select_related("owner", "subscription__plan").get(id=workspace_id)
    payments = saas_payments_queryset().filter(workspace=workspace)
    return {
        "association": serialize_workspace(workspace),
        "subscription": serialize_subscription(workspace.subscription) if hasattr(workspace, "subscription") else None,
        "usage": {
            "members": Member.objects.filter(workspace=workspace).count(),
            "users": workspace.memberships.count(),
            "payments_saas": payments.count(),
            "revenue_saas": money(payments.filter(status=PaymentStatus.SUCCESS).aggregate(total=Sum("amount"))["total"]),
        },
        "activity": [
            {"id": item.id, "action": item.action, "actor": item.actor.email if item.actor else "Systeme", "created_at": item.created_at}
            for item in AuditLog.objects.filter(workspace=workspace).select_related("actor").order_by("-created_at")[:20]
        ],
    }


def admin_users(params: dict) -> dict:
    queryset = User.objects.order_by("-date_joined")
    if params.get("search"):
        search = params["search"]
        queryset = queryset.filter(Q(email__icontains=search) | Q(username__icontains=search) | Q(first_name__icontains=search) | Q(last_name__icontains=search))
    if params.get("status") == "active":
        queryset = queryset.filter(is_active=True)
    elif params.get("status") == "disabled":
        queryset = queryset.filter(is_active=False)
    return paginate(queryset, serialize_user, params.get("page", 1), params.get("page_size", 25))


def admin_subscriptions(params: dict) -> dict:
    queryset = Subscription.objects.select_related("workspace", "plan").order_by("-current_period_ends_at", "-trial_ends_at")
    if params.get("search"):
        queryset = queryset.filter(workspace__name__icontains=params["search"])
    if params.get("status"):
        queryset = queryset.filter(status=params["status"])
    if params.get("plan"):
        queryset = queryset.filter(plan__code=params["plan"])
    return paginate(queryset, serialize_subscription, params.get("page", 1), params.get("page_size", 25))


def admin_payments(params: dict) -> dict:
    queryset = saas_payments_queryset().order_by("-created_at")
    if params.get("search"):
        search = params["search"]
        queryset = queryset.filter(Q(reference__icontains=search) | Q(provider_transaction_id__icontains=search) | Q(workspace__name__icontains=search))
    if params.get("status"):
        queryset = queryset.filter(status=params["status"])
    if params.get("plan"):
        queryset = queryset.filter(metadata__plan_code=params["plan"])
    if params.get("method"):
        queryset = queryset.filter(payment_method=params["method"])
    return paginate(queryset, serialize_payment, params.get("page", 1), params.get("page_size", 25))


def admin_plans() -> dict:
    ensure_plan_catalog()
    paid_payments = saas_payments_queryset().filter(status=PaymentStatus.SUCCESS)
    rows = []
    for plan in Plan.objects.order_by("id"):
        plan_payments = paid_payments.filter(metadata__plan_code=plan.code)
        rows.append(
            {
                "id": plan.id,
                "code": plan.code,
                "name": plan.name,
                "price": plan.price,
                "currency": plan.currency,
                "billing_period": plan.billing_period,
                "is_active": plan.is_active,
                "entitlements": plan.entitlements,
                "subscriptions": Subscription.objects.filter(plan=plan).count(),
                "revenue": money(plan_payments.aggregate(total=Sum("amount"))["total"]),
            }
        )
    return {"results": rows}


def admin_activity(params: dict) -> dict:
    queryset = AuditLog.objects.select_related("workspace", "actor").order_by("-created_at")
    if params.get("search"):
        search = params["search"]
        queryset = queryset.filter(Q(action__icontains=search) | Q(resource__icontains=search) | Q(workspace__name__icontains=search) | Q(actor__email__icontains=search))
    return paginate(
        queryset,
        lambda item: {
            "id": item.id,
            "actor": item.actor.email if item.actor else "Systeme",
            "action": item.action,
            "resource": item.resource,
            "resource_id": item.resource_id,
            "association": item.workspace.name if item.workspace else "NOVEX",
            "ip_address": item.ip_address,
            "metadata": item.metadata,
            "created_at": item.created_at,
        },
        params.get("page", 1),
        params.get("page_size", 25),
    )


def admin_reports(period: str | None = "30d") -> dict:
    dashboard = admin_dashboard(period)
    return {
        "period": period,
        "associations": {
            "total": dashboard["kpis"]["associations_total"],
            "new": dashboard["kpis"]["new_associations"],
            "active": dashboard["kpis"]["associations_active"],
        },
        "users": {"total": dashboard["kpis"]["users_total"], "new": dashboard["kpis"]["new_users"]},
        "subscriptions": {"active": dashboard["kpis"]["subscriptions_active"], "new": dashboard["kpis"]["new_subscriptions"], "plans": dashboard["charts"]["plan_distribution"]},
        "payments": {
            "paid_revenue": dashboard["kpis"]["revenue_paid"],
            "pending": dashboard["kpis"]["payments_pending"],
            "failed": dashboard["kpis"]["payments_failed"],
            "revenue_by_plan": dashboard["charts"]["revenue_by_plan"],
        },
    }
