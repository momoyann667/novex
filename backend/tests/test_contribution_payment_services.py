import hashlib
import hmac
import json
from decimal import Decimal

import pytest

pytest.importorskip("pytest_django")

from django.core.files.uploadedfile import SimpleUploadedFile
from apps.contributions.models import Contribution
from datetime import timedelta

from django.utils import timezone

from apps.contributions.services import (
    bulk_reminder_preview,
    contribution_analytics,
    contribution_dashboard,
    create_campaign,
    create_export_request,
    create_manual_reminder,
    generate_contributions_for_campaign,
    overdue_days,
    refresh_contribution_status,
    upcoming_due,
    waive_contribution,
)
from apps.contributions.statuses import ContributionStatus
from apps.audit_logs.models import AuditLog
from apps.members.models import Member
from apps.payments.models import Payment, Receipt
from apps.payments.services import attach_payment_document, donation_projects_for_workspace, financial_history, initialize_contribution_payment, initialize_donation_payment, initialize_self_contribution_payments, member_financial_history, payable_contributions_for_member, process_payment_webhook, record_manual_payment, register_webhook_event
from apps.payments.statuses import PaymentDocumentType, PaymentMethod, PaymentStatus
from apps.projects.models import Project
from apps.projects.statuses import ProjectStatus
from apps.subscriptions.models import Plan, Subscription
from apps.subscriptions.services import ensure_plan_catalog
from apps.workspaces.models import Workspace


def enable_online_payments(workspace):
    ensure_plan_catalog()
    plan = Plan.objects.get(code=Plan.Code.NOVEX_PRO)
    Subscription.objects.update_or_create(workspace=workspace, defaults={"plan": plan, "status": Subscription.Status.ACTIVE})


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
    assert contribution.status == ContributionStatus.PARTIALLY_PAID


@pytest.mark.django_db
def test_contribution_dashboard_uses_workspace_and_period_totals(django_user_model):
    owner = django_user_model.objects.create_user(username="dashboard@example.com", email="dashboard@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Dashboard", slug="association-dashboard", organization_type="association", owner=owner)
    other_workspace = Workspace.objects.create(name="Other Dashboard", slug="other-dashboard", organization_type="association", owner=owner)
    member = Member.objects.create(workspace=workspace, membership_number="A-000020", first_name="Awa", last_name="Kone")
    second_member = Member.objects.create(workspace=workspace, membership_number="A-000021", first_name="Jean", last_name="Yao")
    other_member = Member.objects.create(workspace=other_workspace, membership_number="B-000020", first_name="Bad", last_name="Tenant")
    campaign = create_campaign(workspace=workspace, actor=owner, name="Dashboard 2026", amount=Decimal("10000.00"))
    other_campaign = create_campaign(workspace=other_workspace, actor=owner, name="Other 2026", amount=Decimal("90000.00"))
    partial = Contribution.objects.create(
        workspace=workspace,
        campaign=campaign,
        member=member,
        amount_due=Decimal("10000.00"),
        amount_paid=Decimal("5000.00"),
        status=ContributionStatus.PARTIALLY_PAID,
    )
    old_overdue = Contribution.objects.create(
        workspace=workspace,
        campaign=campaign,
        member=second_member,
        amount_due=Decimal("5000.00"),
        due_date=timezone.localdate() - timedelta(days=1),
        status=ContributionStatus.OVERDUE,
    )
    Contribution.objects.create(
        workspace=other_workspace,
        campaign=other_campaign,
        member=other_member,
        amount_due=Decimal("90000.00"),
        amount_paid=Decimal("90000.00"),
        status=ContributionStatus.PAID,
    )
    Contribution.objects.filter(id=old_overdue.id).update(created_at=timezone.now() - timedelta(days=45))

    all_period = contribution_dashboard(workspace=workspace, period="all")
    month_period = contribution_dashboard(workspace=workspace, period="month")

    assert all_period["total_expected"] == Decimal("15000.00")
    assert all_period["total_collected"] == Decimal("5000.00")
    assert all_period["total_remaining"] == Decimal("10000.00")
    assert all_period["members_concerned"] == 2
    assert all_period["members_partial"] == 1
    assert all_period["members_overdue"] == 1
    assert month_period["total_expected"] == partial.amount_due
    assert month_period["total_collected"] == partial.amount_paid
    assert month_period["members_concerned"] == 1


@pytest.mark.django_db
def test_webhook_event_is_idempotent():
    first, created_first = register_webhook_event(provider="provider", event_id="evt-1", payload={"status": "successful"}, signature_valid=True)
    second, created_second = register_webhook_event(provider="provider", event_id="evt-1", payload={"status": "successful"}, signature_valid=True)

    assert first.id == second.id
    assert created_first is True
    assert created_second is False


@pytest.mark.django_db
def test_online_payment_initialization_is_idempotent_and_blocks_overpayment(django_user_model):
    owner = django_user_model.objects.create_user(username="online@example.com", email="online@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Online", slug="association-online", organization_type="association", owner=owner)
    member = Member.objects.create(workspace=workspace, membership_number="A-000010", first_name="Nadia", last_name="Kone")
    campaign = create_campaign(workspace=workspace, actor=owner, name="Avril 2026", amount=Decimal("5000.00"))
    contribution = Contribution.objects.create(workspace=workspace, campaign=campaign, member=member, amount_due=Decimal("5000.00"))
    enable_online_payments(workspace)

    first = initialize_contribution_payment(
        workspace=workspace,
        actor=owner,
        contribution=contribution,
        amount=Decimal("2000.00"),
        payment_method=PaymentMethod.MOBILE_MONEY,
        idempotency_key="online-1",
    )
    second = initialize_contribution_payment(
        workspace=workspace,
        actor=owner,
        contribution=contribution,
        amount=Decimal("2000.00"),
        payment_method=PaymentMethod.MOBILE_MONEY,
        idempotency_key="online-1",
    )

    assert first.id == second.id
    assert first.status == PaymentStatus.PROCESSING
    assert first.reference.startswith("NOVEX-")

    with pytest.raises(ValueError):
        initialize_contribution_payment(
            workspace=workspace,
            actor=owner,
            contribution=contribution,
            amount=Decimal("6000.00"),
            payment_method=PaymentMethod.MOBILE_MONEY,
            idempotency_key="online-too-high",
        )


@pytest.mark.django_db
def test_self_payable_contributions_are_limited_to_linked_member(django_user_model):
    owner = django_user_model.objects.create_user(username="self@example.com", email="self@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Self", slug="association-self", organization_type="association", owner=owner)
    member = Member.objects.create(workspace=workspace, linked_user=owner, membership_number="A-000030", first_name="Nadia", last_name="Kone")
    other_member = Member.objects.create(workspace=workspace, membership_number="A-000031", first_name="Ali", last_name="Soro")
    campaign = create_campaign(workspace=workspace, actor=owner, name="Septembre 2026", amount=Decimal("5000.00"))
    payable = Contribution.objects.create(workspace=workspace, campaign=campaign, member=member, amount_due=Decimal("5000.00"))
    paid = Contribution.objects.create(workspace=workspace, campaign=campaign, member=other_member, amount_due=Decimal("5000.00"), amount_paid=Decimal("5000.00"), status=ContributionStatus.PAID)
    enable_online_payments(workspace)

    payload = payable_contributions_for_member(workspace=workspace, user=owner)
    payment = initialize_self_contribution_payments(
        workspace=workspace,
        actor=owner,
        items=[{"contribution": payable, "amount": Decimal("2500.00")}],
        payment_method=PaymentMethod.MOBILE_MONEY,
        idempotency_key="self-online-1",
    )[0]

    assert payload["member"].id == member.id
    assert [item.id for item in payload["contributions"]] == [payable.id]
    assert paid.id not in [item.id for item in payload["contributions"]]
    assert payment.member_id == member.id
    assert payment.status == PaymentStatus.PROCESSING

    with pytest.raises(ValueError):
        initialize_self_contribution_payments(
            workspace=workspace,
            actor=owner,
            items=[{"contribution": paid, "amount": Decimal("1000.00")}],
            payment_method=PaymentMethod.MOBILE_MONEY,
            idempotency_key="self-online-cross-member",
        )


@pytest.mark.django_db
def test_donation_payment_keeps_project_relation_and_filters_cancelled_projects(django_user_model):
    owner = django_user_model.objects.create_user(username="donor@example.com", email="donor@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Donation", slug="association-donation", organization_type="association", owner=owner)
    member = Member.objects.create(workspace=workspace, linked_user=owner, membership_number="A-000040", first_name="Fatou", last_name="Diop")
    active_project = Project.objects.create(workspace=workspace, code="DON-1", name="Bibliotheque", status=ProjectStatus.ACTIVE, budget=Decimal("100000.00"), owner=member)
    cancelled_project = Project.objects.create(workspace=workspace, code="DON-2", name="Archive", status=ProjectStatus.CANCELLED, budget=Decimal("100000.00"))

    projects = list(donation_projects_for_workspace(workspace=workspace))
    payment = initialize_donation_payment(
        workspace=workspace,
        actor=owner,
        project=active_project,
        amount=Decimal("10000.00"),
        payment_method=PaymentMethod.MOBILE_MONEY,
        idempotency_key="donation-1",
    )

    assert active_project in projects
    assert cancelled_project not in projects
    assert payment.contribution_id is None
    assert payment.member_id == member.id
    assert payment.metadata["payment_type"] == "DONATION"
    assert payment.metadata["project_id"] == active_project.id
    assert payment.status == PaymentStatus.PROCESSING

    with pytest.raises(ValueError):
        initialize_donation_payment(
            workspace=workspace,
            actor=owner,
            project=cancelled_project,
            amount=Decimal("5000.00"),
            payment_method=PaymentMethod.MOBILE_MONEY,
            idempotency_key="donation-cancelled",
        )


@pytest.mark.django_db
def test_signed_webhook_confirms_payment_once(monkeypatch, django_user_model):
    monkeypatch.setenv("NOVEX_PAYMENT_WEBHOOK_SECRET", "unit-secret")
    owner = django_user_model.objects.create_user(username="webhook@example.com", email="webhook@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Webhook", slug="association-webhook", organization_type="association", owner=owner)
    member = Member.objects.create(workspace=workspace, membership_number="A-000011", first_name="Ami", last_name="Yao")
    campaign = create_campaign(workspace=workspace, actor=owner, name="Mai 2026", amount=Decimal("5000.00"))
    contribution = Contribution.objects.create(workspace=workspace, campaign=campaign, member=member, amount_due=Decimal("5000.00"))
    enable_online_payments(workspace)
    payment = initialize_contribution_payment(
        workspace=workspace,
        actor=owner,
        contribution=contribution,
        amount=Decimal("5000.00"),
        payment_method=PaymentMethod.MOBILE_MONEY,
        idempotency_key="online-2",
    )
    payload = {
        "reference": payment.reference,
        "provider_transaction_id": "txn-001",
        "status": "success",
        "amount": "5000.00",
        "currency": "XOF",
    }
    body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    signature = hmac.new(b"unit-secret", body, hashlib.sha256).hexdigest()

    event, confirmed_payment, processed = process_payment_webhook(provider_code="env_hmac", event_id="evt-001", payload=payload, signature=signature)
    duplicate_event, duplicate_payment, duplicate_processed = process_payment_webhook(provider_code="env_hmac", event_id="evt-001", payload=payload, signature=signature)
    contribution.refresh_from_db()

    assert event.signature_valid is True
    assert processed is True
    assert confirmed_payment.status == PaymentStatus.SUCCESS
    assert contribution.amount_paid == Decimal("5000.00")
    assert duplicate_event.id == event.id
    assert duplicate_payment is None
    assert duplicate_processed is False
    assert Receipt.objects.filter(payment=payment).count() == 1


@pytest.mark.django_db
def test_webhook_with_invalid_signature_does_not_update_payment(monkeypatch, django_user_model):
    monkeypatch.setenv("NOVEX_PAYMENT_WEBHOOK_SECRET", "unit-secret")
    owner = django_user_model.objects.create_user(username="bad-webhook@example.com", email="bad-webhook@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Bad Webhook", slug="association-bad-webhook", organization_type="association", owner=owner)
    member = Member.objects.create(workspace=workspace, membership_number="A-000012", first_name="Koffi", last_name="Kouame")
    campaign = create_campaign(workspace=workspace, actor=owner, name="Juin 2026", amount=Decimal("5000.00"))
    contribution = Contribution.objects.create(workspace=workspace, campaign=campaign, member=member, amount_due=Decimal("5000.00"))
    enable_online_payments(workspace)
    payment = initialize_contribution_payment(
        workspace=workspace,
        actor=owner,
        contribution=contribution,
        amount=Decimal("5000.00"),
        payment_method=PaymentMethod.MOBILE_MONEY,
        idempotency_key="online-3",
    )

    event, confirmed_payment, processed = process_payment_webhook(
        provider_code="env_hmac",
        event_id="evt-bad-001",
        payload={"reference": payment.reference, "status": "success", "amount": "5000.00", "currency": "XOF"},
        signature="invalid",
    )
    payment.refresh_from_db()
    contribution.refresh_from_db()

    assert event.signature_valid is False
    assert confirmed_payment is None
    assert processed is False
    assert payment.status == PaymentStatus.PROCESSING
    assert contribution.amount_paid == Decimal("0.00")


@pytest.mark.django_db
def test_receipt_is_idempotent_for_manual_payment(django_user_model):
    owner = django_user_model.objects.create_user(username="receipt@example.com", email="receipt@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Receipt", slug="association-receipt", organization_type="association", owner=owner)
    member = Member.objects.create(workspace=workspace, membership_number="A-000013", first_name="Sara", last_name="Bamba")
    campaign = create_campaign(workspace=workspace, actor=owner, name="Juillet 2026", amount=Decimal("10000.00"))
    contribution = Contribution.objects.create(workspace=workspace, campaign=campaign, member=member, amount_due=Decimal("10000.00"))

    first = record_manual_payment(workspace=workspace, actor=owner, member=member, contribution=contribution, amount=Decimal("10000.00"), idempotency_key="receipt-1")
    second = record_manual_payment(workspace=workspace, actor=owner, member=member, contribution=contribution, amount=Decimal("10000.00"), idempotency_key="receipt-1")
    receipt = Receipt.objects.get(payment=first)

    assert first.id == second.id
    assert Receipt.objects.filter(payment=first).count() == 1
    assert receipt.receipt_number.startswith("NVX-")
    assert receipt.pdf_file.name.endswith(".pdf")


@pytest.mark.django_db
def test_payment_document_upload_validation_and_financial_history(django_user_model):
    owner = django_user_model.objects.create_user(username="history@example.com", email="history@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association History", slug="association-history", organization_type="association", owner=owner)
    other_workspace = Workspace.objects.create(name="Other", slug="other-history", organization_type="association", owner=owner)
    member = Member.objects.create(workspace=workspace, membership_number="A-000014", first_name="Jean", last_name="Kouassi")
    other_member = Member.objects.create(workspace=other_workspace, membership_number="B-000014", first_name="Bad", last_name="Tenant")
    campaign = create_campaign(workspace=workspace, actor=owner, name="Aout 2026", amount=Decimal("25000.00"))
    contribution = Contribution.objects.create(workspace=workspace, campaign=campaign, member=member, amount_due=Decimal("25000.00"))
    payment = record_manual_payment(workspace=workspace, actor=owner, member=member, contribution=contribution, amount=Decimal("10000.00"), idempotency_key="history-1")
    upload = SimpleUploadedFile("proof.pdf", b"%PDF-1.4\n", content_type="application/pdf")

    document = attach_payment_document(payment=payment, actor=owner, title="Recu papier", file=upload, document_type=PaymentDocumentType.PROOF_OF_PAYMENT)
    member_history = member_financial_history(workspace=workspace, member=member)
    rows = financial_history(workspace=workspace, filters={"reference": payment.reference})

    assert document.size_bytes > 0
    assert member_history["total_due"] == Decimal("25000.00")
    assert member_history["total_paid"] == Decimal("10000.00")
    assert member_history["remaining_to_pay"] == Decimal("15000.00")
    assert rows[0]["reference"] == payment.reference
    with pytest.raises(ValueError):
        member_financial_history(workspace=workspace, member=other_member)


@pytest.mark.django_db
def test_contribution_remaining_amount_is_exact(django_user_model):
    owner = django_user_model.objects.create_user(username="owner@example.com", email="owner@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association", slug="association", organization_type="association", owner=owner)
    member = Member.objects.create(workspace=workspace, membership_number="A-000001", first_name="Awa", last_name="Kouame")
    campaign = create_campaign(workspace=workspace, actor=owner, name="Annuelle", amount=Decimal("25000.00"))
    contribution = Contribution.objects.create(workspace=workspace, campaign=campaign, member=member, amount_due=Decimal("25000.00"))

    assert contribution.remaining_amount == Decimal("25000.00")

    contribution.amount_paid = Decimal("10000.00")
    refresh_contribution_status(contribution)
    assert contribution.remaining_amount == Decimal("15000.00")
    assert contribution.status == ContributionStatus.PARTIALLY_PAID

    contribution.amount_paid = Decimal("25000.00")
    refresh_contribution_status(contribution)
    assert contribution.remaining_amount == Decimal("0.00")
    assert contribution.status == ContributionStatus.PAID


@pytest.mark.django_db
def test_contribution_decimal_precision_for_partial_amount(django_user_model):
    owner = django_user_model.objects.create_user(username="owner@example.com", email="owner@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association", slug="association-precision", organization_type="association", owner=owner)
    member = Member.objects.create(workspace=workspace, membership_number="A-000002", first_name="Aya", last_name="Kone")
    campaign = create_campaign(workspace=workspace, actor=owner, name="Speciale", amount=Decimal("100000.00"))
    contribution = Contribution.objects.create(workspace=workspace, campaign=campaign, member=member, amount_due=Decimal("100000.00"), amount_paid=Decimal("33333.00"))

    assert contribution.remaining_amount == Decimal("66667.00")


@pytest.mark.django_db
def test_waiver_updates_status_and_audit_log(django_user_model):
    owner = django_user_model.objects.create_user(username="owner@example.com", email="owner@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association", slug="association-waiver", organization_type="association", owner=owner)
    member = Member.objects.create(workspace=workspace, membership_number="A-000003", first_name="Moussa", last_name="Traore")
    campaign = create_campaign(workspace=workspace, actor=owner, name="Adhesion", amount=Decimal("25000.00"))
    contribution = Contribution.objects.create(workspace=workspace, campaign=campaign, member=member, amount_due=Decimal("25000.00"))

    waive_contribution(contribution=contribution, actor=owner, amount=Decimal("25000.00"), reason="Bourse sociale")
    contribution.refresh_from_db()

    assert contribution.remaining_amount == Decimal("0.00")
    assert contribution.status == ContributionStatus.WAIVED
    assert AuditLog.objects.filter(workspace=workspace, action="contribution.waived", resource_id=str(contribution.id)).exists()


@pytest.mark.django_db
def test_recovery_analytics_and_overdue_days(django_user_model):
    owner = django_user_model.objects.create_user(username="owner@example.com", email="owner@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association", slug="association-analytics", organization_type="association", owner=owner)
    member = Member.objects.create(workspace=workspace, membership_number="A-000004", first_name="Ami", last_name="Bamba")
    campaign = create_campaign(workspace=workspace, actor=owner, name="Mensuelle", amount=Decimal("100000.00"))
    contribution = Contribution.objects.create(
        workspace=workspace,
        campaign=campaign,
        member=member,
        amount_due=Decimal("100000.00"),
        amount_paid=Decimal("80000.00"),
        due_date=timezone.localdate() - timedelta(days=9),
    )
    refresh_contribution_status(contribution)

    analytics = contribution_analytics(workspace=workspace, period="month")

    assert analytics["collection_rate"] == 80
    assert analytics["overdue_amount"] == Decimal("20000.00")
    assert overdue_days(contribution) == 9
    assert bulk_reminder_preview(workspace)["recipients"] == 1


@pytest.mark.django_db
def test_upcoming_due_reminder_and_export_request(django_user_model):
    owner = django_user_model.objects.create_user(username="owner@example.com", email="owner@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association", slug="association-followup", organization_type="association", owner=owner)
    member = Member.objects.create(workspace=workspace, membership_number="A-000005", first_name="Koffi", last_name="Yao")
    campaign = create_campaign(workspace=workspace, actor=owner, name="Annuelle", amount=Decimal("25000.00"))
    contribution = Contribution.objects.create(
        workspace=workspace,
        campaign=campaign,
        member=member,
        amount_due=Decimal("25000.00"),
        due_date=timezone.localdate() + timedelta(days=3),
    )

    upcoming = upcoming_due(workspace, days=7)
    reminder = create_manual_reminder(contribution=contribution, actor=owner, send_now=True)
    export = create_export_request(workspace=workspace, actor=owner, export_type="overdue", filters={"days_overdue": 7})

    assert upcoming["members"] == 1
    assert reminder.status == "SENT"
    assert export.status == "queued"
