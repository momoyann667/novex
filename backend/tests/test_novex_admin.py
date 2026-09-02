from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.novex_admin.services import ADMIN_PERMISSIONS, ensure_admin_rbac
from apps.payments.models import Payment
from apps.payments.statuses import PaymentMethod, PaymentStatus
from apps.subscriptions.models import Plan
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
