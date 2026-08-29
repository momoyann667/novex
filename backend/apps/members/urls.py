from rest_framework.routers import DefaultRouter

from .views import MemberCategoryViewSet, MemberViewSet

router = DefaultRouter()
router.register("categories", MemberCategoryViewSet, basename="member-category")
router.register("", MemberViewSet, basename="member")

urlpatterns = router.urls
