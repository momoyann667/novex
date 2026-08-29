from decimal import Decimal

import pytest

pytest.importorskip("pytest_django")

from apps.contributions.models import Contribution
from apps.contributions.services import create_campaign, generate_contributions_for_campaign
from apps.members.models import Member
from apps.payments.models import Payment
from apps.payments.services import record_manual_payment, register_webhook_event
from apps.workspaces.models import Workspace


@pytest.mark.django_db
def test_generate_contributions_for_active_workspace_members(django_user_model):
    owner = django_user_model.objects.create_user(username="owner@example.com", email="owner@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association", slug="association", organization_type="association", owner=owner)
    Member.objects.create(workspace=workspace, membership_number="A-000001", first_name="Awa", last_name="Kouame")
    campaign = create_campaign(workspace=workspace, actor=owner, name="Mars 2026", amount=Decimal("5000.00"))

    created = generate_contributions_for_campaign(campaign=campaign, actor=owner)

    assert created == 1
    assert Contribution.objects.get(campaign=campaign).amount_due == Decimal("5000.00")


@pytest.mark.django_db
def test_manual_payment_is_idempotent_and_updates_contribution(django_user_model):
    owner = django_user_model.objects.create_user(username="owner@example.com", email="owner@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association", slug="association", organization_type="association", owner=owner)
    member = Member.objects.create(workspace=workspace, membership_number="A-000001", first_name="Awa", last_name="Kouame")
    campaign = create_campaign(workspace=workspace, actor=owner, name="Mars 2026", amount=Decimal("5000.00"))
    generate_contributions_for_campaign(campaign=campaign, actor=owner)
    contribution = Contribution.objects.get(campaign=campaign, member=member)

    first = record_manual_payment(workspace=workspace, actor=owner, member=member, contribution=contribution, amount=Decimal("2500.00"), idempotency_key="pay-1")
    second = record_manual_payment(workspace=workspace, actor=owner, member=member, contribution=contribution, amount=Decimal("2500.00"), idempotency_key="pay-1")
    contribution.refresh_from_db()

    assert first.id == second.id
    assert Payment.objects.count() == 1
    assert contribution.amount_paid == Decimal("2500.00")
    assert contribution.status == Contribution.Status.PARTIALLY_PAID


@pytest.mark.django_db
def test_webhook_event_is_idempotent():
    first, created_first = register_webhook_event(provider="provider", event_id="evt-1", payload={"status": "successful"}, signature_valid=True)
    second, created_second = register_webhook_event(provider="provider", event_id="evt-1", payload={"status": "successful"}, signature_valid=True)

    assert first.id == second.id
    assert created_first is True
    assert created_second is False
