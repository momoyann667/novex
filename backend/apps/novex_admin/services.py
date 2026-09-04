from datetime import datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.members.models import Member
from apps.payments.models import Payment
from apps.payments.statuses import PaymentStatus
from apps.subscriptions.models import Plan, Subscription
from apps.subscriptions.services import PLAN_CATALOG, ensure_plan_catalog
from apps.users.models import Profile
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
    if period == "previous_month":
        first_day = today.replace(day=1)
        previous_end = first_day - timedelta(days=1)
        previous_start = previous_end.replace(day=1)
        return timezone.make_aware(datetime.combine(previous_start, time.min)), timezone.make_aware(datetime.combine(previous_end, time.max))
    if period == "quarter":
        quarter_month = ((today.month - 1) // 3) * 3 + 1
        start = timezone.make_aware(datetime(today.year, quarter_month, 1))
        return start, now
    if period == "year":
        start = timezone.make_aware(datetime(today.year, 1, 1))
        return start, now
    if period == "previous_year":
        start = timezone.make_aware(datetime(today.year - 1, 1, 1))
        end = timezone.make_aware(datetime(today.year - 1, 12, 31, 23, 59, 59))
        return start, end
    return now - timedelta(days=30), now


def previous_period_bounds(period: str | None) -> tuple:
    start, end = period_bounds(period)
    duration = end - start
    previous_end = start
    previous_start = start - duration
    return previous_start, previous_end


def filter_by_period(queryset, period: str | None, field: str = "created_at"):
    start, end = period_bounds(period)
    return queryset.filter(**{f"{field}__gte": start, f"{field}__lte": end})


def saas_payments_queryset():
    return Payment.objects.filter(metadata__payment_type="SUBSCRIPTION").select_related("workspace", "receipt")


def money(value) -> Decimal:
    return value or Decimal("0.00")


def paid_plan_subscriptions():
    return Subscription.objects.select_related("plan", "workspace").filter(plan__code__in=[Plan.Code.NOVEX_START, Plan.Code.NOVEX_PRO])


def calculate_mrr() -> Decimal:
    """MRR = somme des prix mensuels des abonnements payants actifs, hors Freemium et hors paiements non confirmes."""
    ensure_plan_catalog()
    subscriptions = paid_plan_subscriptions().filter(status=Subscription.Status.ACTIVE)
    return sum((subscription.plan.price for subscription in subscriptions), Decimal("0.00"))


def calculate_arr(mrr: Decimal) -> Decimal:
    """ARR = MRR annualise sur 12 mois."""
    return mrr * Decimal("12")


def calculate_churn(period: str | None) -> dict:
    """Churn payant = abonnements payants perdus sur la periode / base payante estimable au debut."""
    start, end = period_bounds(period)
    lost = paid_plan_subscriptions().filter(Q(cancelled_at__gte=start, cancelled_at__lte=end) | Q(status=Subscription.Status.EXPIRED, current_period_ends_at__gte=start, current_period_ends_at__lte=end)).count()
    current_active = paid_plan_subscriptions().filter(status=Subscription.Status.ACTIVE).count()
    denominator = current_active + lost
    rate = Decimal(lost * 100) / Decimal(denominator) if denominator else Decimal("0.00")
    return {"lost": lost, "base": denominator, "rate": round(rate, 2)}


def calculate_conversion() -> dict:
    trials_started = Subscription.objects.filter(trial_started_at__isnull=False).count()
    start = Subscription.objects.filter(plan__code=Plan.Code.NOVEX_START).count()
    pro = Subscription.objects.filter(plan__code=Plan.Code.NOVEX_PRO).count()
    paid = start + pro
    divisor = Decimal(trials_started or 1)
    return {
        "trials_started": trials_started,
        "paid": paid,
        "start": start,
        "pro": pro,
        "rate": round((Decimal(paid) / divisor) * Decimal("100"), 2),
        "start_rate": round((Decimal(start) / divisor) * Decimal("100"), 2),
        "pro_rate": round((Decimal(pro) / divisor) * Decimal("100"), 2),
    }


def growth_rate(current_count: int, previous_count: int) -> Decimal:
    if previous_count <= 0:
        return Decimal("100.00") if current_count else Decimal("0.00")
    return round((Decimal(current_count - previous_count) / Decimal(previous_count)) * Decimal("100"), 2)


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
    is_application_user = bool(memberships) or user.owned_workspaces.exists()
    profile = getattr(user, "profile", None)
    return {
        "id": user.id,
        "name": str(profile) if profile and str(profile) else user.get_full_name() or user.username or user.email,
        "first_name": profile.first_name if profile else user.first_name,
        "last_name": profile.last_name if profile else user.last_name,
        "email": user.email,
        "username": user.username,
        "phone": user.phone,
        "status": "active" if user.is_active else "disabled",
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "source": "application" if is_application_user else "admin",
        "can_manage": not is_application_user,
        "joined_at": user.date_joined,
        "last_login": user.last_login,
        "workspaces": [{"name": item.workspace.name, "slug": item.workspace.slug, "role": item.role.label} for item in memberships],
    }


def normalize_user_payload(data: dict) -> dict:
    email = (data.get("email") or "").strip().lower()
    first_name = (data.get("first_name") or data.get("firstName") or "").strip()
    last_name = (data.get("last_name") or data.get("lastName") or "").strip()
    phone = (data.get("phone") or "").strip()
    username = (data.get("username") or email).strip() or email
    return {"email": email, "username": username, "first_name": first_name, "last_name": last_name, "phone": phone}


def ensure_admin_manageable_user(user) -> None:
    if user.workspace_memberships.exists() or user.owned_workspaces.exists():
        raise ValueError("Cet utilisateur vient de l'application mobile et ne peut pas etre modifie ou supprime depuis l'admin.")


@transaction.atomic
def create_admin_user(*, actor, data: dict) -> dict:
    payload = normalize_user_payload(data)
    password = data.get("password") or ""
    if not payload["email"]:
        raise ValueError("Email obligatoire.")
    if not password:
        raise ValueError("Mot de passe obligatoire.")
    if User.objects.filter(email=payload["email"]).exists():
        raise ValueError("Un utilisateur existe deja avec cet email.")
    user = User.objects.create_user(
        username=payload["username"],
        email=payload["email"],
        password=password,
        first_name=payload["first_name"],
        last_name=payload["last_name"],
        phone=payload["phone"],
        is_staff=bool(data.get("is_staff", False)),
        is_superuser=bool(data.get("is_superuser", False)),
    )
    if payload["first_name"] or payload["last_name"]:
        Profile.objects.get_or_create(user=user, defaults={"first_name": payload["first_name"], "last_name": payload["last_name"]})
    AuditLog.objects.create(actor=actor, action="admin.user_created", resource="user", resource_id=str(user.id), metadata={"email": user.email})
    return serialize_user(user)


@transaction.atomic
def update_admin_user(*, actor, user_id: int, data: dict) -> dict:
    user = User.objects.select_for_update().get(id=user_id)
    ensure_admin_manageable_user(user)
    payload = normalize_user_payload(data)
    if payload["email"] and User.objects.exclude(id=user.id).filter(email=payload["email"]).exists():
        raise ValueError("Un utilisateur existe deja avec cet email.")
    for field in ["email", "username", "first_name", "last_name", "phone"]:
        if payload[field]:
            setattr(user, field, payload[field])
    if "is_active" in data:
        user.is_active = bool(data["is_active"])
    if "is_staff" in data:
        user.is_staff = bool(data["is_staff"])
    if "is_superuser" in data:
        user.is_superuser = bool(data["is_superuser"])
    if data.get("password"):
        user.set_password(data["password"])
    user.save()
    if payload["first_name"] or payload["last_name"]:
        profile, _created = Profile.objects.get_or_create(user=user, defaults={"first_name": payload["first_name"], "last_name": payload["last_name"]})
        profile.first_name = payload["first_name"] or profile.first_name
        profile.last_name = payload["last_name"] or profile.last_name
        profile.save()
    AuditLog.objects.create(actor=actor, action="admin.user_updated", resource="user", resource_id=str(user.id), metadata={"email": user.email})
    return serialize_user(user)


@transaction.atomic
def delete_admin_user(*, actor, user_id: int) -> None:
    user = User.objects.select_for_update().get(id=user_id)
    ensure_admin_manageable_user(user)
    if user.id == actor.id:
        raise ValueError("Vous ne pouvez pas supprimer votre propre compte admin.")
    if user.is_superuser and User.objects.filter(is_superuser=True, is_active=True).exclude(id=user.id).count() == 0:
        raise ValueError("Impossible de supprimer le dernier super-admin actif.")
    email = user.email
    AuditLog.objects.create(actor=actor, action="admin.user_deleted", resource="user", resource_id=str(user.id), metadata={"email": email})
    user.delete()


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
    previous_start, previous_end = previous_period_bounds(period)
    previous_workspaces = Workspace.objects.filter(created_at__gte=previous_start, created_at__lte=previous_end)
    previous_users = User.objects.filter(date_joined__gte=previous_start, date_joined__lte=previous_end)
    period_subscriptions = Subscription.objects.select_related("plan", "workspace").filter(
        Q(trial_started_at__gte=period_start, trial_started_at__lte=period_end)
        | Q(current_period_started_at__gte=period_start, current_period_started_at__lte=period_end)
    )
    previous_subscriptions = Subscription.objects.select_related("plan", "workspace").filter(
        Q(trial_started_at__gte=previous_start, trial_started_at__lte=previous_end)
        | Q(current_period_started_at__gte=previous_start, current_period_started_at__lte=previous_end)
    )
    all_saas_payments = saas_payments_queryset()
    period_saas_payments = filter_by_period(all_saas_payments, period)
    previous_saas_payments = all_saas_payments.filter(created_at__gte=previous_start, created_at__lte=previous_end)
    paid_payments = period_saas_payments.filter(status=PaymentStatus.SUCCESS)
    previous_paid_revenue = money(previous_saas_payments.filter(status=PaymentStatus.SUCCESS).aggregate(total=Sum("amount"))["total"])
    revenue_by_plan = list(
        paid_payments.values("metadata__plan_name").annotate(total=Sum("amount"), count=Count("id")).order_by("-total")
    )
    plan_distribution = list(Subscription.objects.values("plan__name", "plan__code").annotate(count=Count("id")).order_by("plan__name"))
    status_distribution = list(Subscription.objects.values("status").annotate(count=Count("id")).order_by("status"))
    monthly_associations = list(Workspace.objects.annotate(month=TruncMonth("created_at")).values("month").annotate(new=Count("id")).order_by("month"))[-12:]
    monthly_users = list(User.objects.annotate(month=TruncMonth("date_joined")).values("month").annotate(new=Count("id")).order_by("month"))[-12:]
    monthly_revenue = list(all_saas_payments.filter(status=PaymentStatus.SUCCESS).annotate(month=TruncMonth("created_at")).values("month").annotate(total=Sum("amount")).order_by("month"))[-12:]
    mrr = calculate_mrr()
    arr = calculate_arr(mrr)
    churn = calculate_churn(period)
    conversion = calculate_conversion()
    revenue_paid = money(paid_payments.aggregate(total=Sum("amount"))["total"])
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
        "period_bounds": {"start": period_start, "end": period_end, "previous_start": previous_start, "previous_end": previous_end},
        "kpis": {
            "associations_total": Workspace.objects.count(),
            "associations_active": Workspace.objects.filter(status=Workspace.Status.ACTIVE).count(),
            "associations_suspended": Workspace.objects.filter(status=Workspace.Status.SUSPENDED).count(),
            "associations_archived": Workspace.objects.filter(status=Workspace.Status.ARCHIVED).count(),
            "users_total": User.objects.count(),
            "users_active": User.objects.filter(is_active=True).count(),
            "users_inactive": User.objects.filter(is_active=False).count(),
            "users_staff": User.objects.filter(is_staff=True).count(),
            "subscriptions_active": Subscription.objects.filter(status=Subscription.Status.ACTIVE).count(),
            "subscriptions_trial": Subscription.objects.filter(status=Subscription.Status.TRIAL).count(),
            "subscriptions_expired": Subscription.objects.filter(status=Subscription.Status.EXPIRED).count(),
            "subscriptions_cancelled": Subscription.objects.filter(status=Subscription.Status.CANCELLED).count(),
            "subscriptions_past_due": Subscription.objects.filter(status=Subscription.Status.PAST_DUE).count(),
            "subscriptions_start": Subscription.objects.filter(plan__code=Plan.Code.NOVEX_START).count(),
            "subscriptions_pro": Subscription.objects.filter(plan__code=Plan.Code.NOVEX_PRO).count(),
            "subscriptions_freemium": Subscription.objects.filter(plan__code=Plan.Code.FREEMIUM).count(),
            "revenue_paid": revenue_paid,
            "revenue_previous": previous_paid_revenue,
            "revenue_growth": growth_rate(int(revenue_paid), int(previous_paid_revenue)),
            "mrr": mrr,
            "arr": arr,
            "churn_rate": churn["rate"],
            "churn_lost": churn["lost"],
            "conversion_rate": conversion["rate"],
            "conversion_start_rate": conversion["start_rate"],
            "conversion_pro_rate": conversion["pro_rate"],
            "currency": "XOF",
            "payments_pending": period_saas_payments.filter(status__in=[PaymentStatus.PENDING, PaymentStatus.PROCESSING]).count(),
            "payments_failed": period_saas_payments.filter(status=PaymentStatus.FAILED).count(),
            "new_subscriptions": period_subscriptions.count(),
            "new_associations": period_workspaces.count(),
            "new_users": period_users.count(),
            "associations_growth": growth_rate(period_workspaces.count(), previous_workspaces.count()),
            "users_growth": growth_rate(period_users.count(), previous_users.count()),
            "subscriptions_growth": growth_rate(period_subscriptions.count(), previous_subscriptions.count()),
        },
        "charts": {
            "associations_growth": monthly_associations,
            "registrations": monthly_users,
            "revenue": monthly_revenue,
            "plan_distribution": plan_distribution,
            "status_distribution": status_distribution,
            "revenue_by_plan": revenue_by_plan,
            "mrr": [{"month": row["month"], "total": row["total"]} for row in monthly_revenue],
            "arr": [{"month": row["month"], "total": money(row["total"]) * Decimal("12")} for row in monthly_revenue],
            "conversion": conversion,
            "churn": churn,
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


@transaction.atomic
def update_association_status(*, workspace_id: int, actor, status: str, reason: str = "") -> dict:
    if status not in {Workspace.Status.ACTIVE, Workspace.Status.SUSPENDED}:
        raise ValueError("Statut association invalide.")
    workspace = Workspace.objects.select_for_update().get(id=workspace_id)
    previous_status = workspace.status
    workspace.status = status
    workspace.save(update_fields=["status", "updated_at"])
    AuditLog.objects.create(
        workspace=workspace,
        actor=actor,
        action="admin.association_activated" if status == Workspace.Status.ACTIVE else "admin.association_suspended",
        resource="workspace",
        resource_id=str(workspace.id),
        metadata={"previous_status": previous_status, "new_status": status, "reason": reason},
    )
    return admin_association_detail(workspace.id)


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
            "mrr": dashboard["kpis"]["mrr"],
            "arr": dashboard["kpis"]["arr"],
            "churn_rate": dashboard["kpis"]["churn_rate"],
            "conversion_rate": dashboard["kpis"]["conversion_rate"],
            "pending": dashboard["kpis"]["payments_pending"],
            "failed": dashboard["kpis"]["payments_failed"],
            "revenue_by_plan": dashboard["charts"]["revenue_by_plan"],
        },
    }
