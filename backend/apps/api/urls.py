from django.urls import include, path

urlpatterns = [
    path("auth/", include("apps.users.urls")),
    path("workspaces/", include("apps.workspaces.urls")),
    path("members/", include("apps.members.urls")),
    path("subscriptions/", include("apps.subscriptions.urls")),
]
