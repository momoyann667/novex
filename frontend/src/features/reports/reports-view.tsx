"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, CalendarDays, CreditCard, FileText, FolderKanban, Landmark, LineChart, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { workspacePath } from "@/lib/workspace/routing";
import { AnalyticsTable, EmptyAnalyticsState, KpiCard, MetricChart, PeriodFilter, ReportHeader } from "./report-components";
import { downloadJsonExport, getReportSection, getReportsOverview, requestReportExport } from "./api";
import type { KpiPayload, PeriodCode, ReportsOverview } from "./api";

const reportTabs = [
  ["Vue d'ensemble", "reports", BarChart3],
  ["Finances", "reports/finance", Wallet],
  ["Membres", "reports/members", Users],
  ["Cotisations", "reports/contributions", CreditCard],
  ["Projets", "reports/projects", FolderKanban],
  ["Evenements", "reports/events", CalendarDays],
  ["Performance", "reports/performance", LineChart],
  ["Annuel", "reports/annual", FileText],
] as const;

function numberValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function nested(source: Record<string, unknown> | undefined, path: string) {
  return path.split(".").reduce<unknown>((current, key) => (current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined), source);
}

function kpiValue(source: Record<string, unknown> | undefined, path: string): KpiPayload {
  const value = nested(source, path);
  return value && typeof value === "object" && "value" in value ? (value as KpiPayload) : { value: value as string | number | null };
}

function formatMoney(value: unknown, currency = "FCFA") {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(numberValue(value))} ${currency}`;
}

function formatPercent(value: unknown) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(numberValue(value))}%`;
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(numberValue(value));
}

function formatTrend(kpi: KpiPayload) {
  return kpi.variation === null || kpi.variation === undefined ? undefined : formatPercent(kpi.variation);
}

function metricValue(kpi: KpiPayload, formatter: (value: unknown) => string) {
  return formatter(kpi.value);
}

function seriesValues(rows: unknown, keys: string[] = ["net", "balance", "income", "paid", "count", "progress"]) {
  const values = Array.isArray(rows)
    ? rows.map((row) => {
        if (!row || typeof row !== "object") return 0;
        const item = row as Record<string, unknown>;
        return numberValue(keys.map((key) => item[key]).find((value) => value !== undefined));
      })
    : [];
  const max = Math.max(...values, 1);
  return values.length ? values.map((value) => Math.max(6, Math.round((value / max) * 100))) : [0, 0, 0, 0, 0, 0];
}

function dashboardRows(data?: ReportsOverview): string[][] {
  const categories = nested(data?.financial, "expense_breakdown") as Array<Record<string, unknown>> | undefined;
  const rows = (categories || []).slice(0, 6).map((item) => [
    String(item.category__name || item.category || "Categorie"),
    formatMoney(item.total || item.amount || 0),
    formatNumber(item.count || 0),
    formatPercent(item.percentage || 0),
  ]);
  return [["Categorie", "Montant", "Operations", "Poids"], ...rows];
}

function savedRows(data?: ReportsOverview): string[][] {
  return [
    ["Rapport", "Valeur", "Periode"],
    ["Solde", formatMoney(nested(data?.financial, "balance.value")), data?.period?.label || "-"],
    ["Recouvrement", formatPercent(nested(data?.contributions, "recovery_rate")), data?.period?.label || "-"],
    ["Documents", formatNumber(nested(data?.documents, "total_documents")), data?.period?.label || "-"],
  ];
}

function downloadExportPayload(reportType: string, payload: unknown) {
  const today = new Date().toISOString().slice(0, 10);
  downloadJsonExport(`NOVEX_Rapport_${reportType}_${today}.json`, payload);
}

export function ReportsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const [period, setPeriod] = useState<PeriodCode>("month");
  const overviewQuery = useQuery({
    queryKey: ["reports-overview", workspaceSlug, period],
    queryFn: () => getReportsOverview(workspaceSlug, period)
  });
  const exportMutation = useMutation({
    mutationFn: () => requestReportExport(workspaceSlug, "overview", period),
    onSuccess: (exportRequest) => downloadExportPayload("global", exportRequest.result)
  });
  const data = overviewQuery.data;
  const finance = data?.financial;
  const contributions = data?.contributions;
  const members = data?.members;
  const projects = data?.projects;
  const events = data?.events;
  const performance = data?.performance;
  const cashFlowValues = useMemo(() => seriesValues(nested(finance, "cash_flow") || nested(contributions, "monthly")), [finance, contributions]);

  return (
    <div className="grid gap-6">
      <ReportHeader title="Rapports & Analytics" description="Pilotage data-driven consolidant finance, membres, cotisations, projets, evenements et documents." workspaceSlug={workspaceSlug} lastUpdatedAt={data?.last_updated_at} exportDisabled={exportMutation.isPending || overviewQuery.isLoading} onExport={() => exportMutation.mutate()} />
      <PeriodFilter value={period} onChange={setPeriod} />
      <section className="flex gap-2 overflow-x-auto border-b border-border pb-2">
        {reportTabs.map(([label, path, Icon]) => <Link className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100" href={workspacePath(workspaceSlug, path)} key={path}><Icon className="size-4" /> {label}</Link>)}
      </section>
      {data?.empty_state ? <EmptyAnalyticsState /> : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard value={metricValue(kpiValue(finance, "income"), formatMoney)} label="Recettes" trend={formatTrend(kpiValue(finance, "income"))} direction={kpiValue(finance, "income").direction || "flat"} />
        <KpiCard value={metricValue(kpiValue(finance, "expense"), formatMoney)} label="Depenses" trend={formatTrend(kpiValue(finance, "expense"))} direction={kpiValue(finance, "expense").direction || "flat"} />
        <KpiCard value={formatPercent(nested(contributions, "recovery_rate"))} label="Taux de recouvrement" />
        <KpiCard value={formatNumber(nested(members, "active_members"))} label="Membres actifs" />
        <KpiCard value={formatMoney(nested(finance, "budget.total_budget"))} label="Budget total" />
        <KpiCard value={formatPercent(nested(finance, "budget.consumption_rate"))} label="Budget consomme" />
        <KpiCard value={formatNumber(nested(projects, "active_projects"))} label="Projets actifs" />
        <KpiCard value={formatNumber(nested(events, "upcoming_events"))} label="Evenements a venir" />
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <MetricChart title="Cash flow mensuel" values={cashFlowValues} />
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><AlertTriangle className="size-4" /> Alertes</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {(data?.alerts || []).map((item) => <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800" key={`${item.type}-${item.message}`}>{item.message}</div>)}
            {!data?.alerts?.length ? <div className="rounded-md border border-border p-3 text-slate-500">Aucune alerte pour cette periode.</div> : null}
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <AnalyticsTable title="Budget par categorie" rows={dashboardRows(data)} />
        <AnalyticsTable title="Rapports enregistres" rows={savedRows(data)} />
      </section>
      <section className="grid gap-4 md:grid-cols-4">
        {([
          ["Sante financiere", nested(performance, "financial_health.score")],
          ["Sante membres", nested(members, "retention_rate")],
          ["Sante projets", nested(performance, "project_health.score")],
          ["Engagement", nested(performance, "overall")],
        ] as Array<[string, unknown]>).map(([label, value]) => <Card key={label}><CardContent className="p-5"><Landmark className="size-5 text-blue-700" /><strong className="mt-3 block">{label} {formatPercent(value)}</strong><div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-700" style={{ width: `${Math.min(numberValue(value), 100)}%` }} /></div></CardContent></Card>)}
      </section>
    </div>
  );
}

function sectionTitle(kind: string) {
  return kind === "finance" ? "Rapport finances" : kind === "contributions" ? "Rapport cotisations" : kind === "members" ? "Rapport membres" : kind === "projects" ? "Rapport projets" : kind === "events" ? "Rapport evenements" : kind === "performance" ? "Performance associative" : "Rapport annuel";
}

function sectionKpis(kind: string, data?: Record<string, unknown>) {
  if (kind === "finance") return [["Recettes", formatMoney(nested(data, "income.value"))], ["Depenses", formatMoney(nested(data, "expense.value"))], ["Solde", formatMoney(nested(data, "balance.value"))], ["Budget consomme", formatPercent(nested(data, "budget.consumption_rate"))]];
  if (kind === "contributions") return [["Attendu", formatMoney(nested(data, "expected"))], ["Collecte", formatMoney(nested(data, "collected"))], ["Restant", formatMoney(nested(data, "unpaid"))], ["Recouvrement", formatPercent(nested(data, "recovery_rate"))]];
  if (kind === "members") return [["Total", formatNumber(nested(data, "total_members"))], ["Actifs", formatNumber(nested(data, "active_members"))], ["Nouveaux", formatNumber(nested(data, "new_members"))], ["Retention", formatPercent(nested(data, "retention_rate"))]];
  if (kind === "projects") return [["Total", formatNumber(nested(data, "total_projects"))], ["Actifs", formatNumber(nested(data, "active_projects"))], ["En retard", formatNumber(nested(data, "delayed_projects"))], ["Progression", formatPercent(nested(data, "average_progress"))]];
  if (kind === "events") return [["Total", formatNumber(nested(data, "total_events"))], ["A venir", formatNumber(nested(data, "upcoming_events"))], ["Participants", formatNumber(nested(data, "participants"))], ["Presence", formatPercent(nested(data, "attendance_rate"))]];
  if (kind === "performance") return [["Global", formatPercent(nested(data, "overall"))], ["Finance", formatPercent(nested(data, "financial_health.score"))], ["Cotisations", formatPercent(nested(data, "contribution_health.score"))], ["Projets", formatPercent(nested(data, "project_health.score"))]];
  return [["Membres", formatNumber(nested(data, "members.total_members"))], ["Recettes", formatMoney(nested(data, "financial.income.value"))], ["Projets", formatNumber(nested(data, "projects.total_projects"))], ["Evenements", formatNumber(nested(data, "events.total_events"))]];
}

function sectionRows(kind: string, data?: Record<string, unknown>): string[][] {
  if (kind === "projects") {
    const rows = ((nested(data, "risk_items") as Array<Record<string, unknown>> | undefined) || []).map((item) => [String(item.name || "-"), formatPercent(item.progress), Array.isArray(item.rules) ? item.rules.join(", ") : "-"]);
    return [["Projet", "Progression", "Risque"], ...rows];
  }
  if (kind === "events") {
    const rows = ((nested(data, "top_by_participants") as Array<Record<string, unknown>> | undefined) || []).map((item) => [String(item.title || "-"), formatNumber(item.participant_count), "Participants"]);
    return [["Evenement", "Volume", "Dimension"], ...rows];
  }
  if (kind === "members") {
    const rows = ((nested(data, "by_status") as Array<Record<string, unknown>> | undefined) || []).map((item) => [String(item.status || "-"), formatNumber(item.count), "-"]);
    return [["Statut", "Membres", "Variation"], ...rows];
  }
  if (kind === "contributions") {
    const rows = ((nested(data, "top_late_members") as Array<Record<string, unknown>> | undefined) || []).map((item) => [String(item.member || "-"), formatMoney(item.amount), `${formatNumber(item.count)} retard(s)`]);
    return [["Membre", "Montant", "Statut"], ...rows];
  }
  return [["Dimension", "Valeur", "Variation"], ["Periode actuelle", sectionKpis(kind, data)[0]?.[1] || "0", "-"], ["Periode", String(nested(data, "period.label") || "Selectionnee"), "-"], ["Derniere mise a jour", new Date().toLocaleDateString("fr-FR"), "-"]];
}

export function ReportSectionView({ workspaceSlug, kind }: Readonly<{ workspaceSlug: string; kind: string }>) {
  const [period, setPeriod] = useState<PeriodCode>("month");
  const title = sectionTitle(kind);
  const query = useQuery({
    queryKey: ["report-section", workspaceSlug, kind, period],
    queryFn: () => getReportSection(workspaceSlug, kind, period)
  });
  const exportMutation = useMutation({
    mutationFn: () => requestReportExport(workspaceSlug, kind, period),
    onSuccess: (exportRequest) => downloadExportPayload(kind, exportRequest.result)
  });
  const data = query.data;

  return (
    <div className="grid gap-6">
      <ReportHeader title={title} description="KPI, tendances, graphiques, tableaux accessibles et export." workspaceSlug={workspaceSlug} lastUpdatedAt={String(nested(data, "last_updated_at") || "")} exportDisabled={query.isLoading || exportMutation.isPending} onExport={() => exportMutation.mutate()} />
      <PeriodFilter value={period} onChange={setPeriod} />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {sectionKpis(kind, data).map(([label, value]) => <KpiCard value={value} label={label} key={label} />)}
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <MetricChart title={`${title} - evolution`} values={seriesValues(nested(data, "monthly") || nested(data, "monthly_growth") || nested(data, "cash_flow") || nested(data, "progress_by_project"))} />
        <AnalyticsTable title={`${title} - details`} rows={sectionRows(kind, data)} />
      </section>
    </div>
  );
}
