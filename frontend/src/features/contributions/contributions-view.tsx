"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BarChart3, Bell, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, Download, Filter, LineChart, Loader2, Plus, Search, Send, ShieldCheck, Sparkles, TrendingUp, Users, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { workspacePath } from "@/lib/workspace/routing";
import {
  getContributionAnalytics,
  getContributionDashboard,
  listContributionCampaigns,
  listContributionCategories,
  listContributionGroups,
  listContributionMembers,
  listContributions,
  recordContributionPayment,
  requestContributionExport,
  sendContributionReminder
} from "./api";
import type { ContributionAnalytics, ContributionDashboard, ContributionFilters, ContributionPeriod, ContributionResource, ContributionStatus } from "./api";
import { CONTRIBUTION_STATUSES } from "./contribution-status";

const periods: Array<{ value: ContributionPeriod; label: string }> = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Ce mois" },
  { value: "quarter", label: "Trimestre" },
  { value: "semester", label: "Semestre" },
  { value: "year", label: "Annee" },
  { value: "all", label: "Tout" }
];

const statusConfig: Record<string, { label: string; className: string; dot: string }> = {
  PAID: { label: "A jour", className: "bg-emerald-50 text-emerald-700 ring-emerald-100", dot: "bg-emerald-500" },
  PARTIALLY_PAID: { label: "Partiel", className: "bg-amber-50 text-amber-700 ring-amber-100", dot: "bg-amber-500" },
  PENDING: { label: "Non paye", className: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400" },
  OVERDUE: { label: "En retard", className: "bg-red-50 text-red-700 ring-red-100", dot: "bg-red-500" },
  WAIVED: { label: "Exonere", className: "bg-blue-50 text-blue-700 ring-blue-100", dot: "bg-blue-500" },
  CANCELLED: { label: "Annule", className: "bg-zinc-100 text-zinc-500 ring-zinc-200", dot: "bg-zinc-400" }
};

const paymentMethods = [
  { value: "cash", label: "Especes" },
  { value: "external_mobile_money", label: "Mobile Money" },
  { value: "bank_transfer", label: "Virement" },
  { value: "check", label: "Cheque" },
  { value: "manual", label: "Manuel" },
  { value: "other", label: "Autre" }
] as const;

type SmallMetric = {
  label: string;
  value: unknown;
  icon: LucideIcon;
  detail: string;
};

function numberValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatMoney(value: unknown, currency = "FCFA") {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(numberValue(value))} ${currency}`;
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(numberValue(value));
}

function formatPercent(value: unknown) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(numberValue(value))}%`;
}

function shortDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function trendLabel(trend?: { value: number | null; direction: "up" | "down" | "flat" }) {
  if (!trend || trend.value === null) return "Reference indisponible";
  const prefix = trend.value > 0 ? "+" : "";
  return `${prefix}${formatPercent(trend.value)} vs periode precedente`;
}

function progress(value: unknown) {
  return Math.max(0, Math.min(numberValue(value), 100));
}

function queryStatus(status: string) {
  return status && status !== "all" ? status : undefined;
}

function KpiCard({ title, value, detail, tone, icon: Icon, progressValue }: Readonly<{ title: string; value: string; detail: string; tone: "blue" | "emerald" | "amber" | "red" | "slate"; icon: LucideIcon; progressValue?: number }>) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-100 text-slate-700"
  }[tone];

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-500">{title}</p>
            <strong className="mt-2 block text-2xl font-black tracking-normal text-slate-950">{value}</strong>
          </div>
          <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${toneClass}`}>
            <Icon className="size-5" />
          </span>
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-500">{detail}</p>
        {progressValue !== undefined ? (
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-700" style={{ width: `${progress(progressValue)}%` }} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MiniLineChart({ rows, metric }: Readonly<{ rows: ContributionAnalytics["series"]; metric: "amount" | "rate" }>) {
  const values = rows.map((row) => (metric === "rate" ? (numberValue(row.expected) ? (numberValue(row.collected) / numberValue(row.expected)) * 100 : 0) : numberValue(row.collected)));
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${100 - (value / max) * 88}`).join(" ");
  return (
    <div className="h-56 rounded-xl bg-gradient-to-b from-blue-50 to-white p-4">
      {rows.length ? (
        <svg className="h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100" role="img" aria-label="Evolution des cotisations">
          <polyline fill="none" points={points} stroke="#0b63ce" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          {values.map((value, index) => (
            <circle className="cursor-pointer" cx={(index / Math.max(values.length - 1, 1)) * 100} cy={100 - (value / max) * 88} fill="#0b63ce" key={`${rows[index].period}-${index}`} r="2.6">
              <title>{`${shortDate(rows[index].period)} - ${metric === "rate" ? formatPercent(value) : formatMoney(value)}`}</title>
            </circle>
          ))}
        </svg>
      ) : (
        <div className="grid h-full place-items-center text-center text-sm font-semibold text-slate-500">Aucune evolution disponible.</div>
      )}
    </div>
  );
}

function StatusBars({ dashboard }: Readonly<{ dashboard?: ContributionDashboard }>) {
  const rows = [
    { key: "PAID", label: "A jour", count: dashboard?.members_paid || 0 },
    { key: "PARTIALLY_PAID", label: "Partiel", count: dashboard?.members_partial || 0 },
    { key: "PENDING", label: "Non paye", count: dashboard?.members_unpaid || 0 },
    { key: "OVERDUE", label: "En retard", count: dashboard?.members_overdue || 0 }
  ];
  const total = Math.max(rows.reduce((sum, row) => sum + row.count, 0), 1);
  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <div key={row.key}>
          <div className="mb-1 flex items-center justify-between text-sm font-semibold text-slate-700">
            <span className="flex items-center gap-2"><span className={`size-2 rounded-full ${statusConfig[row.key].dot}`} />{row.label}</span>
            <span>{formatNumber(row.count)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${statusConfig[row.key].dot}`} style={{ width: `${(row.count / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: Readonly<{ status: ContributionStatus }>) {
  const config = statusConfig[status] || statusConfig.PENDING;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ring-1 ${config.className}`}><span className={`size-1.5 rounded-full ${config.dot}`} />{config.label}</span>;
}

function PaymentDrawer({ contribution, onClose, onSubmit, isPending, error }: Readonly<{ contribution: ContributionResource | null; onClose: () => void; onSubmit: (payload: { amount: string; payment_method: string; document_reference: string; paid_at: string }) => void; isPending: boolean; error?: string }>) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 16));

  if (!contribution) return null;
  const nextRemaining = Math.max(numberValue(contribution.remaining_amount) - numberValue(amount), 0);
  const isOverpayment = numberValue(amount) > numberValue(contribution.remaining_amount);

  return (
    <div className="fixed inset-0 z-50 grid items-end bg-slate-950/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <form
        className="max-h-[92vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:mx-auto sm:w-full sm:max-w-lg sm:rounded-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ amount, payment_method: method, document_reference: reference, paid_at: new Date(paidAt).toISOString() });
        }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-blue-700">Paiement manuel</p>
            <h2 className="mt-1 text-2xl font-black tracking-normal text-slate-950">{contribution.member_name}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Reste actuel: {formatMoney(contribution.remaining_amount, contribution.currency || "FCFA")}</p>
          </div>
          <button className="rounded-full px-3 py-2 text-sm font-black text-slate-500 hover:bg-slate-100" type="button" onClick={onClose}>Fermer</button>
        </div>
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-black text-slate-800">
            Montant
            <input className="min-h-12 rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-blue-600" min="1" required type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-black text-slate-800">
            Date du paiement
            <input className="min-h-12 rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-blue-600" required type="datetime-local" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-black text-slate-800">
            Mode de paiement
            <select className="min-h-12 rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-blue-600" value={method} onChange={(event) => setMethod(event.target.value)}>
              {paymentMethods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-black text-slate-800">
            Reference transaction
            <input className="min-h-12 rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-blue-600" placeholder="Wave, Orange Money, virement..." value={reference} onChange={(event) => setReference(event.target.value)} />
          </label>
        </div>
        <div className={`mt-5 rounded-xl p-4 text-sm font-semibold ${isOverpayment ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"}`}>
          {isOverpayment ? "Le montant depasse le reste a payer. NOVEX n'ignore pas le surpaiement: verifie avant de confirmer." : `Reste apres paiement: ${formatMoney(nextRemaining, contribution.currency || "FCFA")}`}
        </div>
        {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button className="min-h-12" type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button className="min-h-12" disabled={isPending || !amount || isOverpayment} type="submit">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Enregistrer
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ContributionsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<ContributionPeriod>("month");
  const [campaign, setCampaign] = useState("all");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [group, setGroup] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("due_date");
  const [page, setPage] = useState(1);
  const [selectedContribution, setSelectedContribution] = useState<ContributionResource | null>(null);
  const [notice, setNotice] = useState("");

  const filters: ContributionFilters = useMemo(
    () => ({ period, campaign, category, group, paymentMethod, status: queryStatus(status), search, ordering, page, pageSize: 12 }),
    [campaign, category, group, ordering, page, paymentMethod, period, search, status]
  );

  const dashboardQuery = useQuery({ queryKey: ["contributions-dashboard", workspaceSlug, period, campaign], queryFn: () => getContributionDashboard(workspaceSlug, period, campaign) });
  const analyticsQuery = useQuery({ queryKey: ["contributions-analytics", workspaceSlug, period, campaign], queryFn: () => getContributionAnalytics(workspaceSlug, period, campaign) });
  const campaignsQuery = useQuery({ queryKey: ["contribution-campaigns", workspaceSlug], queryFn: () => listContributionCampaigns(workspaceSlug) });
  const categoriesQuery = useQuery({ queryKey: ["contribution-categories", workspaceSlug], queryFn: () => listContributionCategories(workspaceSlug) });
  const groupsQuery = useQuery({ queryKey: ["contribution-groups", workspaceSlug], queryFn: () => listContributionGroups(workspaceSlug) });
  const contributionsQuery = useQuery({ queryKey: ["contributions", workspaceSlug, filters], queryFn: () => listContributions(workspaceSlug, filters) });
  const membersQuery = useQuery({ queryKey: ["contribution-members", workspaceSlug, status], queryFn: () => listContributionMembers(workspaceSlug, { status: queryStatus(status) }) });

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["contributions-dashboard", workspaceSlug] }),
      queryClient.invalidateQueries({ queryKey: ["contributions-analytics", workspaceSlug] }),
      queryClient.invalidateQueries({ queryKey: ["contributions", workspaceSlug] }),
      queryClient.invalidateQueries({ queryKey: ["contribution-members", workspaceSlug] })
    ]);
  };

  const paymentMutation = useMutation({
    mutationFn: (payload: { amount: string; payment_method: string; document_reference: string; paid_at: string }) => {
      if (!selectedContribution) throw new Error("Selectionne une cotisation.");
      return recordContributionPayment(workspaceSlug, selectedContribution.id, payload);
    },
    onSuccess: async () => {
      setSelectedContribution(null);
      setNotice("Paiement enregistre. Les KPI ont ete recalcules.");
      await refreshAll();
    }
  });

  const reminderMutation = useMutation({
    mutationFn: (contributionId: number) => sendContributionReminder(workspaceSlug, contributionId),
    onSuccess: async () => {
      setNotice("Relance ajoutee au systeme de communication.");
      await refreshAll();
    }
  });

  const exportMutation = useMutation({
    mutationFn: () => requestContributionExport(workspaceSlug, filters, "CSV"),
    onSuccess: (result) => setNotice(`Export filtre cree (#${result.id}). Il sera disponible dans les exports Cotisations.`)
  });

  const dashboard = dashboardQuery.data;
  const analytics = analyticsQuery.data;
  const contributions = contributionsQuery.data?.results || [];
  const currentCurrency = contributions[0]?.currency || campaignsQuery.data?.[0]?.currency || "FCFA";
  const isLoading = dashboardQuery.isLoading || analyticsQuery.isLoading || contributionsQuery.isLoading;
  const error = dashboardQuery.error || analyticsQuery.error || contributionsQuery.error || campaignsQuery.error || membersQuery.error;

  const selectedCampaign = campaignsQuery.data?.find((item) => String(item.id) === campaign);
  const trend = analytics?.trend || {};
  const totalPages = Math.max(Math.ceil((contributionsQuery.data?.count || 0) / 12), 1);
  const membersConcerned = dashboard?.members_concerned || membersQuery.data?.length || 0;
  const averagePaid = numberValue(dashboard?.members_paid) || numberValue(dashboard?.members_partial) ? numberValue(dashboard?.total_collected) / Math.max(numberValue(dashboard?.members_paid) + numberValue(dashboard?.members_partial), 1) : 0;
  const smallMetrics: SmallMetric[] = [
    { label: "Membres concernes", value: membersConcerned, icon: Users, detail: "Total dans la periode" },
    { label: "Membres a jour", value: dashboard?.members_paid, icon: CheckCircle2, detail: "Paiement complet" },
    { label: "Paiements partiels", value: dashboard?.members_partial, icon: CreditCard, detail: "Reste a completer" },
    { label: "Non payeurs", value: dashboard?.members_unpaid, icon: Bell, detail: "Aucun paiement" },
    { label: "Echeances proches", value: dashboard?.upcoming_due, icon: CalendarDays, detail: "7 prochains jours" }
  ];

  return (
    <div className="grid gap-6 pb-24">
      <PageHeader
        title="Cotisations"
        description="Suivez la collecte, les paiements et les retards de cotisations."
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
              {exportMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Exporter
            </Button>
            <Button type="button" onClick={() => setSelectedContribution(contributions.find((item) => numberValue(item.remaining_amount) > 0) || contributions[0] || null)}>
              <Plus className="size-4" />
              Enregistrer un paiement
            </Button>
          </>
        }
      />

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {periods.map((item) => (
            <button
              className={`min-h-10 shrink-0 rounded-lg px-4 text-sm font-black transition ${period === item.value ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"}`}
              key={item.value}
              type="button"
              onClick={() => {
                setPeriod(item.value);
                setPage(1);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
            <Search className="size-4" />
            <input className="min-w-0 flex-1 bg-transparent font-semibold outline-none" placeholder="Rechercher un membre..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </label>
          <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold" value={campaign} onChange={(event) => { setCampaign(event.target.value); setPage(1); }}>
            <option value="all">Toutes les campagnes</option>
            {(campaignsQuery.data || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="all">Tous les statuts</option>
            {CONTRIBUTION_STATUSES.slice(0, 4).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold" value={ordering} onChange={(event) => setOrdering(event.target.value)}>
            <option value="due_date">Tri: echeance</option>
            <option value="amount_due">Montant attendu</option>
            <option value="amount_paid">Montant paye</option>
            <option value="status">Statut</option>
            <option value="-created_at">Recent</option>
          </select>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">Toutes categories</option>
            {(categoriesQuery.data || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold" value={group} onChange={(event) => setGroup(event.target.value)}>
            <option value="all">Tous les groupes</option>
            {(groupsQuery.data || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
            <option value="all">Tous les modes de paiement</option>
            {paymentMethods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
      </section>

      {notice ? <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">{notice}</div> : null}
      {error ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle className="size-5 shrink-0" />
          {error instanceof Error ? error.message : "Impossible de charger les cotisations."}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Total collecte" value={formatMoney(dashboard?.total_collected, currentCurrency)} detail={trendLabel(trend.collected)} tone="blue" icon={Wallet} progressValue={numberValue(dashboard?.collection_rate)} />
        <KpiCard title="Reste a collecter" value={formatMoney(dashboard?.total_remaining, currentCurrency)} detail={`${formatMoney(dashboard?.total_expected, currentCurrency)} attendus`} tone="amber" icon={CreditCard} />
        <KpiCard title="Taux de recouvrement" value={formatPercent(dashboard?.collection_rate)} detail={trendLabel(trend.collection_rate)} tone="emerald" icon={TrendingUp} progressValue={numberValue(dashboard?.collection_rate)} />
        <KpiCard title="Montant en retard" value={formatMoney(analytics?.overdue_amount || dashboard?.total_overdue, currentCurrency)} detail={`${formatNumber(dashboard?.members_overdue || analytics?.overdue_members)} membres en retard`} tone="red" icon={AlertCircle} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {smallMetrics.map(({ label, value, icon: Icon, detail }) => (
          <Card className="border-slate-200 shadow-sm" key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className="grid size-10 place-items-center rounded-lg bg-slate-100 text-slate-700"><Icon className="size-5" /></span>
              <div>
                <strong className="block text-xl font-black text-slate-950">{formatNumber(value)}</strong>
                <span className="text-xs font-semibold text-slate-500">{label} - {detail}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="border-slate-200 shadow-sm xl:col-span-8">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base text-slate-950"><LineChart className="size-4 text-blue-700" /> Evolution des cotisations</CardTitle>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">12 derniers mois</span>
          </CardHeader>
          <CardContent>
            <MiniLineChart rows={analytics?.series || []} metric="amount" />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3"><span className="text-xs font-semibold text-slate-500">Meilleur total</span><strong className="block text-lg">{formatMoney(Math.max(...(analytics?.series || []).map((row) => numberValue(row.collected)), 0), currentCurrency)}</strong></div>
              <div className="rounded-lg bg-slate-50 p-3"><span className="text-xs font-semibold text-slate-500">Montant moyen paye</span><strong className="block text-lg">{formatMoney(averagePaid, currentCurrency)}</strong></div>
              <div className="rounded-lg bg-slate-50 p-3"><span className="text-xs font-semibold text-slate-500">Objectif</span><strong className="block text-lg">{formatPercent(analytics?.collection_goal)}</strong></div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:col-span-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="size-4 text-blue-700" /> Statuts</CardTitle></CardHeader>
            <CardContent><StatusBars dashboard={dashboard} /></CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4 text-blue-700" /> Performance</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Campagnes actives</span><strong>{formatNumber(dashboard?.active_campaigns)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Cotisations affichees</span><strong>{formatNumber(contributionsQuery.data?.count || 0)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Campagne filtree</span><strong className="max-w-40 truncate">{selectedCampaign?.name || "Toutes"}</strong></div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Filter className="size-4 text-blue-700" /> Collecte par categorie</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {(analytics?.type_performance || []).filter((item) => numberValue(item.expected) > 0 || numberValue(item.collected) > 0).slice(0, 6).map((item) => (
              <div className="rounded-lg border border-slate-100 p-3" key={item.type}>
                <div className="flex justify-between text-sm font-black"><span>{item.label}</span><span>{formatPercent(item.collection_rate)}</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${progress(item.collection_rate)}%` }} /></div>
                <p className="mt-2 text-xs font-semibold text-slate-500">{formatMoney(item.collected, currentCurrency)} collectes sur {formatMoney(item.expected, currentCurrency)}</p>
              </div>
            ))}
            {!analytics?.type_performance?.some((item) => numberValue(item.expected) > 0 || numberValue(item.collected) > 0) ? <p className="text-sm font-semibold text-slate-500">Aucune categorie de collecte disponible.</p> : null}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="size-4 text-blue-700" /> Modes de paiement</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {(analytics?.payment_methods || []).map((item) => (
              <div className="rounded-lg border border-slate-100 p-3" key={item.method}>
                <div className="flex justify-between text-sm font-black"><span>{item.label}</span><span>{formatMoney(item.amount, currentCurrency)}</span></div>
                <p className="mt-1 text-xs font-semibold text-slate-500">{formatNumber(item.count)} paiement(s)</p>
              </div>
            ))}
            {!analytics?.payment_methods?.length ? <p className="text-sm font-semibold text-slate-500">Aucun paiement valide pour cette periode.</p> : null}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="size-4 text-blue-700" /> Insights</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-lg bg-blue-50 p-4 text-sm font-semibold text-blue-900">Le taux de recouvrement actuel est de {formatPercent(dashboard?.collection_rate)} pour {formatMoney(dashboard?.total_expected, currentCurrency)} attendus.</div>
            <div className="rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900">{formatNumber(dashboard?.members_overdue)} membres sont en retard pour {formatMoney(analytics?.overdue_amount || 0, currentCurrency)}.</div>
            <div className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-700">Assistant IA pret: les donnees autorisees du workspace peuvent alimenter l'analyse des cotisations.</div>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="text-xl font-black tracking-normal text-slate-950">Suivi des cotisations</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Membre, montant attendu, paiement, reste, statut et actions.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => reminderMutation.mutate(contributions.find((item) => item.status === "OVERDUE")?.id || contributions[0]?.id)} disabled={reminderMutation.isPending || !contributions.length}>
            {reminderMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Relancer
          </Button>
        </div>
        <div className="hidden grid-cols-[1.2fr_120px_120px_120px_120px_130px_210px] gap-3 border-b border-slate-100 px-4 py-3 text-xs font-black uppercase text-slate-500 lg:grid">
          <span>Membre</span><span>Attendu</span><span>Paye</span><span>Reste</span><span>Statut</span><span>Echeance</span><span>Actions</span>
        </div>
        <div className="divide-y divide-slate-100">
          {contributions.map((item) => (
            <div className="grid gap-3 p-4 lg:grid-cols-[1.2fr_120px_120px_120px_120px_130px_210px] lg:items-center" key={item.id}>
              <Link className="min-w-0" href={workspacePath(workspaceSlug, `members/${item.member}`)}>
                <strong className="block truncate text-base text-slate-950">{item.member_name}</strong>
                <span className="text-xs font-semibold text-slate-500">Cotisation #{item.id}</span>
              </Link>
              <span className="text-sm font-black">{formatMoney(item.amount_due, item.currency || currentCurrency)}</span>
              <span className="text-sm font-black text-blue-700">{formatMoney(item.amount_paid, item.currency || currentCurrency)}</span>
              <span className="text-sm font-black text-amber-700">{formatMoney(item.remaining_amount, item.currency || currentCurrency)}</span>
              <StatusBadge status={item.status} />
              <span className="text-sm font-semibold text-slate-600">{shortDate(item.due_date)}</span>
              <div className="flex flex-wrap gap-2">
                <Button className="min-h-9 px-3" type="button" variant="outline" onClick={() => setSelectedContribution(item)}>Paiement</Button>
                <Button className="min-h-9 px-3" type="button" variant="outline" onClick={() => reminderMutation.mutate(item.id)} disabled={reminderMutation.isPending || item.status === "PAID"}>Relancer</Button>
                <Link className="inline-flex min-h-9 items-center rounded-md px-3 text-sm font-black text-blue-700 hover:bg-blue-50" href={workspacePath(workspaceSlug, `members/${item.member}`)}>Profil</Link>
              </div>
            </div>
          ))}
          {!contributions.length ? (
            <div className="grid place-items-center p-10 text-center">
              <CreditCard className="size-9 text-blue-700" />
              <h3 className="mt-3 text-lg font-black">Aucune cotisation enregistree</h3>
              <p className="mt-1 max-w-md text-sm font-semibold text-slate-500">Creez ou activez une campagne pour generer les obligations de paiement des membres.</p>
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 p-4">
          <Button type="button" variant="outline" disabled={page <= 1 || isLoading} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="size-4" /> Precedent</Button>
          <span className="text-sm font-black text-slate-600">Page {page} / {totalPages}</span>
          <Button type="button" variant="outline" disabled={page >= totalPages || isLoading} onClick={() => setPage((current) => current + 1)}>Suivant <ChevronRight className="size-4" /></Button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="border-slate-200 shadow-sm xl:col-span-2">
          <CardHeader><CardTitle className="text-base">Membres non a jour prioritaires</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {(analytics?.top_unpaid || []).slice(0, 5).map((member) => (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3" key={member.member_id}>
                <div className="min-w-0"><strong className="block truncate text-sm">{member.member_name}</strong><span className="text-xs font-semibold text-slate-500">{member.phone || "Telephone non renseigne"}</span></div>
                <strong className="text-sm text-red-700">{formatMoney(member.amount_remaining, currentCurrency)}</strong>
              </div>
            ))}
            {!analytics?.top_unpaid?.length ? <p className="text-sm font-semibold text-slate-500">Aucun retard prioritaire.</p> : null}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle className="text-base">Retards par anciennete</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {(analytics?.overdue_segments || []).map((segment) => (
              <div className="flex justify-between text-sm font-semibold" key={segment.label}>
                <span className="text-slate-500">{segment.label}</span>
                <strong>{formatNumber(segment.count)} - {formatMoney(segment.amount, currentCurrency)}</strong>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <PaymentDrawer
        contribution={selectedContribution}
        error={paymentMutation.error instanceof Error ? paymentMutation.error.message : undefined}
        isPending={paymentMutation.isPending}
        onClose={() => setSelectedContribution(null)}
        onSubmit={(payload) => paymentMutation.mutate(payload)}
      />
    </div>
  );
}
