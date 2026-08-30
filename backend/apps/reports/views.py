from rest_framework import decorators, response, status, viewsets

from common.permissions.workspace import RequireWorkspacePermission
from .models import AnalyticsDashboard, ReportExportRequest, SavedReport, ScheduledReport
from .serializers import AnalyticsDashboardSerializer, ReportExportRequestSerializer, SavedReportSerializer, SavedReportShareSerializer, ScheduledReportSerializer
from .services import create_saved_report, ensure_default_dashboard, request_report_export, schedule_report, share_saved_report, update_saved_report


def current_workspace(request):
    return request.user.workspace_memberships.get(workspace__slug=request.headers.get("X-Workspace"), status="active").workspace


class AnalyticsDashboardViewSet(viewsets.ModelViewSet):
    serializer_class = AnalyticsDashboardSerializer
    permission_classes = [RequireWorkspacePermission.for_permission("reports.view")]

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [RequireWorkspacePermission.for_permission("reports.manage")()]
        return [RequireWorkspacePermission.for_permission("reports.view")()]

    def get_queryset(self):
        return AnalyticsDashboard.objects.filter(workspace__slug=self.request.headers.get("X-Workspace"), workspace__memberships__user=self.request.user, workspace__memberships__status="active").prefetch_related("widgets").order_by("-is_default", "-updated_at")

    def list(self, request, *args, **kwargs):
        ensure_default_dashboard(workspace=current_workspace(request), actor=request.user)
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(workspace=current_workspace(self.request), created_by=self.request.user)


class SavedReportViewSet(viewsets.ModelViewSet):
    serializer_class = SavedReportSerializer
    permission_classes = [RequireWorkspacePermission.for_permission("reports.view")]

    def get_permissions(self):
        permission_map = {"create": "reports.manage", "update": "reports.manage", "partial_update": "reports.manage", "destroy": "reports.manage", "shares": "reports.share"}
        return [RequireWorkspacePermission.for_permission(permission_map.get(self.action, "reports.view"))()]

    def get_queryset(self):
        return SavedReport.objects.filter(workspace__slug=self.request.headers.get("X-Workspace"), workspace__memberships__user=self.request.user, workspace__memberships__status="active").prefetch_related("shares").order_by("-updated_at")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["workspace"] = current_workspace(self.request)
        return context

    def perform_create(self, serializer):
        serializer.instance = create_saved_report(workspace=current_workspace(self.request), actor=self.request.user, **serializer.validated_data)

    def perform_update(self, serializer):
        serializer.instance = update_saved_report(report=self.get_object(), actor=self.request.user, **serializer.validated_data)

    def perform_destroy(self, instance):
        from .services import log_report_action

        log_report_action(workspace=instance.workspace, actor=self.request.user, action="report.deleted", resource="saved_report", resource_id=str(instance.id))
        instance.delete()

    @decorators.action(detail=True, methods=["get", "post"])
    def shares(self, request, pk=None):
        report = self.get_object()
        if request.method == "POST":
            serializer = SavedReportShareSerializer(data=request.data, context=self.get_serializer_context())
            serializer.is_valid(raise_exception=True)
            share = share_saved_report(report=report, actor=request.user, **serializer.validated_data)
            return response.Response(SavedReportShareSerializer(share).data, status=status.HTTP_201_CREATED)
        return response.Response(SavedReportShareSerializer(report.shares.all(), many=True).data)


class ScheduledReportViewSet(viewsets.ModelViewSet):
    serializer_class = ScheduledReportSerializer
    permission_classes = [RequireWorkspacePermission.for_permission("reports.schedule")]

    def get_queryset(self):
        return ScheduledReport.objects.filter(workspace__slug=self.request.headers.get("X-Workspace"), workspace__memberships__user=self.request.user, workspace__memberships__status="active").select_related("report").order_by("-created_at")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["workspace"] = current_workspace(self.request)
        return context

    def perform_create(self, serializer):
        serializer.instance = schedule_report(workspace=current_workspace(self.request), actor=self.request.user, **serializer.validated_data)


class ReportExportRequestViewSet(viewsets.ModelViewSet):
    serializer_class = ReportExportRequestSerializer
    permission_classes = [RequireWorkspacePermission.for_permission("reports.export")]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return ReportExportRequest.objects.filter(workspace__slug=self.request.headers.get("X-Workspace"), workspace__memberships__user=self.request.user, workspace__memberships__status="active").order_by("-created_at")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["workspace"] = current_workspace(self.request)
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        export = request_report_export(workspace=current_workspace(request), actor=request.user, **serializer.validated_data)
        return response.Response(self.get_serializer(export).data, status=status.HTTP_201_CREATED)
