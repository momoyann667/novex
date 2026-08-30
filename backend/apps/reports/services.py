from django.db import transaction
from django.utils import timezone

from apps.analytics.services import annual_report, overview_analytics, resolve_analytics_period
from apps.audit_logs.models import AuditLog
from apps.workspaces.models import Workspace
from .models import AnalyticsDashboard, AnalyticsWidget, ReportExportRequest, SavedReport, SavedReportShare, ScheduledReport
from .statuses import ExportFormat, ExportStatus


DEFAULT_WIDGETS = [
    ("kpi", "Solde actuel", "financial.balance"),
    ("kpi", "Taux de recouvrement", "contributions.recovery_rate"),
    ("chart", "Cash flow", "financial.cash_flow"),
    ("table", "Projets a risque", "projects.risk_items"),
    ("alert", "Alertes analytics", "alerts"),
]


def log_report_action(*, workspace: Workspace, actor, action: str, resource: str = "report", resource_id: str = "", metadata: dict | None = None) -> None:
    AuditLog.objects.create(workspace=workspace, actor=actor, action=action, resource=resource, resource_id=resource_id, metadata=metadata or {})


@transaction.atomic
def ensure_default_dashboard(*, workspace: Workspace, actor=None) -> AnalyticsDashboard:
    dashboard, created = AnalyticsDashboard.objects.get_or_create(workspace=workspace, is_default=True, defaults={"name": "Pilotage association", "created_by": actor})
    if created:
        for index, (widget_type, title, metric_key) in enumerate(DEFAULT_WIDGETS):
            AnalyticsWidget.objects.create(workspace=workspace, dashboard=dashboard, widget_type=widget_type, title=title, metric_key=metric_key, position={"x": index % 2, "y": index // 2, "w": 1, "h": 1})
        log_report_action(workspace=workspace, actor=actor, action="report.created", resource="analytics_dashboard", resource_id=str(dashboard.id))
    return dashboard


@transaction.atomic
def create_saved_report(*, workspace: Workspace, actor, **data) -> SavedReport:
    report = SavedReport.objects.create(workspace=workspace, created_by=actor, **data)
    log_report_action(workspace=workspace, actor=actor, action="report.created", resource="saved_report", resource_id=str(report.id))
    return report


@transaction.atomic
def update_saved_report(*, report: SavedReport, actor, **data) -> SavedReport:
    for field, value in data.items():
        setattr(report, field, value)
    report.save()
    log_report_action(workspace=report.workspace, actor=actor, action="report.updated", resource="saved_report", resource_id=str(report.id))
    return report


@transaction.atomic
def share_saved_report(*, report: SavedReport, actor, **data) -> SavedReportShare:
    share = SavedReportShare.objects.create(workspace=report.workspace, report=report, created_by=actor, **data)
    log_report_action(workspace=report.workspace, actor=actor, action="report.shared", resource="saved_report", resource_id=str(report.id), metadata={"share_id": share.id})
    return share


@transaction.atomic
def schedule_report(*, workspace: Workspace, actor, **data) -> ScheduledReport:
    schedule = ScheduledReport.objects.create(workspace=workspace, created_by=actor, **data)
    log_report_action(workspace=workspace, actor=actor, action="report.scheduled", resource="scheduled_report", resource_id=str(schedule.id))
    return schedule


def report_payload(*, workspace: Workspace, report_type: str, filters: dict | None = None) -> dict:
    filters = filters or {}
    if report_type == "annual":
        return annual_report(workspace=workspace, year=int(filters["year"]) if filters.get("year") else None)
    period = resolve_analytics_period(code=filters.get("period"), date_from=filters.get("date_from"), date_to=filters.get("date_to"))
    return overview_analytics(workspace=workspace, period=period)


def lightweight_export_result(*, workspace: Workspace, report_type: str, export_format: str, filters: dict | None = None) -> dict:
    payload = report_payload(workspace=workspace, report_type=report_type, filters=filters)
    return {
        "format": export_format,
        "workspace": workspace.name,
        "currency": workspace.currency,
        "generated_at": timezone.now().isoformat(),
        "sections": ["resume", "finances", "cotisations", "membres", "projets", "evenements", "documents"],
        "payload": payload,
        "rendering": "prepared_for_async_pdf_xlsx" if export_format in {ExportFormat.PDF, ExportFormat.XLSX} else "csv_metadata_ready",
    }


@transaction.atomic
def request_report_export(*, workspace: Workspace, actor, **data) -> ReportExportRequest:
    export = ReportExportRequest.objects.create(workspace=workspace, requested_by=actor, **data)
    log_report_action(workspace=workspace, actor=actor, action="report.export_requested", resource="report_export", resource_id=str(export.id))
    try:
        export.status = ExportStatus.COMPLETED
        export.started_at = timezone.now()
        export.result = lightweight_export_result(workspace=workspace, report_type=export.report_type, export_format=export.export_format, filters=export.filters)
        export.completed_at = timezone.now()
        export.save(update_fields=["status", "started_at", "result", "completed_at"])
        log_report_action(workspace=workspace, actor=actor, action="report.export_completed", resource="report_export", resource_id=str(export.id))
    except Exception as exc:
        export.status = ExportStatus.FAILED
        export.error_message = str(exc)
        export.completed_at = timezone.now()
        export.save(update_fields=["status", "error_message", "completed_at"])
        log_report_action(workspace=workspace, actor=actor, action="report.export_failed", resource="report_export", resource_id=str(export.id), metadata={"error": str(exc)})
    return export
