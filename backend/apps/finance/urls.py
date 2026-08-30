from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CostCenterViewSet, ExpenseViewSet, FinanceAnalyticsView, FinanceDashboardView, FinanceHistoryView, FinancialCategoryViewSet, FinancialSettingsView, FinancialTransactionViewSet, FiscalPeriodViewSet, IncomeViewSet

router = DefaultRouter()
router.register("transactions", FinancialTransactionViewSet, basename="finance-transaction")
router.register("income", IncomeViewSet, basename="finance-income")
router.register("expenses", ExpenseViewSet, basename="finance-expense")
router.register("categories", FinancialCategoryViewSet, basename="finance-category")
router.register("cost-centers", CostCenterViewSet, basename="finance-cost-center")
router.register("periods", FiscalPeriodViewSet, basename="finance-period")

urlpatterns = [
    path("dashboard/", FinanceDashboardView.as_view(), name="finance-dashboard"),
    path("analytics/", FinanceAnalyticsView.as_view(), name="finance-analytics"),
    path("history/", FinanceHistoryView.as_view(), name="finance-history"),
    path("settings/", FinancialSettingsView.as_view(), name="finance-settings"),
    *router.urls,
]
