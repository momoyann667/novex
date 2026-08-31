from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    MemberCategoryViewSet,
    MemberCustomFieldDefinitionViewSet,
    MemberGroupViewSet,
    MemberInvitationViewSet,
    MemberTagViewSet,
    MemberViewSet,
    MembershipApplicationViewSet,
    MembershipSettingsViewSet,
)
from apps.payments.views import MemberFinancialHistoryView

router = DefaultRouter()
router.register("categories", MemberCategoryViewSet, basename="member-category")
router.register("tags", MemberTagViewSet, basename="member-tag")
router.register("groups", MemberGroupViewSet, basename="member-group")
router.register("custom-fields", MemberCustomFieldDefinitionViewSet, basename="member-custom-field")
router.register("applications", MembershipApplicationViewSet, basename="membership-application")
router.register("invitations", MemberInvitationViewSet, basename="member-invitation")
router.register("onboarding-settings", MembershipSettingsViewSet, basename="membership-settings")
router.register("", MemberViewSet, basename="member")

urlpatterns = [
    path("<int:member_id>/financial-history/", MemberFinancialHistoryView.as_view(), name="member-financial-history"),
    *router.urls,
]
