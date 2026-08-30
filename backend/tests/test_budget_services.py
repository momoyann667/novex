from datetime import date
from decimal import Decimal

import pytest

pytest.importorskip("pytest_django")

from apps.budgets.models import BudgetAssignment
from apps.budgets.services import activate_budget, budget_dashboard, budget_settings, budget_summary, create_budget, create_budget_line
from apps.finance.services import financial_settings
from apps.budgets.statuses import BudgetScopeType
from apps.finance.services import cancel_transaction, create_expense, create_income, default_category
from apps.finance.statuses import FinancialCategoryKind, FinancialTransactionStatus
from apps.workspaces.models import Workspace


@pytest.mark.django_db
def test_budget_calculation_remaining_and_rate(django_user_model):
    owner = django_user_model.objects.create_user(username="budget@example.com", email="budget@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Budget", slug="association-budget", organization_type="association", owner=owner)
    finance_settings = financial_settings(workspace)
    finance_settings.expense_validation_threshold = Decimal("9999999.00")
    finance_settings.save()
    category = default_category(workspace, kind=FinancialCategoryKind.EXPENSE_CATEGORY, name="Transport", actor=owner)
    budget = create_budget(workspace=workspace, actor=owner, name="Budget annuel", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), total_amount=Decimal("1000000.00"))
    create_budget_line(budget=budget, actor=owner, category=category, planned_amount=Decimal("1000000.00"))
    activate_budget(budget=budget, actor=owner)

    create_expense(workspace=workspace, actor=owner, amount=Decimal("400000.00"), category=category, description="Transport")
    summary = budget_summary(budget)

    assert summary["actual"] == Decimal("400000.00")
    assert summary["remaining"] == Decimal("600000.00")
    assert summary["consumption_rate"] == Decimal("40.00")


@pytest.mark.django_db
def test_budget_overrun_and_zero_division(django_user_model):
    owner = django_user_model.objects.create_user(username="budget-overrun@example.com", email="budget-overrun@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Overrun", slug="association-overrun", organization_type="association", owner=owner)
    finance_settings = financial_settings(workspace)
    finance_settings.expense_validation_threshold = Decimal("9999999.00")
    finance_settings.save()
    category = default_category(workspace, kind=FinancialCategoryKind.EXPENSE_CATEGORY, name="Communication", actor=owner)
    budget = create_budget(workspace=workspace, actor=owner, name="Budget communication", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), total_amount=Decimal("1000000.00"))
    create_budget_line(budget=budget, actor=owner, category=category, planned_amount=Decimal("1000000.00"))
    activate_budget(budget=budget, actor=owner)

    create_expense(workspace=workspace, actor=owner, amount=Decimal("1200000.00"), category=category, description="Campagne")
    summary = budget_summary(budget)

    assert summary["overrun"] == Decimal("200000.00")

    zero = create_budget(workspace=workspace, actor=owner, name="Budget zero", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), total_amount=Decimal("0.00"))
    assert budget_summary(zero)["consumption_rate"] == Decimal("0.00")


@pytest.mark.django_db
def test_income_is_not_counted_and_cancelled_expense_recalculates(django_user_model):
    owner = django_user_model.objects.create_user(username="budget-income@example.com", email="budget-income@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Income", slug="association-income", organization_type="association", owner=owner)
    finance_settings = financial_settings(workspace)
    finance_settings.expense_validation_threshold = Decimal("9999999.00")
    finance_settings.save()
    expense_category = default_category(workspace, kind=FinancialCategoryKind.EXPENSE_CATEGORY, name="Fournitures", actor=owner)
    income_category = default_category(workspace, kind=FinancialCategoryKind.INCOME_CATEGORY, name="Cotisations", actor=owner)
    budget = create_budget(workspace=workspace, actor=owner, name="Budget fournitures", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), total_amount=Decimal("1000000.00"))
    create_budget_line(budget=budget, actor=owner, category=expense_category, planned_amount=Decimal("1000000.00"))
    activate_budget(budget=budget, actor=owner)

    create_income(workspace=workspace, actor=owner, amount=Decimal("500000.00"), category=income_category, description="Cotisation")
    expense = create_expense(workspace=workspace, actor=owner, amount=Decimal("300000.00"), category=expense_category, description="Achat")
    assert budget_summary(budget)["actual"] == Decimal("300000.00")

    cancel_transaction(transaction_obj=expense, actor=owner, reason="Erreur")
    assert budget_summary(budget)["actual"] == Decimal("0.00")


@pytest.mark.django_db
def test_over_budget_blocked_when_setting_disabled(django_user_model):
    owner = django_user_model.objects.create_user(username="budget-block@example.com", email="budget-block@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Block", slug="association-block", organization_type="association", owner=owner)
    settings = budget_settings(workspace)
    settings.allow_over_budget_expense = False
    settings.save()
    category = default_category(workspace, kind=FinancialCategoryKind.EXPENSE_CATEGORY, name="Evenements", actor=owner)
    budget = create_budget(workspace=workspace, actor=owner, name="Budget strict", start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), total_amount=Decimal("100000.00"))
    create_budget_line(budget=budget, actor=owner, category=category, planned_amount=Decimal("100000.00"))
    activate_budget(budget=budget, actor=owner)

    with pytest.raises(ValueError):
        create_expense(workspace=workspace, actor=owner, amount=Decimal("150000.00"), category=category, description="Depassement")


@pytest.mark.django_db
def test_unbudgeted_expense_is_visible_on_dashboard(django_user_model):
    owner = django_user_model.objects.create_user(username="budget-unbudgeted@example.com", email="budget-unbudgeted@example.com", password="pass")
    workspace = Workspace.objects.create(name="Association Unbudgeted", slug="association-unbudgeted", organization_type="association", owner=owner)
    category = default_category(workspace, kind=FinancialCategoryKind.EXPENSE_CATEGORY, name="Autres", actor=owner)

    expense = create_expense(workspace=workspace, actor=owner, amount=Decimal("25000.00"), category=category, description="Sans budget")
    assert expense.status == FinancialTransactionStatus.VALIDATED
    assert BudgetAssignment.objects.filter(transaction=expense).count() == 0
    assert budget_dashboard(workspace=workspace)["unbudgeted_expense"] == Decimal("25000.00")
