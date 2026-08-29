from rest_framework.routers import DefaultRouter

from .views import FinancialAdjustmentViewSet, PaymentViewSet, ReceiptViewSet

router = DefaultRouter()
router.register("adjustments", FinancialAdjustmentViewSet, basename="financial-adjustment")
router.register("receipts", ReceiptViewSet, basename="receipt")
router.register("", PaymentViewSet, basename="payment")

urlpatterns = router.urls
