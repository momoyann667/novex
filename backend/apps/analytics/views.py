from rest_framework import response
from rest_framework.views import APIView

from common.permissions.workspace import RequireWorkspacePermission
from .services import (
    annual_report,
    analytics_alerts,
    contributions_analytics,
    documents_report,
    events_analytics,
    finance_analytics,
    members_analytics,
    overview_analytics,
    performance_scores,
    projects_analytics,
    resolve_analytics_period,
)


def current_workspace(request):
    return request.user.workspace_memberships.get(workspace__slug=request.headers.get("X-Workspace"), status="active").workspace


def period_from_request(request):
    return resolve_analytics_period(code=request.query_params.get("period"), date_from=request.query_params.get("date_from"), date_to=request.query_params.get("date_to"))


class AnalyticsView(APIView):
    analytics_handler = None
    permission_code = "reports.view"

    def get_permissions(self):
        return [RequireWorkspacePermission.for_permission(self.permission_code)()]

    def get(self, request):
        return response.Response(self.analytics_handler(workspace=current_workspace(request), period=period_from_request(request)))


class OverviewAnalyticsView(AnalyticsView):
    analytics_handler = staticmethod(overview_analytics)
    permission_code = "reports.view"


class FinanceAnalyticsView(AnalyticsView):
    analytics_handler = staticmethod(finance_analytics)
    permission_code = "reports.finance"


class MembersAnalyticsView(AnalyticsView):
    analytics_handler = staticmethod(members_analytics)
    permission_code = "reports.members"


class ContributionsAnalyticsView(AnalyticsView):
    analytics_handler = staticmethod(contributions_analytics)
    permission_code = "reports.contributions"


class ProjectsAnalyticsView(AnalyticsView):
    analytics_handler = staticmethod(projects_analytics)
    permission_code = "reports.projects"


class EventsAnalyticsView(AnalyticsView):
    analytics_handler = staticmethod(events_analytics)
    permission_code = "reports.events"


class DocumentsAnalyticsView(APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("reports.documents")]

    def get(self, request):
        return response.Response(documents_report(workspace=current_workspace(request)))


class PerformanceAnalyticsView(AnalyticsView):
    analytics_handler = staticmethod(performance_scores)
    permission_code = "reports.view"


class AlertsAnalyticsView(AnalyticsView):
    analytics_handler = staticmethod(analytics_alerts)
    permission_code = "reports.view"


class AnnualReportView(APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("reports.view")]

    def get(self, request):
        year = int(request.query_params["year"]) if request.query_params.get("year") else None
        return response.Response(annual_report(workspace=current_workspace(request), year=year))
