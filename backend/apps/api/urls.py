from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.members.views import PublicInvitationViewSet, PublicMembershipViewSet, SelfMemberDashboardView, SelfMemberProfileView

public_router = DefaultRouter()
public_router.register("membership", PublicMembershipViewSet, basename="public-membership")
public_router.register("invitations", PublicInvitationViewSet, basename="public-invitation")

urlpatterns = [
    path("auth/", include("apps.users.urls")),
    path("me/member/", SelfMemberProfileView.as_view(), name="self-member-profile"),
    path("me/member/dashboard/", SelfMemberDashboardView.as_view(), name="self-member-dashboard"),
    path("dashboard/", include("apps.dashboard.urls")),
    path("workspaces/", include("apps.workspaces.urls")),
    path("members/", include("apps.members.urls")),
    path("contributions/", include("apps.contributions.urls")),
    path("payments/", include("apps.payments.urls")),
    path("receipts/", include("apps.payments.receipt_urls")),
    path("finance/", include("apps.finance.urls")),
    path("budgets/", include("apps.budgets.urls")),
    path("projects/", include("apps.projects.urls")),
    path("events/", include("apps.events.urls")),
    path("documents/", include("apps.documents.urls")),
    path("analytics/", include("apps.analytics.urls")),
    path("reports/", include("apps.reports.urls")),
    path("subscriptions/", include("apps.subscriptions.urls")),
    path("public/", include(public_router.urls)),
]
