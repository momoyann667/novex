from django.conf import settings
from django.db import models

from apps.members.models import Member
from apps.workspaces.models import Role, Workspace
from .statuses import ExportFormat, ExportStatus, ReportType, ScheduledReportFrequency, ShareSubjectType, WidgetType


class AnalyticsDashboard(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="analytics_dashboards")
    name = models.CharField(max_length=160)
    is_default = models.BooleanField(default=False)
    layout = models.JSONField(default=list, blank=True)
    filters = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "is_default"]), models.Index(fields=["workspace", "created_by"])]


class AnalyticsWidget(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="analytics_widgets")
    dashboard = models.ForeignKey(AnalyticsDashboard, on_delete=models.CASCADE, related_name="widgets")
    widget_type = models.CharField(max_length=16, choices=WidgetType.choices)
    title = models.CharField(max_length=160)
    metric_key = models.CharField(max_length=120, blank=True)
    configuration = models.JSONField(default=dict, blank=True)
    position = models.JSONField(default=dict, blank=True)
    is_visible = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "dashboard", "is_visible"]), models.Index(fields=["workspace", "widget_type"])]


class SavedReport(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="saved_reports")
    name = models.CharField(max_length=180)
    report_type = models.CharField(max_length=32, choices=ReportType.choices)
    filters = models.JSONField(default=dict, blank=True)
    configuration = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "report_type"]), models.Index(fields=["workspace", "created_by", "-updated_at"])]


class SavedReportShare(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="saved_report_shares")
    report = models.ForeignKey(SavedReport, on_delete=models.CASCADE, related_name="shares")
    subject_type = models.CharField(max_length=16, choices=ShareSubjectType.choices)
    member = models.ForeignKey(Member, on_delete=models.CASCADE, null=True, blank=True, related_name="saved_report_shares")
    role = models.ForeignKey(Role, on_delete=models.CASCADE, null=True, blank=True, related_name="saved_report_shares")
    team = models.CharField(max_length=120, blank=True)
    can_export = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "report"]), models.Index(fields=["workspace", "subject_type"])]


class ScheduledReport(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="scheduled_reports")
    report = models.ForeignKey(SavedReport, on_delete=models.CASCADE, related_name="schedules")
    frequency = models.CharField(max_length=16, choices=ScheduledReportFrequency.choices)
    recipients = models.JSONField(default=list, blank=True)
    export_format = models.CharField(max_length=16, choices=ExportFormat.choices, default=ExportFormat.PDF)
    send_time = models.TimeField()
    is_active = models.BooleanField(default=True)
    next_run_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "is_active", "next_run_at"]), models.Index(fields=["workspace", "frequency"])]


class ReportExportRequest(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="report_export_requests")
    saved_report = models.ForeignKey(SavedReport, on_delete=models.SET_NULL, null=True, blank=True, related_name="exports")
    report_type = models.CharField(max_length=32, choices=ReportType.choices)
    export_format = models.CharField(max_length=16, choices=ExportFormat.choices)
    filters = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=16, choices=ExportStatus.choices, default=ExportStatus.PENDING)
    file = models.FileField(upload_to="report-exports/", blank=True)
    result = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "status", "-created_at"]), models.Index(fields=["workspace", "report_type"])]
