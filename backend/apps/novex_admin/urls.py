from django.urls import path

from .views import (
    AdminActivityView,
    AdminAssociationActivateView,
    AdminAssociationDetailView,
    AdminAssociationSuspendView,
    AdminAssociationsView,
    AdminAuditView,
    AdminDashboardView,
    AdminPaymentsView,
    AdminPlansView,
    AdminReportsView,
    AdminSettingsView,
    AdminSubscriptionsView,
    AdminUserDetailView,
    AdminUsersView,
)

urlpatterns = [
    path("dashboard/", AdminDashboardView.as_view(), name="novex-admin-dashboard"),
    path("associations/", AdminAssociationsView.as_view(), name="novex-admin-associations"),
    path("associations/<int:workspace_id>/", AdminAssociationDetailView.as_view(), name="novex-admin-association-detail"),
    path("associations/<int:workspace_id>/suspend/", AdminAssociationSuspendView.as_view(), name="novex-admin-association-suspend"),
    path("associations/<int:workspace_id>/activate/", AdminAssociationActivateView.as_view(), name="novex-admin-association-activate"),
    path("users/", AdminUsersView.as_view(), name="novex-admin-users"),
    path("users/<int:user_id>/", AdminUserDetailView.as_view(), name="novex-admin-user-detail"),
    path("subscriptions/", AdminSubscriptionsView.as_view(), name="novex-admin-subscriptions"),
    path("payments/", AdminPaymentsView.as_view(), name="novex-admin-payments"),
    path("plans/", AdminPlansView.as_view(), name="novex-admin-plans"),
    path("activity/", AdminActivityView.as_view(), name="novex-admin-activity"),
    path("audit/", AdminAuditView.as_view(), name="novex-admin-audit"),
    path("reports/", AdminReportsView.as_view(), name="novex-admin-reports"),
    path("settings/", AdminSettingsView.as_view(), name="novex-admin-settings"),
]
