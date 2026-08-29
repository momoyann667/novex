from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import FinancialAdjustmentViewSet, FinancialHistoryView

router = DefaultRouter()
router.register("adjustments", FinancialAdjustmentViewSet, basename="financial-adjustment")

urlpatterns = [
    path("history/", FinancialHistoryView.as_view(), name="finance-history"),
    *router.urls,
]
