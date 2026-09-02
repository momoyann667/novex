from django.urls import path

from .views import (
    AdminActivityView,
    AdminAssociationDetailView,
    AdminAssociationsView,
    AdminAuditView,
    AdminDashboardView,
    AdminPaymentsView,
    AdminPlansView,
    AdminReportsView,
    AdminSettingsView,
    AdminSubscriptionsView,
    AdminUsersView,
)

urlpatterns = [
    path("dashboard/", AdminDashboardView.as_view(), name="novex-admin-dashboard"),
    path("associations/", AdminAssociationsView.as_view(), name="novex-admin-associations"),
    path("associations/<int:workspace_id>/", AdminAssociationDetailView.as_view(), name="novex-admin-association-detail"),
    path("users/", AdminUsersView.as_view(), name="novex-admin-users"),
    path("subscriptions/", AdminSubscriptionsView.as_view(), name="novex-admin-subscriptions"),
    path("payments/", AdminPaymentsView.as_view(), name="novex-admin-payments"),
    path("plans/", AdminPlansView.as_view(), name="novex-admin-plans"),
    path("activity/", AdminActivityView.as_view(), name="novex-admin-activity"),
    path("audit/", AdminAuditView.as_view(), name="novex-admin-audit"),
    path("reports/", AdminReportsView.as_view(), name="novex-admin-reports"),
    path("settings/", AdminSettingsView.as_view(), name="novex-admin-settings"),
]
