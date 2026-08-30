from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AnalyticsDashboardViewSet, ReportExportRequestViewSet, SavedReportViewSet, ScheduledReportViewSet

router = DefaultRouter()
router.register("dashboards", AnalyticsDashboardViewSet, basename="analytics-dashboard")
router.register("saved", SavedReportViewSet, basename="saved-report")
router.register("scheduled", ScheduledReportViewSet, basename="scheduled-report")
router.register("exports", ReportExportRequestViewSet, basename="report-export")

urlpatterns = [
    path("export/", ReportExportRequestViewSet.as_view({"post": "create"}), name="report-export-request"),
    *router.urls,
]
