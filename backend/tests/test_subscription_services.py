from decimal import Decimal

import pytest

pytest.importorskip("pytest_django")

from apps.contributions.models import Contribution
from apps.contributions.services import create_campaign
from apps.members.models import Member
from apps.payments.services import initialize_contribution_payment
from apps.payments.statuses import PaymentMethod
from apps.subscriptions.models import Plan, Subscription
from apps.subscriptions.services import create_subscription_checkout, ensure_plan_catalog, ensure_workspace_subscription, subscription_overview, workspace_has_entitlement
from apps.workspaces.models import Workspace


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

    assert payload["status"] == "PENDING"
    assert payload["online_available"] is False
    assert workspace.subscription.plan.code == Plan.Code.FREEMIUM
