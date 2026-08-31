from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CommunicationTemplateViewSet, CommunicationViewSet, MarkAllNotificationsReadView, MarkNotificationReadView, MyNotificationsView

router = DefaultRouter()
router.register("templates", CommunicationTemplateViewSet, basename="communication-template")
router.register("", CommunicationViewSet, basename="communication")

urlpatterns = [
    path("me/notifications/", MyNotificationsView.as_view(), name="my-notifications"),
    path("me/notifications/<int:recipient_id>/read/", MarkNotificationReadView.as_view(), name="mark-notification-read"),
    path("me/notifications/read-all/", MarkAllNotificationsReadView.as_view(), name="mark-all-notifications-read"),
    *router.urls,
]
