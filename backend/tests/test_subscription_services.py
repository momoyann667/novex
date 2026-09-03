from decimal import Decimal
import hashlib
import hmac
import json

import pytest

pytest.importorskip("pytest_django")

from apps.contributions.models import Contribution
from apps.contributions.services import create_campaign
from apps.members.models import Member
from apps.payments.models import Payment, Receipt
from apps.payments.services import apply_successful_payment, initialize_contribution_payment, process_payment_webhook
from apps.payments.statuses import PaymentMethod
from apps.subscriptions.models import Plan, Subscription
from apps.subscriptions.services import check_subscription_quota, create_subscription_checkout, ensure_plan_catalog, ensure_workspace_subscription, subscription_overview, workspace_has_entitlement
from apps.workspaces.models import Role, Workspace, WorkspaceMembership
from apps.workspaces.services import create_workspace_for_owner


@pytest.mark.django_db
def test_freemium_subscription_has_14_day_trial(django_user_model):
    owner = django_user_model.objects.create_user(username="trial@example.com", email="trial@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Trial", slug="association-trial", organization_type="association", owner=owner)

    subscription = ensure_workspace_subscription(workspace)
    overview = subscription_overview(workspace=workspace)

    assert subscription.plan.code == Plan.Code.FREEMIUM
    assert subscription.status == Subscription.Status.TRIAL
    assert (subscription.trial_ends_at - subscription.trial_started_at).days == 14
    assert overview["subscription"]["days_remaining"] in {13, 14}


@pytest.mark.django_db
def test_entitlement_matrix_allows_online_contribution_payment_only_on_pro(django_user_model):
    owner = django_user_model.objects.create_user(username="plans@example.com", email="plans@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Plans", slug="association-plans", organization_type="association", owner=owner)
    ensure_plan_catalog()

    start = Plan.objects.get(code=Plan.Code.NOVEX_START)
    pro = Plan.objects.get(code=Plan.Code.NOVEX_PRO)
    Subscription.objects.create(workspace=workspace, plan=start, status=Subscription.Status.ACTIVE)

    assert workspace_has_entitlement(workspace, "ONLINE_CONTRIBUTION_PAYMENT") is False

    workspace.subscription.plan = pro
    workspace.subscription.save(update_fields=["plan"])

    assert workspace_has_entitlement(workspace, "ONLINE_CONTRIBUTION_PAYMENT") is True


@pytest.mark.django_db
def test_official_plan_prices_and_quotas_are_persisted():
    ensure_plan_catalog()

    freemium = Plan.objects.get(code=Plan.Code.FREEMIUM)
    start = Plan.objects.get(code=Plan.Code.NOVEX_START)
    pro = Plan.objects.get(code=Plan.Code.NOVEX_PRO)

    assert freemium.price == Decimal("0.00")
    assert start.price == Decimal("5000.00")
    assert pro.price == Decimal("10000.00")
    assert start.currency == "XOF"
    assert pro.billing_period == "month"
    assert start.entitlements["ONLINE_CONTRIBUTION_PAYMENT"] is False
    assert pro.entitlements["ONLINE_CONTRIBUTION_PAYMENT"] is True
    assert "MAX_MEMBERS" in freemium.limits


@pytest.mark.django_db
def test_online_contribution_payment_is_rejected_without_pro(django_user_model):
    owner = django_user_model.objects.create_user(username="blocked@example.com", email="blocked@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Blocked", slug="association-blocked", organization_type="association", owner=owner)
    member = Member.objects.create(workspace=workspace, membership_number="A-000090", first_name="Awa", last_name="Kone")
    campaign = create_campaign(workspace=workspace, actor=owner, name="Cotisation", amount=Decimal("5000.00"))
    contribution = Contribution.objects.create(workspace=workspace, campaign=campaign, member=member, amount_due=Decimal("5000.00"))

    ensure_workspace_subscription(workspace)

    with pytest.raises(ValueError, match="NOVEX Pro"):
        initialize_contribution_payment(
            workspace=workspace,
            actor=owner,
            contribution=contribution,
            amount=Decimal("1000.00"),
            payment_method=PaymentMethod.MOBILE_MONEY,
            idempotency_key="blocked-online",
        )


@pytest.mark.django_db
def test_subscription_checkout_does_not_activate_before_provider_confirmation(django_user_model):
    owner = django_user_model.objects.create_user(username="checkout@example.com", email="checkout@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Checkout", slug="association-checkout", organization_type="association", owner=owner)
    ensure_workspace_subscription(workspace)

    payload = create_subscription_checkout(workspace=workspace, actor=owner, plan_code=Plan.Code.NOVEX_PRO)
    workspace.subscription.refresh_from_db()

    assert payload["status"] in {"PENDING", "PROCESSING"}
    assert payload["payment"]["reference"].startswith("SUB-PAY-")
    assert payload["online_available"] is False
    assert workspace.subscription.plan.code == Plan.Code.FREEMIUM


@pytest.mark.django_db
def test_subscription_checkout_reuses_pending_payment(django_user_model):
    owner = django_user_model.objects.create_user(username="checkout-reuse@example.com", email="checkout-reuse@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Checkout Reuse", slug="association-checkout-reuse", organization_type="association", owner=owner)
    ensure_workspace_subscription(workspace)

    first = create_subscription_checkout(workspace=workspace, actor=owner, plan_code=Plan.Code.NOVEX_START)
    second = create_subscription_checkout(workspace=workspace, actor=owner, plan_code=Plan.Code.NOVEX_START)

    assert first["payment"]["id"] == second["payment"]["id"]
    assert Payment.objects.filter(workspace=workspace, metadata__payment_type="SUBSCRIPTION", metadata__plan_code=Plan.Code.NOVEX_START).count() == 1


@pytest.mark.django_db
def test_confirmed_subscription_payment_activates_plan_and_invoice(django_user_model):
    owner = django_user_model.objects.create_user(username="confirm-sub@example.com", email="confirm-sub@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Confirm", slug="association-confirm", organization_type="association", owner=owner)
    ensure_workspace_subscription(workspace)
    payload = create_subscription_checkout(workspace=workspace, actor=owner, plan_code=Plan.Code.NOVEX_PRO)
    payment_id = payload["payment"]["id"]

    payment = apply_successful_payment(payment=Payment.objects.get(id=payment_id), actor=owner)
    workspace.subscription.refresh_from_db()
    receipt = Receipt.objects.get(payment=payment)

    assert workspace.subscription.plan.code == Plan.Code.NOVEX_PRO
    assert workspace.subscription.status == Subscription.Status.ACTIVE
    assert receipt.receipt_number.startswith("INV-")


@pytest.mark.django_db
def test_subscription_webhook_is_idempotent(monkeypatch, django_user_model):
    monkeypatch.setenv("NOVEX_PAYMENT_WEBHOOK_SECRET", "subscription-secret")
    owner = django_user_model.objects.create_user(username="sub-webhook@example.com", email="sub-webhook@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Sub Webhook", slug="association-sub-webhook", organization_type="association", owner=owner)
    ensure_workspace_subscription(workspace)
    payload = create_subscription_checkout(workspace=workspace, actor=owner, plan_code=Plan.Code.NOVEX_PRO)
    payment = Payment.objects.get(id=payload["payment"]["id"])
    webhook_payload = {
        "reference": payment.reference,
        "provider_transaction_id": payment.provider_transaction_id,
        "status": "success",
        "amount": "10000.00",
        "currency": "XOF",
    }
    body = json.dumps(webhook_payload, sort_keys=True, separators=(",", ":")).encode()
    signature = hmac.new(b"subscription-secret", body, hashlib.sha256).hexdigest()

    event, confirmed_payment, processed = process_payment_webhook(provider_code="env_hmac", event_id="evt-sub-001", payload=webhook_payload, signature=signature)
    duplicate_event, duplicate_payment, duplicate_processed = process_payment_webhook(provider_code="env_hmac", event_id="evt-sub-001", payload=webhook_payload, signature=signature)
    workspace.subscription.refresh_from_db()

    assert event.signature_valid is True
    assert processed is True
    assert confirmed_payment.status == Payment.Status.SUCCESS
    assert workspace.subscription.plan.code == Plan.Code.NOVEX_PRO
    assert duplicate_event.id == event.id
    assert duplicate_payment is None
    assert duplicate_processed is False
    assert Receipt.objects.filter(payment=payment).count() == 1


@pytest.mark.django_db
def test_quota_detects_member_limit(django_user_model):
    owner = django_user_model.objects.create_user(username="quota@example.com", email="quota@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Quota", slug="association-quota", organization_type="association", owner=owner)
    ensure_workspace_subscription(workspace)

    with pytest.raises(ValueError, match="limite de votre forfait"):
        check_subscription_quota(workspace, "MAX_MEMBERS", current_usage=25)


@pytest.mark.django_db
def test_owner_can_start_subscription_checkout_through_api(django_user_model):
    owner = django_user_model.objects.create_user(username="owner-sub@example.com", email="owner-sub@example.com", password="pass")
    workspace = create_workspace_for_owner(owner=owner, name="Owner Subscription", organization_type="association")
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(owner)
    response = client.post("/api/v1/subscriptions/checkout/", {"plan": Plan.Code.NOVEX_START}, format="json", HTTP_X_WORKSPACE=workspace.slug)

    assert response.status_code == 201
    assert response.data["plan"]["price"] == Decimal("5000.00")
    workspace.subscription.refresh_from_db()
    assert workspace.subscription.plan.code == Plan.Code.FREEMIUM


@pytest.mark.django_db
def test_non_authorized_workspace_member_cannot_checkout(django_user_model):
    owner = django_user_model.objects.create_user(username="owner-denied@example.com", email="owner-denied@example.com", password="pass")
    member_user = django_user_model.objects.create_user(username="member-denied@example.com", email="member-denied@example.com", password="pass")
    workspace = create_workspace_for_owner(owner=owner, name="Denied Subscription", organization_type="association")
    member_role = Role.objects.get(workspace=workspace, code="MEMBER")
    WorkspaceMembership.objects.create(user=member_user, workspace=workspace, role=member_role, status=WorkspaceMembership.Status.ACTIVE)
    from rest_framework.test import APIClient

    client = APIClient()
    client.force_authenticate(member_user)
    response = client.post("/api/v1/subscriptions/checkout/", {"plan": Plan.Code.NOVEX_START}, format="json", HTTP_X_WORKSPACE=workspace.slug)

    assert response.status_code == 403
