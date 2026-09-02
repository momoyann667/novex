from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def health(_request):
    payload = {"status": "ok"}
    if settings.DEBUG:
        payload["database"] = {
            "name": connection.settings_dict.get("NAME"),
            "user": connection.settings_dict.get("USER"),
            "host": connection.settings_dict.get("HOST"),
            "port": connection.settings_dict.get("PORT"),
        }
    return JsonResponse(payload)


urlpatterns = [
    path("health/", health, name="health"),
    path("ready/", health, name="ready"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/v1/", include("apps.api.urls")),
]
