from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CreatorSupportTicketViewSet

router = DefaultRouter()
router.register("tickets", CreatorSupportTicketViewSet, basename="support-ticket")

urlpatterns = [
    path("", include(router.urls)),
]
