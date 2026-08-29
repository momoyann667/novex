from rest_framework.routers import DefaultRouter

from .views import ReceiptViewSet

router = DefaultRouter()
router.register("", ReceiptViewSet, basename="receipt")

urlpatterns = router.urls
