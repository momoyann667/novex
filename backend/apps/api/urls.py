from django.urls import include, path

urlpatterns = [
    path("auth/", include("apps.users.urls")),
    path("dashboard/", include("apps.dashboard.urls")),
    path("workspaces/", include("apps.workspaces.urls")),
    path("members/", include("apps.members.urls")),
    path("contributions/", include("apps.contributions.urls")),
    path("payments/", include("apps.payments.urls")),
    path("projects/", include("apps.projects.urls")),
    path("events/", include("apps.events.urls")),
    path("subscriptions/", include("apps.subscriptions.urls")),
]
