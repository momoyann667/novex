from rest_framework.routers import DefaultRouter

from .views import ContributionCampaignViewSet, ContributionViewSet, ReminderRuleViewSet

router = DefaultRouter()
router.register("campaigns", ContributionCampaignViewSet, basename="contribution-campaign")
router.register("reminders", ReminderRuleViewSet, basename="contribution-reminder")
router.register("", ContributionViewSet, basename="contribution")

urlpatterns = router.urls
