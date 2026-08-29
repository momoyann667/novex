from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import MemberCategoryViewSet, MemberViewSet
from apps.payments.views import MemberFinancialHistoryView

router = DefaultRouter()
router.register("categories", MemberCategoryViewSet, basename="member-category")
router.register("", MemberViewSet, basename="member")

urlpatterns = [
    path("<int:member_id>/financial-history/", MemberFinancialHistoryView.as_view(), name="member-financial-history"),
    *router.urls,
]
