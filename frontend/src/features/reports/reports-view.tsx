"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, CalendarDays, CreditCard, Download, FileSpreadsheet, FileText, FolderKanban, Landmark, LineChart, MoreVertical, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { workspacePath } from "@/lib/workspace/routing";
import { AnalyticsTable, EmptyAnalyticsState, KpiCard, MetricChart, PeriodFilter, ReportHeader } from "./report-components";
import { downloadExcelExport, downloadPdfExport, getReportSection, getReportsOverview, requestReportExport } from "./api";
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
  downloadPdfExport(`NOVEX_Rapport_${reportType}_${today}.pdf`, payload);
}

function downloadExcelPayload(reportType: string, payload: unknown) {
  const today = new Date().toISOString().slice(0, 10);
  downloadExcelExport(`NOVEX_Rapport_${reportType}_${today}.xls`, payload);
}

function MiniLine({ values, tone = "blue" }: Readonly<{ values: number[]; tone?: "blue" | "emerald" | "slate" }>) {
  const color = tone === "emerald" ? "#047857" : tone === "slate" ? "#475569" : "#0b63ce";
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${100 - Math.min(Math.max(value, 0), 100)}`).join(" ");

  return (
    <div className="mt-4 h-9 rounded-md bg-[#eaf2ff] px-2 py-1">
      <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">
        <polyline fill="none" points={points} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
      </svg>
    </div>
  );
}

function ProgressLine({ value }: Readonly<{ value: unknown }>) {
  return (
    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-emerald-700" style={{ width: `${Math.min(numberValue(value), 100)}%` }} />
    </div>
  );
}

function ReportMenuCard({
  href,
  icon: Icon,
  iconTone,
  title,
  subtitle,
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  children
}: Readonly<{
  href: string;
  icon: typeof Wallet;
  iconTone: string;
  title: string;
  subtitle: string;
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
  children: React.ReactNode;
}>) {
  return (
    <Link className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md" href={href}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${iconTone}`}>
            <Icon className="size-5" />
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-lg font-black leading-5 tracking-normal text-slate-950">{title}</strong>
            <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">{subtitle}</span>
          </span>
        </div>
        <MoreVertical className="size-5 shrink-0 text-slate-700" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] font-medium text-slate-500">{leftLabel}</p>
          <p className="mt-1 text-2xl font-black leading-none tracking-normal text-slate-950">{leftValue}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-slate-500">{rightLabel}</p>
          <p className="mt-1 text-2xl font-black leading-none tracking-normal text-slate-950">{rightValue}</p>
        </div>
      </div>
      {children}
    </Link>
  );
}

export function ReportsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const [period, setPeriod] = useState<PeriodCode>("month");
  const overviewQuery = useQuery({
    queryKey: ["reports-overview", workspaceSlug, period],
    queryFn: () => getReportsOverview(workspaceSlug, period)
  });
  const exportMutation = useMutation({
    mutationFn: (format: "pdf" | "xlsx") => requestReportExport(workspaceSlug, "overview", period, format),
    onSuccess: (exportRequest) => {
      if (exportRequest.export_format === "xlsx") {
        downloadExcelPayload("global", exportRequest.result);
      } else {
        downloadExportPayload("global", exportRequest.result);
      }
    }
  });
  const data = overviewQuery.data;
  const finance = data?.financial;
  const contributions = data?.contributions;
  const members = data?.members;
  const projects = data?.projects;
  const events = data?.events;
  const performance = data?.performance;
  const cashFlowValues = useMemo(() => seriesValues(nested(finance, "cash_flow") || nested(contributions, "monthly")), [finance, contributions]);
  const periodLabel = data?.period?.label || "Ce mois";
  const isRefreshing = overviewQuery.isFetching && !overviewQuery.isLoading;

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-4 pb-24 pt-5 text-slate-950">
      <header className="mb-5">
        <h1 className="text-3xl font-black tracking-normal">Rapports</h1>
        <p className="mt-2 text-sm leading-5 text-slate-600">Vue d'ensemble et analyses detaillees de votre association.</p>
        <p className="mt-2 text-xs font-bold text-blue-700">{isRefreshing ? "Actualisation..." : `Periode active : ${periodLabel}`}</p>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Button className="min-h-12 rounded-lg bg-[#0863cf] text-white hover:bg-[#0755b3]" disabled={exportMutation.isPending || overviewQuery.isLoading} type="button" onClick={() => exportMutation.mutate("pdf")}>
          <Download className="size-4" />
          Generer PDF
        </Button>
        <Button className="min-h-12 rounded-lg border-slate-300 bg-white text-slate-950" disabled={exportMutation.isPending || overviewQuery.isLoading} type="button" variant="outline" onClick={() => exportMutation.mutate("xlsx")}>
          <FileSpreadsheet className="size-4" />
          Exporter Excel
        </Button>
      </div>

      <PeriodFilter value={period} onChange={setPeriod} />

      {data?.empty_state ? <EmptyAnalyticsState /> : null}

      <section className="mt-5 grid gap-4">
        <ReportMenuCard
          href={workspacePath(workspaceSlug, "reports/finance")}
          icon={Wallet}
          iconTone="bg-blue-50 text-blue-700"
          title="Financier"
          subtitle="Bilan et tresorerie"
          leftLabel={`Recettes (${periodLabel})`}
          leftValue={formatMoney(nested(finance, "income.value"))}
          rightLabel={`Depenses (${periodLabel})`}
          rightValue={formatMoney(nested(finance, "expense.value"))}
        >
          <MiniLine values={cashFlowValues} />
        </ReportMenuCard>

        <ReportMenuCard
          href={workspacePath(workspaceSlug, "reports/contributions")}
          icon={CreditCard}
          iconTone="bg-emerald-50 text-emerald-700"
          title="Cotisations"
          subtitle="Taux de recouvrement"
          leftLabel="Taux actuel"
          leftValue={formatPercent(nested(contributions, "recovery_rate"))}
          rightLabel="En attente"
          rightValue={formatMoney(nested(contributions, "unpaid"))}
        >
          <ProgressLine value={nested(contributions, "recovery_rate")} />
        </ReportMenuCard>

        <ReportMenuCard
          href={workspacePath(workspaceSlug, "reports/members")}
          icon={Users}
          iconTone="bg-slate-100 text-slate-950"
          title="Membres"
          subtitle="Croissance et engagement"
          leftLabel="Total actifs"
          leftValue={formatNumber(nested(members, "active_members"))}
          rightLabel={`Nouveaux (${periodLabel})`}
          rightValue={`+${formatNumber(nested(members, "new_members"))}`}
        >
          <MiniLine values={seriesValues(nested(members, "monthly_growth"), ["count"])} tone="slate" />
        </ReportMenuCard>

        <ReportMenuCard
          href={workspacePath(workspaceSlug, "reports/projects")}
          icon={FolderKanban}
          iconTone="bg-amber-50 text-amber-700"
          title="Projets"
          subtitle="Execution operationnelle"
          leftLabel="Actifs"
          leftValue={formatNumber(nested(projects, "active_projects"))}
          rightLabel="En retard"
          rightValue={formatNumber(nested(projects, "delayed_projects"))}
        >
          <ProgressLine value={nested(projects, "average_progress")} />
        </ReportMenuCard>

        <ReportMenuCard
          href={workspacePath(workspaceSlug, "reports/events")}
          icon={CalendarDays}
          iconTone="bg-purple-50 text-purple-700"
          title="Evenements"
          subtitle="Participation et presence"
          leftLabel="A venir"
          leftValue={formatNumber(nested(events, "upcoming_events"))}
          rightLabel="Presence"
          rightValue={formatPercent(nested(events, "attendance_rate"))}
        >
          <ProgressLine value={nested(events, "attendance_rate")} />
        </ReportMenuCard>

        <ReportMenuCard
          href={workspacePath(workspaceSlug, "reports/performance")}
          icon={LineChart}
          iconTone="bg-blue-50 text-blue-700"
          title="Performance"
          subtitle="Sante globale"
          leftLabel="Score global"
          leftValue={formatPercent(nested(performance, "overall"))}
          rightLabel="Documents"
          rightValue={formatNumber(nested(data?.documents, "total_documents"))}
        >
          <MiniLine values={[numberValue(nested(performance, "financial_health.score")), numberValue(nested(performance, "contribution_health.score")), numberValue(nested(performance, "project_health.score")), numberValue(nested(performance, "event_health.score")), numberValue(nested(performance, "overall"))]} />
        </ReportMenuCard>
      </section>

      <section className="mt-5 flex gap-2 overflow-x-auto border-b border-border pb-2">
        {reportTabs.map(([label, path, Icon]) => <Link className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100" href={workspacePath(workspaceSlug, path)} key={path}><Icon className="size-4" /> {label}</Link>)}
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <MetricChart title="Cash flow mensuel" values={cashFlowValues} />
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><AlertTriangle className="size-4" /> Alertes</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {(data?.alerts || []).map((item) => <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800" key={`${item.type}-${item.message}`}>{item.message}</div>)}
            {!data?.alerts?.length ? <div className="rounded-md border border-border p-3 text-slate-500">Aucune alerte pour cette periode.</div> : null}
          </CardContent>
        </Card>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <AnalyticsTable title="Budget par categorie" rows={dashboardRows(data)} />
        <AnalyticsTable title="Rapports enregistres" rows={savedRows(data)} />
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-4">
        {([
          ["Sante financiere", nested(performance, "financial_health.score")],
          ["Sante membres", nested(members, "retention_rate")],
          ["Sante projets", nested(performance, "project_health.score")],
          ["Engagement", nested(performance, "overall")],
        ] as Array<[string, unknown]>).map(([label, value]) => <Card key={label}><CardContent className="p-5"><Landmark className="size-5 text-blue-700" /><strong className="mt-3 block">{label} {formatPercent(value)}</strong><div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-700" style={{ width: `${Math.min(numberValue(value), 100)}%` }} /></div></CardContent></Card>)}
      </section>
    </main>
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
