from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import BudgetDashboardView, BudgetSettingsView, BudgetViewSet

router = DefaultRouter()
router.register("", BudgetViewSet, basename="budget")

urlpatterns = [
    path("dashboard/", BudgetDashboardView.as_view(), name="budget-dashboard"),
    path("settings/", BudgetSettingsView.as_view(), name="budget-settings"),
    *router.urls,
]

