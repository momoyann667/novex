from rest_framework.routers import DefaultRouter

from .views import ContributionCampaignViewSet, ContributionExportRequestViewSet, ContributionReminderViewSet, ContributionViewSet, ReminderRuleViewSet

router = DefaultRouter()
router.register("campaigns", ContributionCampaignViewSet, basename="contribution-campaign")
router.register("reminders", ReminderRuleViewSet, basename="contribution-reminder")
router.register("reminder-history", ContributionReminderViewSet, basename="contribution-reminder-history")
router.register("exports", ContributionExportRequestViewSet, basename="contribution-export")
router.register("", ContributionViewSet, basename="contribution")

urlpatterns = router.urls
