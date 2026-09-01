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

function saveBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function textValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function escapeHtml(value: unknown): string {
  return textValue(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function flattenPayload(payload: unknown, prefix = ""): Array<[string, string]> {
  if (!payload || typeof payload !== "object") {
    return [[prefix || "valeur", textValue(payload)]];
  }

  return Object.entries(payload as Record<string, unknown>).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return flattenPayload(value, path);
    }
    return [[path, textValue(value)]];
  });
}

function minimalPdf(lines: string[]) {
  const escapedLines = lines.map((line) =>
    line
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, "")
      .replaceAll("\\", "\\\\")
      .replaceAll("(", "\\(")
      .replaceAll(")", "\\)")
  );
  const content = [
    "BT",
    "/F1 18 Tf",
    "50 790 Td",
    "(NOVEX - Rapport) Tj",
    "/F1 10 Tf",
    "0 -28 Td",
    ...escapedLines.slice(0, 42).flatMap((line) => [`(${line.slice(0, 95)}) Tj`, "0 -16 Td"]),
    "ET"
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

export function downloadPdfExport(filename: string, payload: unknown) {
  const lines = flattenPayload(payload).map(([label, value]) => `${label}: ${value}`);
  saveBlob(filename, new Blob([minimalPdf(lines)], { type: "application/pdf" }));
}

export function downloadExcelExport(filename: string, payload: unknown) {
  const rows = flattenPayload(payload)
    .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`)
    .join("");
  const workbook = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr><th>Indicateur</th><th>Valeur</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  saveBlob(filename, new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" }));
}
