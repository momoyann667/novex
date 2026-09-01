from datetime import date
from decimal import Decimal

import pytest

pytest.importorskip("pytest_django")

from apps.contributions.models import Contribution
from apps.contributions.services import create_campaign
from apps.finance.models import FinancialTransaction, FiscalPeriod
from apps.budgets.services import activate_budget, create_budget, create_budget_line
from apps.finance.services import cancel_transaction, close_fiscal_period, create_expense, create_income, default_category, expense_budget_cards, expense_dashboard, finance_dashboard, financial_settings, reject_expense, validate_expense
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


@pytest.mark.django_db
def test_expense_dashboard_filters_period_and_workspace(django_user_model):
    owner = django_user_model.objects.create_user(username="expense-kpi@example.com", email="expense-kpi@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Depenses", slug="association-depenses", organization_type="association", owner=owner)
    other = Workspace.objects.create(name="Autre Association", slug="autre-association", organization_type="association", owner=owner)
    settings = financial_settings(workspace)
    settings.expense_validation_threshold = Decimal("1000.00")
    settings.save()
    category = default_category(workspace, kind=FinancialCategoryKind.EXPENSE_CATEGORY, name="Administration", actor=owner)
    other_category = default_category(other, kind=FinancialCategoryKind.EXPENSE_CATEGORY, name="Administration", actor=owner)

    pending = create_expense(workspace=workspace, actor=owner, amount=Decimal("2500.00"), category=category, description="Internet", transaction_date=date(2026, 9, 4))
    validated = create_expense(workspace=workspace, actor=owner, amount=Decimal("400.00"), category=category, description="Papier", transaction_date=date(2026, 9, 5))
    create_expense(workspace=workspace, actor=owner, amount=Decimal("600.00"), category=category, description="Aout", transaction_date=date(2026, 8, 31))
    create_expense(workspace=other, actor=owner, amount=Decimal("9999.00"), category=other_category, description="Hors tenant", transaction_date=date(2026, 9, 4))
    reject_expense(transaction_obj=pending, actor=owner, reason="Doublon")

    data = expense_dashboard(workspace=workspace, year=2026, month=9)

    assert data["total_expenses"] == Decimal("400.00")
    assert data["monthly_expenses"] == Decimal("400.00")
    assert data["pending_amount"] == Decimal("0.00")
    assert data["pending_count"] == 0
    assert data["approved_amount"] == validated.amount
    assert data["currency"] == workspace.currency


@pytest.mark.django_db
def test_expense_budget_cards_show_consumption_and_overrun(django_user_model):
    owner = django_user_model.objects.create_user(username="expense-budget@example.com", email="expense-budget@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Budget Depenses", slug="association-budget-depenses", organization_type="association", owner=owner)
    settings = financial_settings(workspace)
    settings.expense_validation_threshold = Decimal("9999999.00")
    settings.save()
    category = default_category(workspace, kind=FinancialCategoryKind.EXPENSE_CATEGORY, name="Transport", actor=owner)
    budget = create_budget(workspace=workspace, actor=owner, name="Budget transport", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), total_amount=Decimal("100000.00"))
    line = create_budget_line(budget=budget, actor=owner, category=category, planned_amount=Decimal("100000.00"))
    activate_budget(budget=budget, actor=owner)

    create_expense(workspace=workspace, actor=owner, amount=Decimal("125000.00"), category=category, budget_line=line, description="Mission", transaction_date=date(2026, 9, 2))
    cards = expense_budget_cards(workspace=workspace, year=2026, month=9)

    assert cards[0]["spent"] == Decimal("125000.00")
    assert cards[0]["remaining"] == Decimal("-25000.00")
    assert cards[0]["consumption_rate"] == Decimal("125.00")
    assert cards[0]["state"] == "Budget depasse"
