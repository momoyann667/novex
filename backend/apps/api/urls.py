from django.urls import include, path

urlpatterns = [
    path("auth/", include("apps.users.urls")),
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
]
