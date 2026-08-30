from rest_framework import serializers

from apps.members.models import Member
from apps.workspaces.models import Role
from .models import AnalyticsDashboard, AnalyticsWidget, ReportExportRequest, SavedReport, SavedReportShare, ScheduledReport
from .statuses import ExportFormat, ReportType, ScheduledReportFrequency, ShareSubjectType, WidgetType


class AnalyticsWidgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalyticsWidget
        fields = ["id", "widget_type", "title", "metric_key", "configuration", "position", "is_visible", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_widget_type(self, value):
        if value not in WidgetType.values:
            raise serializers.ValidationError("Type de widget invalide.")
        return value


class AnalyticsDashboardSerializer(serializers.ModelSerializer):
    widgets = AnalyticsWidgetSerializer(many=True, required=False)

    class Meta:
        model = AnalyticsDashboard
        fields = ["id", "name", "is_default", "layout", "filters", "widgets", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class SavedReportShareSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedReportShare
        fields = ["id", "subject_type", "member", "role", "team", "can_export", "created_at"]
        read_only_fields = ["id", "created_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["member"].queryset = Member.objects.filter(workspace=workspace)
            self.fields["role"].queryset = Role.objects.filter(workspace=workspace)

    def validate(self, attrs):
        subject_type = attrs.get("subject_type") or getattr(self.instance, "subject_type", None)
        if subject_type == ShareSubjectType.MEMBER and not attrs.get("member"):
            raise serializers.ValidationError({"member": "Le membre est requis."})
        if subject_type == ShareSubjectType.ROLE and not attrs.get("role"):
            raise serializers.ValidationError({"role": "Le role est requis."})
        if subject_type == ShareSubjectType.TEAM and not attrs.get("team"):
            raise serializers.ValidationError({"team": "L'equipe est requise."})
        return attrs


class SavedReportSerializer(serializers.ModelSerializer):
    shares = SavedReportShareSerializer(many=True, read_only=True)

    class Meta:
        model = SavedReport
        fields = ["id", "name", "report_type", "filters", "configuration", "shares", "created_by", "created_at", "updated_at"]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def validate_report_type(self, value):
        if value not in ReportType.values:
            raise serializers.ValidationError("Type de rapport invalide.")
        return value


class ScheduledReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScheduledReport
        fields = ["id", "report", "frequency", "recipients", "export_format", "send_time", "is_active", "next_run_at", "created_at", "updated_at"]
        read_only_fields = ["id", "next_run_at", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["report"].queryset = SavedReport.objects.filter(workspace=workspace)

    def validate_frequency(self, value):
        if value not in ScheduledReportFrequency.values:
            raise serializers.ValidationError("Frequence invalide.")
        return value


class ReportExportRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportExportRequest
        fields = ["id", "saved_report", "report_type", "export_format", "filters", "status", "file", "result", "error_message", "requested_by", "created_at", "started_at", "completed_at"]
        read_only_fields = ["id", "status", "file", "result", "error_message", "requested_by", "created_at", "started_at", "completed_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["saved_report"].queryset = SavedReport.objects.filter(workspace=workspace)

    def validate_export_format(self, value):
        if value not in ExportFormat.values:
            raise serializers.ValidationError("Format d'export invalide.")
        return value
