"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, Download, Loader2, Plus, Save, Search, Send, SlidersHorizontal, Sparkles, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { workspacePath } from "@/lib/workspace/routing";
import {
  activateContributionCampaign,
  createContributionCampaign,
  getContributionAnalytics,
  getContributionDashboard,
  listContributionCampaigns,
  listContributionCategories,
  listContributionGroups,
  listContributions,
  recordContributionPayment,
  requestContributionExport,
  sendContributionReminder
} from "./api";
import type { ContributionFilters, ContributionPeriod, ContributionResource, ContributionStatus } from "./api";
import { CONTRIBUTION_STATUSES } from "./contribution-status";

const periods: Array<{ value: ContributionPeriod; label: string }> = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "quarter", label: "Trimestre" },
  { value: "semester", label: "Semestre" },
  { value: "year", label: "Cette annee" },
  { value: "all", label: "Tout" }
];

const statusStyles: Record<string, { label: string; badge: string; avatar: string }> = {
  PAID: { label: "Paye", badge: "bg-emerald-100 text-emerald-700", avatar: "bg-blue-100 text-blue-700" },
  PARTIALLY_PAID: { label: "Partiel", badge: "bg-amber-100 text-amber-700", avatar: "bg-amber-100 text-amber-700" },
  PENDING: { label: "En attente", badge: "bg-slate-200 text-slate-600", avatar: "bg-slate-200 text-slate-600" },
  OVERDUE: { label: "Impaye", badge: "bg-red-100 text-red-700", avatar: "bg-red-100 text-red-700" },
  WAIVED: { label: "Exonere", badge: "bg-blue-100 text-blue-700", avatar: "bg-blue-100 text-blue-700" },
  CANCELLED: { label: "Annule", badge: "bg-zinc-200 text-zinc-600", avatar: "bg-zinc-200 text-zinc-600" }
};

const paymentMethods = [
  { value: "cash", label: "Especes" },
  { value: "external_mobile_money", label: "Mobile Money" },
  { value: "bank_transfer", label: "Virement" },
  { value: "check", label: "Cheque" },
  { value: "manual", label: "Manuel" },
  { value: "other", label: "Autre" }
] as const;

const monthOptions = [
  "Janvier",
  "Fevrier",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Aout",
  "Septembre",
  "Octobre",
  "Novembre",
  "Decembre"
];

function numberValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function compactMoney(value: unknown, currency = "FCFA") {
  const numeric = numberValue(value);
  const absolute = Math.abs(numeric);
  if (absolute >= 1_000_000) return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(numeric / 1_000_000)}M ${currency}`;
  if (absolute >= 1_000) return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(numeric / 1_000)}K ${currency}`;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(numeric)} ${currency}`;
}

function formatMoney(value: unknown, currency = "FCFA") {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(numberValue(value))} ${currency}`;
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(numberValue(value));
}

function progress(value: unknown) {
  return Math.max(0, Math.min(numberValue(value), 100));
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "NV";
}

function shortCampaignLabel(item: ContributionResource) {
  return item.due_date ? `Cotisation ${new Date(item.due_date).getFullYear()}` : `Cotisation #${item.id}`;
}

function contributionName(item: ContributionResource, campaigns: Array<{ id: number; name: string }>) {
  return campaigns.find((campaign) => campaign.id === item.campaign)?.name || shortCampaignLabel(item);
}

function tableStatus(item: ContributionResource, selectedMonth: number, selectedYear: number, today: Date) {
  const style = statusStyles[item.status] || statusStyles.PENDING;
  if (item.status !== "PENDING") return style;
  const isSelectedCurrentMonth = selectedMonth === today.getMonth() && selectedYear === today.getFullYear();
  return isSelectedCurrentMonth ? statusStyles.PENDING : { ...statusStyles.OVERDUE, label: "Impaye" };
}

function queryStatus(status: string) {
  return status && status !== "all" ? status : undefined;
}

function KpiTile({ title, value, icon, tone, pill, progressValue }: Readonly<{ title: string; value: string; icon: React.ReactNode; tone: "blue" | "green" | "red" | "slate"; pill?: string; progressValue?: number }>) {
  const titleColor = tone === "red" ? "text-red-600" : tone === "green" ? "text-emerald-700" : "text-slate-700";
  return (
    <section className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`flex items-center gap-2 text-xs font-black ${titleColor}`}>
            {icon}
            <span className="leading-tight">{title}</span>
          </p>
          <div className="mt-3 flex min-w-0 items-end gap-1">
            <strong className="text-[2.65rem] font-black leading-none tracking-normal text-slate-950">{value.split(" ")[0]}</strong>
            <span className="pb-1 text-sm font-semibold text-slate-500">{value.split(" ").slice(1).join(" ")}</span>
          </div>
        </div>
        {pill ? <span className="max-w-[112px] rounded-md bg-emerald-100 px-2 py-1 text-[10px] font-black leading-tight text-emerald-700">{pill}</span> : null}
      </div>
      {progressValue !== undefined ? (
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-700" style={{ width: `${progress(progressValue)}%` }} />
        </div>
      ) : null}
    </section>
  );
}

function PieChart({ segments, center, caption }: Readonly<{ segments: Array<{ label: string; value: number; color: string }>; center: string; caption: string }>) {
  const total = Math.max(segments.reduce((sum, item) => sum + item.value, 0), 1);
  let cursor = 0;
  const gradient = segments
    .map((item) => {
      const start = cursor;
      const end = cursor + (item.value / total) * 100;
      cursor = end;
      return `${item.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="grid place-items-center gap-3">
      <div className="relative grid size-40 place-items-center rounded-full" style={{ background: `conic-gradient(${gradient || "#e5e7eb 0% 100%"})` }}>
        <div className="grid size-24 place-items-center rounded-full bg-white text-center shadow-inner">
          <strong className="text-2xl font-black leading-none">{center}</strong>
          <span className="text-[10px] font-bold text-slate-500">{caption}</span>
        </div>
      </div>
      <div className="grid w-full grid-cols-2 gap-2">
        {segments.map((item) => (
          <div className="flex min-w-0 items-center gap-2 text-xs font-bold text-slate-600" key={item.label}>
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="truncate">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartPanel({ period, onPeriodChange, collected, remaining, overdue, rate }: Readonly<{ period: ContributionPeriod; onPeriodChange: (period: ContributionPeriod) => void; collected: number; remaining: number; overdue: number; rate: number }>) {
  return (
    <section className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-black leading-tight tracking-normal text-slate-950">Evolution des<br />collectes</h2>
        <select className="h-9 max-w-[132px] rounded-md border border-slate-200 bg-white px-2 text-xs font-bold outline-none" value={period} onChange={(event) => onPeriodChange(event.target.value as ContributionPeriod)}>
          {periods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>
      <div className="mt-5 w-full rounded-lg border border-slate-100 bg-[#f7f8fa] p-4">
        <PieChart
          caption="Recouvrement"
          center={`${Math.round(rate)}%`}
          segments={[
            { label: "Collecte", value: collected, color: "#0b63ce" },
            { label: "Reste", value: remaining, color: "#e5e7eb" },
            { label: "Retard", value: overdue, color: "#ef4444" }
          ]}
        />
      </div>
    </section>
  );
}

function PaymentDrawer({ contribution, onClose, onSubmit, isPending, error }: Readonly<{ contribution: ContributionResource | null; onClose: () => void; onSubmit: (payload: { amount: string; payment_method: string; document_reference: string; paid_at: string }) => void; isPending: boolean; error?: string }>) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 16));
  if (!contribution) return null;

  const isOverpayment = numberValue(amount) > numberValue(contribution.remaining_amount);
  const remaining = Math.max(numberValue(contribution.remaining_amount) - numberValue(amount), 0);

  return (
    <div className="fixed inset-0 z-50 grid items-end bg-slate-950/40" role="dialog" aria-modal="true">
      <form
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ amount, payment_method: method, document_reference: reference, paid_at: new Date(paidAt).toISOString() });
        }}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-blue-700">Paiement manuel</p>
            <h2 className="truncate text-2xl font-black tracking-normal">{contribution.member_name}</h2>
            <p className="text-sm font-semibold text-slate-500">Reste: {formatMoney(contribution.remaining_amount, contribution.currency || "FCFA")}</p>
          </div>
          <button className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-black" type="button" onClick={onClose}>Fermer</button>
        </div>
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-black">Montant<input className="min-h-12 rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-blue-600" min="1" required type="number" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          <label className="grid gap-2 text-sm font-black">Date<input className="min-h-12 rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-blue-600" required type="datetime-local" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} /></label>
          <label className="grid gap-2 text-sm font-black">Mode<select className="min-h-12 rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-blue-600" value={method} onChange={(event) => setMethod(event.target.value)}>{paymentMethods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-black">Reference<input className="min-h-12 rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-blue-600" value={reference} onChange={(event) => setReference(event.target.value)} /></label>
        </div>
        <div className={`mt-4 rounded-xl p-3 text-sm font-bold ${isOverpayment ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"}`}>
          {isOverpayment ? "Le montant depasse le reste a payer. Verifie avant de confirmer." : `Reste apres paiement: ${formatMoney(remaining, contribution.currency || "FCFA")}`}
        </div>
        {error ? <p className="mt-3 text-sm font-bold text-red-600">{error}</p> : null}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button className="min-h-12" type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button className="min-h-12" disabled={isPending || !amount || isOverpayment} type="submit">{isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Enregistrer</Button>
        </div>
      </form>
    </div>
  );
}

function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function contributionPeriodLabel(periodicity: string) {
  if (periodicity === "MONTHLY") return "Cotisation mensuelle";
  if (periodicity === "QUARTERLY") return "Cotisation trimestrielle";
  if (periodicity === "YEARLY") return "Cotisation annuelle";
  return "Cotisation";
}

function contributionTypeForPeriodicity(periodicity: string) {
  if (periodicity === "MONTHLY") return "MONTHLY";
  if (periodicity === "QUARTERLY") return "QUARTERLY";
  if (periodicity === "YEARLY") return "YEARLY";
  return "OTHER";
}

function CreateContributionDrawer({
  open,
  onClose,
  onSubmit,
  isPending,
  error
}: Readonly<{
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string; amount: string; periodicity: string; due_date: string }) => void;
  isPending: boolean;
  error?: string;
}>) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [periodicity, setPeriodicity] = useState("MONTHLY");
  const [dueDate, setDueDate] = useState(defaultDueDate);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid items-end bg-slate-950/40" role="dialog" aria-modal="true">
      <form
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ name, amount, periodicity, due_date: dueDate });
        }}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-blue-700">Nouvelle cotisation</p>
            <h2 className="text-2xl font-black tracking-normal">Creer une cotisation</h2>
          </div>
          <button className="grid size-9 place-items-center rounded-lg bg-slate-100" type="button" onClick={onClose} aria-label="Fermer">
            <X className="size-5" />
          </button>
        </div>
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-black">Nom de la cotisation<input className="min-h-12 rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-blue-600" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Cotisation Septembre" /></label>
          <label className="grid gap-2 text-sm font-black">Frequence<select className="min-h-12 rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-blue-600" value={periodicity} onChange={(event) => setPeriodicity(event.target.value)}><option value="MONTHLY">Mensuelle</option><option value="QUARTERLY">Trimestrielle</option><option value="YEARLY">Annuelle</option><option value="ONE_TIME">Ponctuelle</option><option value="CUSTOM">Personnalisee</option></select></label>
          <label className="grid gap-2 text-sm font-black">Montant<input className="min-h-12 rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-blue-600" min="1" required type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="10000" /></label>
          <label className="grid gap-2 text-sm font-black">Date limite<input className="min-h-12 rounded-lg border border-slate-200 px-3 text-base font-semibold outline-none focus:border-blue-600" required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
        </div>
        {error ? <p className="mt-3 text-sm font-bold text-red-600">{error}</p> : null}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button className="min-h-12" type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button className="min-h-12 bg-blue-700 text-white hover:bg-blue-800" disabled={isPending || !name.trim() || !amount} type="submit">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Creer
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ContributionsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<ContributionPeriod>("year");
  const [campaign, setCampaign] = useState("all");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [group, setGroup] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [search, setSearch] = useState("");
  const [ordering, setOrdering] = useState("due_date");
  const [page, setPage] = useState(1);
  const [selectedContribution, setSelectedContribution] = useState<ContributionResource | null>(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [notice, setNotice] = useState("");
  const today = useMemo(() => new Date(), []);
  const [tableMonth, setTableMonth] = useState(today.getMonth());
  const [tableYear, setTableYear] = useState(today.getFullYear());
  const tableBounds = useMemo(() => {
    const start = new Date(tableYear, tableMonth, 1);
    const end = new Date(tableYear, tableMonth + 1, 0);
    return {
      dueAfter: start.toISOString().slice(0, 10),
      dueBefore: end.toISOString().slice(0, 10)
    };
  }, [tableMonth, tableYear]);

  const filters: ContributionFilters = useMemo(
    () => ({ period, campaign, category, group, paymentMethod, status: queryStatus(status), search, ordering, page, pageSize: 8, dueAfter: tableBounds.dueAfter, dueBefore: tableBounds.dueBefore }),
    [campaign, category, group, ordering, page, paymentMethod, period, search, status, tableBounds]
  );

  const dashboardQuery = useQuery({ queryKey: ["contributions-dashboard", workspaceSlug, period, campaign], queryFn: () => getContributionDashboard(workspaceSlug, period, campaign) });
  const analyticsQuery = useQuery({ queryKey: ["contributions-analytics", workspaceSlug, period, campaign], queryFn: () => getContributionAnalytics(workspaceSlug, period, campaign) });
  const campaignsQuery = useQuery({ queryKey: ["contribution-campaigns", workspaceSlug], queryFn: () => listContributionCampaigns(workspaceSlug) });
  const categoriesQuery = useQuery({ queryKey: ["contribution-categories", workspaceSlug], queryFn: () => listContributionCategories(workspaceSlug) });
  const groupsQuery = useQuery({ queryKey: ["contribution-groups", workspaceSlug], queryFn: () => listContributionGroups(workspaceSlug) });
  const contributionsQuery = useQuery({ queryKey: ["contributions", workspaceSlug, filters], queryFn: () => listContributions(workspaceSlug, filters) });
  const latestContributionsQuery = useQuery({
    queryKey: ["contributions-latest", workspaceSlug],
    queryFn: () => listContributions(workspaceSlug, { period: "all", ordering: "-created_at", page: 1, pageSize: 5 })
  });

  const dashboard = dashboardQuery.data;
  const analytics = analyticsQuery.data;
  const contributions = contributionsQuery.data?.results || [];
  const latestContributions = latestContributionsQuery.data?.results || [];
  const currency = contributions[0]?.currency || campaignsQuery.data?.[0]?.currency || "FCFA";
  const totalPages = Math.max(Math.ceil((contributionsQuery.data?.count || 0) / 8), 1);
  const error = dashboardQuery.error || analyticsQuery.error || contributionsQuery.error;
  const paidCount = numberValue(dashboard?.members_paid);
  const partialCount = numberValue(dashboard?.members_partial);
  const unpaidCount = numberValue(dashboard?.members_unpaid);
  const overdueCount = numberValue(dashboard?.members_overdue);
  const collected = numberValue(dashboard?.total_collected);
  const remaining = numberValue(dashboard?.total_remaining);
  const overdueAmount = numberValue(dashboard?.total_overdue || analytics?.overdue_amount);
  const collectionRate = progress(dashboard?.collection_rate);

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["contributions-dashboard", workspaceSlug] }),
      queryClient.invalidateQueries({ queryKey: ["contributions-analytics", workspaceSlug] }),
      queryClient.invalidateQueries({ queryKey: ["contributions", workspaceSlug] }),
      queryClient.invalidateQueries({ queryKey: ["contributions-latest", workspaceSlug] })
    ]);
  };

  const paymentMutation = useMutation({
    mutationFn: (payload: { amount: string; payment_method: string; document_reference: string; paid_at: string }) => {
      if (!selectedContribution) throw new Error("Selectionne une cotisation.");
      return recordContributionPayment(workspaceSlug, selectedContribution.id, payload);
    },
    onSuccess: async () => {
      setSelectedContribution(null);
      setNotice("Paiement enregistre.");
      await refreshAll();
    }
  });

  const reminderMutation = useMutation({
    mutationFn: (contributionId: number) => sendContributionReminder(workspaceSlug, contributionId),
    onSuccess: () => setNotice("Relance envoyee.")
  });

  const exportMutation = useMutation({
    mutationFn: () => requestContributionExport(workspaceSlug, filters, "CSV"),
    onSuccess: (result) => setNotice(`Export cree #${result.id}.`)
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (payload: { name: string; amount: string; periodicity: string; due_date: string }) => {
      const campaign = await createContributionCampaign(workspaceSlug, {
        name: payload.name,
        amount: payload.amount,
        periodicity: payload.periodicity,
        contribution_type: contributionTypeForPeriodicity(payload.periodicity),
        period_label: contributionPeriodLabel(payload.periodicity),
        due_date: payload.due_date,
        status: "DRAFT"
      });
      await activateContributionCampaign(workspaceSlug, campaign.id);
      return campaign;
    },
    onSuccess: async () => {
      setCreateDrawerOpen(false);
      setNotice("Cotisation creee et generee pour les membres actifs.");
      await refreshAll();
      await queryClient.invalidateQueries({ queryKey: ["contribution-campaigns", workspaceSlug] });
    }
  });

  return (
    <main className="grid min-w-0 w-full max-w-full gap-4 overflow-x-hidden px-4 pb-24 pt-4 text-slate-950">
      {notice ? <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-black text-blue-800">{notice}</div> : null}
      {error ? <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-black text-red-700">Impossible de charger les cotisations.</div> : null}

      <KpiTile icon={<BarChart3 className="size-4" />} pill="+4% vs le mois dernier" progressValue={collectionRate} title="Taux de recouvrement" tone="blue" value={`${Math.round(collectionRate)}%`} />
      <KpiTile icon={<CreditCard className="size-4" />} title="Montant attendu" tone="slate" value={compactMoney(dashboard?.total_expected, currency)} />
      <KpiTile icon={<TrendingUp className="size-4" />} title="Montant collecte" tone="green" value={compactMoney(dashboard?.total_collected, currency)} />
      <KpiTile icon={<AlertTriangle className="size-4" />} title="Impayes" tone="red" value={compactMoney(dashboard?.total_remaining, currency)} />

      <ChartPanel collected={collected} onPeriodChange={setPeriod} overdue={overdueAmount} period={period} rate={collectionRate} remaining={remaining} />

      <section className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black tracking-normal">Repartition des statuts</h2>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{formatNumber(paidCount + partialCount + unpaidCount + overdueCount)} membres</span>
        </div>
        <PieChart
          caption="Membres"
          center={`${Math.round(progress((paidCount / Math.max(paidCount + partialCount + unpaidCount + overdueCount, 1)) * 100))}%`}
          segments={[
            { label: "Payes", value: paidCount, color: "#10b981" },
            { label: "Partiels", value: partialCount, color: "#f59e0b" },
            { label: "En attente", value: unpaidCount, color: "#94a3b8" },
            { label: "Impayes", value: overdueCount, color: "#ef4444" }
          ]}
        />
      </section>

      <section className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black tracking-normal">Dernieres cotisations</h2>
          <button className="grid size-8 place-items-center rounded-lg text-blue-700 hover:bg-blue-50" type="button" onClick={() => setShowFilters((current) => !current)} aria-label="Afficher les filtres">
            <SlidersHorizontal className="size-5" />
          </button>
        </div>

        {showFilters ? (
          <div className="mb-4 grid gap-2">
            <label className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm text-slate-500 ring-1 ring-slate-200">
              <Search className="size-4" />
              <input className="min-w-0 flex-1 bg-transparent font-semibold outline-none" placeholder="Rechercher un membre..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            </label>
            <select className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold" value={campaign} onChange={(event) => { setCampaign(event.target.value); setPage(1); }}>
              <option value="all">Toutes les campagnes</option>
              {(campaignsQuery.data || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="all">Tous les statuts</option>
              {CONTRIBUTION_STATUSES.slice(0, 4).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <select className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="all">Toutes categories</option>
              {(categoriesQuery.data || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold" value={group} onChange={(event) => setGroup(event.target.value)}>
              <option value="all">Tous les groupes</option>
              {(groupsQuery.data || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
              <option value="all">Tous les modes de paiement</option>
              {paymentMethods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        ) : null}

        <div className="grid gap-4">
          {latestContributions.map((item) => {
            const style = statusStyles[item.status] || statusStyles.PENDING;
            return (
              <div className="flex min-w-0 items-center gap-3" key={item.id}>
                <Link className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-black ${style.avatar}`} href={workspacePath(workspaceSlug, `members/${item.member}`)}>
                  {initials(item.member_name)}
                </Link>
                <Link className="min-w-0 flex-1" href={workspacePath(workspaceSlug, `members/${item.member}`)}>
                  <strong className="block truncate text-sm font-black">{item.member_name}</strong>
                  <span className="block truncate text-xs font-semibold text-slate-500">{contributionName(item, campaignsQuery.data || [])}</span>
                </Link>
                <span className={`shrink-0 rounded px-2 py-1 text-xs font-black ${style.badge}`}>{style.label}</span>
              </div>
            );
          })}
          {!latestContributions.length ? <div className="rounded-lg bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">Aucune cotisation recente.</div> : null}
        </div>

        <a className="mt-5 block text-center text-xs font-black text-blue-700" href="#cotisations-table">Voir toutes les cotisations</a>
      </section>

      <section className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm" id="cotisations-table">
        <div className="mb-4 grid gap-3">
          <div>
            <h2 className="text-xl font-black tracking-normal">Toutes les cotisations</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Choisis le mois et l'annee pour voir les cotisations des membres.</p>
          </div>
          <div className="grid grid-cols-[1fr_104px] gap-2">
            <select className="min-h-11 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black" value={tableMonth} onChange={(event) => { setTableMonth(Number(event.target.value)); setPage(1); }}>
              {monthOptions.map((month, index) => <option key={month} value={index}>{month}</option>)}
            </select>
            <input className="min-h-11 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black" max="2100" min="2000" type="number" value={tableYear} onChange={(event) => { setTableYear(Number(event.target.value)); setPage(1); }} />
          </div>
        </div>
        <div className="grid min-w-0 overflow-hidden rounded-lg border border-slate-200">
          <div className="grid grid-cols-[1.1fr_1fr_74px] gap-2 bg-slate-50 px-3 py-3 text-[11px] font-black uppercase text-slate-500">
            <span>Nom</span>
            <span>Cotisation</span>
            <span className="text-right">Statut</span>
          </div>
          {contributions.map((item) => {
            const style = tableStatus(item, tableMonth, tableYear, today);
            return (
              <div className="grid min-w-0 grid-cols-[1.1fr_1fr_74px] items-center gap-2 border-t border-slate-100 px-3 py-3" key={`table-${item.id}`}>
                <Link className="min-w-0 truncate text-sm font-black text-slate-950" href={workspacePath(workspaceSlug, `members/${item.member}`)}>{item.member_name}</Link>
                <span className="min-w-0 truncate text-xs font-bold text-slate-500">{contributionName(item, campaignsQuery.data || [])}</span>
                <span className={`justify-self-end rounded px-2 py-1 text-[10px] font-black ${style.badge}`}>{style.label}</span>
              </div>
            );
          })}
          {!contributions.length ? <div className="border-t border-slate-100 p-5 text-center text-sm font-bold text-slate-500">Aucune cotisation pour ce mois.</div> : null}
        </div>
      </section>

      <section className="grid w-full gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Button className="min-h-12 w-full" type="button" onClick={() => setSelectedContribution(contributions.find((item) => numberValue(item.remaining_amount) > 0) || contributions[0] || null)}>
            <Plus className="size-4" />
            Paiement
          </Button>
          <Button className="min-h-12 w-full" type="button" variant="outline" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
            {exportMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Export
          </Button>
        </div>
        <Button className="min-h-12 w-full" type="button" variant="outline" onClick={() => reminderMutation.mutate(contributions.find((item) => item.status === "OVERDUE")?.id || contributions[0]?.id)} disabled={reminderMutation.isPending || !contributions.length}>
          {reminderMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Relancer les impayes visibles
        </Button>
      </section>

      <section className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black">Details</h2>
          <select className="h-9 max-w-[150px] rounded-md border border-slate-200 bg-white px-2 text-xs font-bold" value={ordering} onChange={(event) => setOrdering(event.target.value)}>
            <option value="due_date">Echeance</option>
            <option value="amount_due">Attendu</option>
            <option value="amount_paid">Paye</option>
            <option value="status">Statut</option>
            <option value="-created_at">Recent</option>
          </select>
        </div>
        <div className="grid gap-3">
          <div className="flex justify-between text-sm font-bold text-slate-600"><span>Membres concernes</span><strong>{formatNumber(dashboard?.members_concerned || 0)}</strong></div>
          <div className="flex justify-between text-sm font-bold text-slate-600"><span>Membres a jour</span><strong>{formatNumber(dashboard?.members_paid || 0)}</strong></div>
          <div className="flex justify-between text-sm font-bold text-slate-600"><span>Paiements partiels</span><strong>{formatNumber(dashboard?.members_partial || 0)}</strong></div>
          <div className="flex justify-between text-sm font-bold text-slate-600"><span>En retard</span><strong>{formatNumber(dashboard?.members_overdue || 0)}</strong></div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Button className="min-h-10 px-3" type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="size-4" /></Button>
          <span className="text-sm font-black text-slate-500">Page {page} / {totalPages}</span>
          <Button className="min-h-10 px-3" type="button" variant="outline" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}><ChevronRight className="size-4" /></Button>
        </div>
      </section>

      <section className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-black"><Sparkles className="size-5 text-blue-700" /> Insights</h2>
        <div className="grid gap-3">
          <div className="rounded-lg bg-blue-50 p-3 text-sm font-bold text-blue-900">NOVEX a collecte {compactMoney(collected, currency)} sur {compactMoney(dashboard?.total_expected, currency)} attendus.</div>
          <div className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">Il reste {compactMoney(remaining, currency)} a collecter, dont {compactMoney(overdueAmount, currency)} en retard.</div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700">Les exports et relances respectent les filtres actifs du workspace.</div>
        </div>
      </section>

      <PaymentDrawer
        contribution={selectedContribution}
        error={paymentMutation.error instanceof Error ? paymentMutation.error.message : undefined}
        isPending={paymentMutation.isPending}
        onClose={() => setSelectedContribution(null)}
        onSubmit={(payload) => paymentMutation.mutate(payload)}
      />
      <CreateContributionDrawer
        error={createCampaignMutation.error instanceof Error ? createCampaignMutation.error.message : undefined}
        isPending={createCampaignMutation.isPending}
        onClose={() => setCreateDrawerOpen(false)}
        onSubmit={(payload) => createCampaignMutation.mutate(payload)}
        open={createDrawerOpen}
      />
      <button
        className="fixed bottom-24 right-5 z-30 grid size-14 place-items-center rounded-full bg-blue-700 text-white shadow-xl shadow-blue-900/30 hover:bg-blue-800"
        type="button"
        onClick={() => setCreateDrawerOpen(true)}
        aria-label="Creer une cotisation"
      >
        <Plus className="size-7" />
      </button>
    </main>
  );
}
