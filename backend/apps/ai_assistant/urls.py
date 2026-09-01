from rest_framework.routers import DefaultRouter

from .views import AIConversationViewSet

router = DefaultRouter()
router.register("conversations", AIConversationViewSet, basename="ai-conversation")

urlpatterns = router.urls
