from datetime import date
from decimal import Decimal

import pytest

pytest.importorskip("pytest_django")

from apps.contributions.models import Contribution
from apps.contributions.services import create_campaign
from apps.finance.models import FinancialTransaction, FiscalPeriod
from apps.finance.services import cancel_transaction, close_fiscal_period, create_expense, create_income, default_category, finance_dashboard, financial_settings, validate_expense
from apps.finance.statuses import FinancialCategoryKind, FinancialTransactionStatus, FinancialTransactionType
from apps.members.models import Member
from apps.payments.services import record_manual_payment
from apps.workspaces.models import Workspace


@pytest.mark.django_db
def test_income_expense_balance_and_cancellation(django_user_model):
    owner = django_user_model.objects.create_user(username="finance@example.com", email="finance@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Finance", slug="association-finance", organization_type="association", owner=owner)
    income_category = default_category(workspace, kind=FinancialCategoryKind.INCOME_CATEGORY, name="Dons", actor=owner)
    expense_category = default_category(workspace, kind=FinancialCategoryKind.EXPENSE_CATEGORY, name="Transport", actor=owner)

    create_income(workspace=workspace, actor=owner, amount=Decimal("100000.00"), category=income_category, description="Don partenaire")
    expense = create_expense(workspace=workspace, actor=owner, amount=Decimal("40000.00"), category=expense_category, description="Transport equipe")
    dashboard = finance_dashboard(workspace=workspace)

    assert dashboard["total_income"] == Decimal("100000.00")
    assert dashboard["total_expense"] == Decimal("40000.00")
    assert dashboard["available_balance"] == Decimal("60000.00")

    cancel_transaction(transaction_obj=expense, actor=owner, reason="Erreur de saisie")
    dashboard = finance_dashboard(workspace=workspace)

    assert dashboard["total_expense"] == Decimal("0.00")
    assert dashboard["available_balance"] == Decimal("100000.00")


@pytest.mark.django_db
def test_successful_contribution_payment_creates_one_financial_transaction(django_user_model):
    owner = django_user_model.objects.create_user(username="finance-payment@example.com", email="finance-payment@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Payment Finance", slug="association-payment-finance", organization_type="association", owner=owner)
    member = Member.objects.create(workspace=workspace, membership_number="A-100001", first_name="Awa", last_name="Kone")
    campaign = create_campaign(workspace=workspace, actor=owner, name="Cotisation annuelle", amount=Decimal("25000.00"))
    contribution = Contribution.objects.create(workspace=workspace, campaign=campaign, member=member, amount_due=Decimal("25000.00"))

    first = record_manual_payment(workspace=workspace, actor=owner, member=member, contribution=contribution, amount=Decimal("25000.00"), idempotency_key="finance-pay-1")
    second = record_manual_payment(workspace=workspace, actor=owner, member=member, contribution=contribution, amount=Decimal("25000.00"), idempotency_key="finance-pay-1")

    assert first.id == second.id
    assert FinancialTransaction.objects.filter(workspace=workspace, source_payment=first, transaction_type=FinancialTransactionType.INCOME).count() == 1


@pytest.mark.django_db
def test_expense_receipt_rule_and_closed_period(django_user_model):
    owner = django_user_model.objects.create_user(username="finance-rules@example.com", email="finance-rules@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Rules", slug="association-rules", organization_type="association", owner=owner)
    settings = financial_settings(workspace)
    settings.require_expense_receipt = True
    settings.expense_validation_threshold = Decimal("1000.00")
    settings.save()
    category = default_category(workspace, kind=FinancialCategoryKind.EXPENSE_CATEGORY, name="Fournitures", actor=owner)

    expense = create_expense(workspace=workspace, actor=owner, amount=Decimal("5000.00"), category=category, description="Papeterie")

    assert expense.status == FinancialTransactionStatus.PENDING
    with pytest.raises(ValueError):
        validate_expense(transaction_obj=expense, actor=owner)

    period = FiscalPeriod.objects.create(workspace=workspace, name="2026", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))
    close_fiscal_period(period=period, actor=owner)

    with pytest.raises(ValueError):
        create_expense(workspace=workspace, actor=owner, amount=Decimal("1000.00"), category=category, description="Apres cloture", transaction_date=date(2026, 6, 1))
