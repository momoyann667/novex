from django.urls import path

from .views import (
    AlertsAnalyticsView,
    AnnualReportView,
    ContributionsAnalyticsView,
    DocumentsAnalyticsView,
    EventsAnalyticsView,
    FinanceAnalyticsView,
    MembersAnalyticsView,
    OverviewAnalyticsView,
    PerformanceAnalyticsView,
    ProjectsAnalyticsView,
)

urlpatterns = [
    path("overview/", OverviewAnalyticsView.as_view(), name="analytics-overview"),
    path("finance/", FinanceAnalyticsView.as_view(), name="analytics-finance"),
    path("members/", MembersAnalyticsView.as_view(), name="analytics-members"),
    path("contributions/", ContributionsAnalyticsView.as_view(), name="analytics-contributions"),
    path("projects/", ProjectsAnalyticsView.as_view(), name="analytics-projects"),
    path("events/", EventsAnalyticsView.as_view(), name="analytics-events"),
    path("documents/", DocumentsAnalyticsView.as_view(), name="analytics-documents"),
    path("performance/", PerformanceAnalyticsView.as_view(), name="analytics-performance"),
    path("alerts/", AlertsAnalyticsView.as_view(), name="analytics-alerts"),
    path("annual/", AnnualReportView.as_view(), name="analytics-annual"),
]
