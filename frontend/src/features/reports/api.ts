import { apiFetch, ApiError } from "@/lib/api/client";
import { isInvalidWorkspaceSlug } from "@/lib/workspace/routing";

export type PeriodCode = "today" | "week" | "month" | "quarter" | "year" | "previous_year" | "custom";

export type KpiPayload = {
  value: number | string | null;
  variation?: number | string | null;
  direction?: "up" | "down" | "flat";
};

export type ReportsOverview = {
  period: { code: string; label: string; date_from: string; date_to: string };
  financial: Record<string, unknown>;
  members: Record<string, unknown>;
  contributions: Record<string, unknown>;
  projects: Record<string, unknown>;
  events: Record<string, unknown>;
  documents: Record<string, unknown>;
  performance: Record<string, unknown>;
  alerts: Array<{ type: string; severity: string; message: string; value?: number | string | null }>;
  empty_state: boolean;
  last_updated_at: string;
};

export type ReportExportRequest = {
  id: number;
  report_type: string;
  export_format: string;
  status: string;
  result: Record<string, unknown>;
  error_message: string;
  created_at: string;
};

function workspaceHeaders(workspaceSlug: string) {
  if (isInvalidWorkspaceSlug(workspaceSlug)) {
    throw new ApiError("Workspace invalide. Reconnecte-toi pour ouvrir ton association.", 400);
  }

  return { "X-Workspace": workspaceSlug };
}

function periodQuery(period: PeriodCode) {
  return `?period=${encodeURIComponent(period)}`;
}

export function getReportsOverview(workspaceSlug: string, period: PeriodCode) {
  return apiFetch<ReportsOverview>(`/analytics/overview/${periodQuery(period)}`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export function getReportSection(workspaceSlug: string, kind: string, period: PeriodCode) {
  const endpoint = kind === "annual" ? "/analytics/annual/" : `/analytics/${kind}/${periodQuery(period)}`;
  return apiFetch<Record<string, unknown>>(endpoint, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export function requestReportExport(workspaceSlug: string, reportType: string, period: PeriodCode, exportFormat = "csv") {
  return apiFetch<ReportExportRequest>("/reports/export/", {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify({
      report_type: reportType,
      export_format: exportFormat,
      filters: { period }
    })
  });
}

export function downloadJsonExport(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
