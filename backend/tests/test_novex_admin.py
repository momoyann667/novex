from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.audit_logs.models import AuditLog
from apps.novex_admin.services import (
    ADMIN_PERMISSIONS,
    admin_dashboard,
    create_admin_plan,
    create_admin_user,
    delete_admin_plan,
    delete_admin_user,
    ensure_admin_rbac,
    update_admin_plan,
    update_admin_user,
    update_association_status,
)
from apps.payments.models import Payment
from apps.payments.statuses import PaymentMethod, PaymentStatus
from apps.subscriptions.models import Plan, Subscription
from apps.subscriptions.services import ensure_plan_catalog
from apps.workspaces.models import Permission, Role, Workspace
from apps.workspaces.services import create_workspace_for_owner


User = get_user_model()


@pytest.fixture
def admin_user():
    return User.objects.create_superuser(username="admin", email="admin@novex.local", password="1234567890")


@pytest.fixture
def normal_user():
    return User.objects.create_user(username="member", email="member@example.com", password="NovexPass123")


@pytest.fixture
def workspace(normal_user):
    return create_workspace_for_owner(owner=normal_user, name="Association Test", organization_type=Workspace.OrganizationType.ASSOCIATION)


@pytest.mark.django_db
def test_admin_rbac_catalog_is_created():
    role = ensure_admin_rbac()

    assert role.workspace is None
    assert role.code == "NOVEX_ADMIN"
    assert Permission.objects.filter(code__in=ADMIN_PERMISSIONS).count() == len(ADMIN_PERMISSIONS)


@pytest.mark.django_db
def test_normal_user_cannot_access_admin_dashboard(normal_user):
    api_client = APIClient()
    api_client.force_authenticate(normal_user)

    response = api_client.get("/api/v1/admin/dashboard/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_novex_admin_can_access_dashboard(admin_user, workspace):
    api_client = APIClient()
    api_client.force_authenticate(admin_user)

    response = api_client.get("/api/v1/admin/dashboard/")

    assert response.status_code == 200
    assert response.data["kpis"]["associations_total"] == 1
    assert response.data["kpis"]["users_total"] == 2


@pytest.mark.django_db
def test_admin_revenue_uses_only_confirmed_saas_payments(admin_user, workspace):
    ensure_plan_catalog()
    plan = Plan.objects.get(code=Plan.Code.NOVEX_PRO)
    workspace.subscription.plan = plan
    workspace.subscription.status = "active"
    workspace.subscription.save()
    Payment.objects.create(
        workspace=workspace,
        reference="SUB-PAY-2026-PAID",
        amount=Decimal("15000.00"),
        net_amount=Decimal("15000.00"),
        currency="XOF",
        provider="manual",
        idempotency_key="paid",
        status=PaymentStatus.SUCCESS,
        payment_method=PaymentMethod.AGGREGATOR,
        metadata={"payment_type": "SUBSCRIPTION", "plan_code": plan.code, "plan_name": plan.name},
    )
    Payment.objects.create(
        workspace=workspace,
        reference="SUB-PAY-2026-PENDING",
        amount=Decimal("15000.00"),
        net_amount=Decimal("15000.00"),
        currency="XOF",
        provider="manual",
        idempotency_key="pending",
        status=PaymentStatus.PENDING,
        payment_method=PaymentMethod.AGGREGATOR,
        metadata={"payment_type": "SUBSCRIPTION", "plan_code": plan.code, "plan_name": plan.name},
    )
    Payment.objects.create(
        workspace=workspace,
        reference="NVX-2026-CONTRIB",
        amount=Decimal("90000.00"),
        net_amount=Decimal("90000.00"),
        currency="XOF",
        provider="manual",
        idempotency_key="contribution",
        status=PaymentStatus.SUCCESS,
        payment_method=PaymentMethod.MANUAL,
        metadata={"payment_type": "CONTRIBUTION"},
    )
    api_client = APIClient()
    api_client.force_authenticate(admin_user)

    response = api_client.get("/api/v1/admin/dashboard/?period=year")

    assert response.status_code == 200
    assert Decimal(str(response.data["kpis"]["revenue_paid"])) == Decimal("15000.00")
    assert response.data["kpis"]["payments_pending"] == 1


@pytest.mark.django_db
def test_admin_dashboard_calculates_mrr_arr_and_conversion(admin_user, workspace):
    ensure_plan_catalog()
    start = Plan.objects.get(code=Plan.Code.NOVEX_START)
    workspace.subscription.plan = start
    workspace.subscription.status = Subscription.Status.ACTIVE
    workspace.subscription.save(update_fields=["plan", "status"])

    dashboard = admin_dashboard("year")

    assert Decimal(str(dashboard["kpis"]["mrr"])) == Decimal("5000.00")
    assert Decimal(str(dashboard["kpis"]["arr"])) == Decimal("60000.00")
    assert Decimal(str(dashboard["kpis"]["conversion_rate"])) == Decimal("100.00")
    assert dashboard["kpis"]["subscriptions_start"] == 1


@pytest.mark.django_db
def test_admin_can_suspend_and_activate_association_with_audit(admin_user, workspace):
    suspended = update_association_status(workspace_id=workspace.id, actor=admin_user, status=Workspace.Status.SUSPENDED, reason="Test support")
    workspace.refresh_from_db()

    assert workspace.status == Workspace.Status.SUSPENDED
    assert suspended["association"]["status"] == Workspace.Status.SUSPENDED
    assert AuditLog.objects.filter(workspace=workspace, action="admin.association_suspended", metadata__reason="Test support").exists()

    activated = update_association_status(workspace_id=workspace.id, actor=admin_user, status=Workspace.Status.ACTIVE, reason="Retour conforme")
    workspace.refresh_from_db()

    assert workspace.status == Workspace.Status.ACTIVE
    assert activated["association"]["status"] == Workspace.Status.ACTIVE
    assert AuditLog.objects.filter(workspace=workspace, action="admin.association_activated", metadata__reason="Retour conforme").exists()


@pytest.mark.django_db
def test_admin_can_create_update_and_delete_backoffice_user(admin_user):
    created = create_admin_user(
        actor=admin_user,
        data={"first_name": "Support", "last_name": "NOVEX", "email": "support@novex.local", "phone": "+2250000", "password": "Secret123456", "is_staff": True},
    )
    user = User.objects.get(id=created["id"])

    updated = update_admin_user(actor=admin_user, user_id=user.id, data={"first_name": "Finance", "email": "finance@novex.local", "phone": "+2251111"})

    assert created["source"] == "admin"
    assert created["can_manage"] is True
    assert updated["name"] == "Finance NOVEX"
    assert updated["email"] == "finance@novex.local"

    delete_admin_user(actor=admin_user, user_id=user.id)

    assert User.objects.filter(id=user.id).exists() is False
    assert AuditLog.objects.filter(action="admin.user_deleted", metadata__email="finance@novex.local").exists()


@pytest.mark.django_db
def test_admin_cannot_update_or_delete_application_user(admin_user, workspace, normal_user):
    listed = User.objects.get(id=normal_user.id)

    with pytest.raises(ValueError, match="application mobile"):
        update_admin_user(actor=admin_user, user_id=listed.id, data={"first_name": "Bloque"})

    with pytest.raises(ValueError, match="application mobile"):
        delete_admin_user(actor=admin_user, user_id=listed.id)

    assert User.objects.filter(id=listed.id).exists() is True


@pytest.mark.django_db
def test_admin_can_create_update_and_delete_plan(admin_user):
    created = create_admin_plan(
        actor=admin_user,
        data={
            "code": "novex_premium",
            "name": "NOVEX Premium",
            "price": "25000",
            "currency": "XOF",
            "billing_period": "month",
            "is_active": True,
            "entitlements": {"ONLINE_PAYMENT": True, "ADVANCED_REPORTS": True},
        },
    )
    plan = Plan.objects.get(id=created["id"])

    updated = update_admin_plan(actor=admin_user, plan_id=plan.id, data={"name": "NOVEX Premium Plus", "price": "30000,50", "currency": "FCFA", "is_active": False})

    assert created["code"] == "NOVEX_PREMIUM"
    assert updated["name"] == "NOVEX Premium Plus"
    assert Decimal(str(updated["price"])) == Decimal("30000.50")
    assert updated["currency"] == "XOF"
    assert updated["is_active"] is False
    assert AuditLog.objects.filter(action="admin.plan_updated", resource_id=str(plan.id)).exists()

    delete_admin_plan(actor=admin_user, plan_id=plan.id)

    assert Plan.objects.filter(id=plan.id).exists() is False
    assert AuditLog.objects.filter(action="admin.plan_deleted", metadata__code="NOVEX_PREMIUM").exists()


@pytest.mark.django_db
def test_admin_cannot_delete_plan_used_by_subscription(admin_user, workspace):
    ensure_plan_catalog()
    plan = Plan.objects.get(code=Plan.Code.NOVEX_START)
    workspace.subscription.plan = plan
    workspace.subscription.save(update_fields=["plan"])

    with pytest.raises(ValueError, match="deja utilise"):
        delete_admin_plan(actor=admin_user, plan_id=plan.id)

    assert Plan.objects.filter(id=plan.id).exists() is True


@pytest.mark.django_db
def test_admin_plan_endpoints_support_crud(admin_user):
    api_client = APIClient()
    api_client.force_authenticate(admin_user)

    create_response = api_client.post(
        "/api/v1/admin/plans/",
        {"code": "NOVEX_PLUS", "name": "NOVEX Plus", "price": "18000", "currency": "XOF", "billing_period": "month", "is_active": True, "entitlements": {"SUPPORT": True}},
        format="json",
    )

    assert create_response.status_code == 201
    plan_id = create_response.data["id"]

    update_response = api_client.patch(
        f"/api/v1/admin/plans/{plan_id}/",
        {"code": "NOVEX_PLUS", "name": "NOVEX Plus Ajuste", "price": "19000", "currency": "XOF", "billing_period": "month", "is_active": True, "entitlements": {"SUPPORT": True, "EXPORTS": True}},
        format="json",
    )

    assert update_response.status_code == 200
    assert update_response.data["name"] == "NOVEX Plus Ajuste"
    assert update_response.data["entitlements"]["EXPORTS"] is True

    delete_response = api_client.delete(f"/api/v1/admin/plans/{plan_id}/")

    assert delete_response.status_code == 204


@pytest.mark.django_db
def test_create_novex_admin_command_is_idempotent_and_hashes_password(settings):
    settings.DEBUG = True

    call_command("create_novex_admin")
    call_command("create_novex_admin")

    user = User.objects.get(username="admin")
    assert User.objects.filter(username="admin").count() == 1
    assert user.is_staff is True
    assert user.is_superuser is True
    assert user.password != "1234567890"
    assert user.check_password("1234567890")
    assert Role.objects.filter(workspace=None, code="NOVEX_ADMIN").exists()
