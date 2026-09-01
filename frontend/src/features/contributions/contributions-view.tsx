"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, Download, Loader2, Plus, Search, Send, SlidersHorizontal, Sparkles, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { workspacePath } from "@/lib/workspace/routing";
import {
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
  const [showFilters, setShowFilters] = useState(false);
  const [notice, setNotice] = useState("");

  const filters: ContributionFilters = useMemo(
    () => ({ period, campaign, category, group, paymentMethod, status: queryStatus(status), search, ordering, page, pageSize: 6 }),
    [campaign, category, group, ordering, page, paymentMethod, period, search, status]
  );

  const dashboardQuery = useQuery({ queryKey: ["contributions-dashboard", workspaceSlug, period, campaign], queryFn: () => getContributionDashboard(workspaceSlug, period, campaign) });
  const analyticsQuery = useQuery({ queryKey: ["contributions-analytics", workspaceSlug, period, campaign], queryFn: () => getContributionAnalytics(workspaceSlug, period, campaign) });
  const campaignsQuery = useQuery({ queryKey: ["contribution-campaigns", workspaceSlug], queryFn: () => listContributionCampaigns(workspaceSlug) });
  const categoriesQuery = useQuery({ queryKey: ["contribution-categories", workspaceSlug], queryFn: () => listContributionCategories(workspaceSlug) });
  const groupsQuery = useQuery({ queryKey: ["contribution-groups", workspaceSlug], queryFn: () => listContributionGroups(workspaceSlug) });
  const contributionsQuery = useQuery({ queryKey: ["contributions", workspaceSlug, filters], queryFn: () => listContributions(workspaceSlug, filters) });

  const dashboard = dashboardQuery.data;
  const analytics = analyticsQuery.data;
  const contributions = contributionsQuery.data?.results || [];
  const currency = contributions[0]?.currency || campaignsQuery.data?.[0]?.currency || "FCFA";
  const totalPages = Math.max(Math.ceil((contributionsQuery.data?.count || 0) / 6), 1);
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
      queryClient.invalidateQueries({ queryKey: ["contributions", workspaceSlug] })
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
          <h2 className="text-xl font-black tracking-normal">Statut des paiements</h2>
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
          {contributions.map((item) => {
            const style = statusStyles[item.status] || statusStyles.PENDING;
            return (
              <div className="flex min-w-0 items-center gap-3" key={item.id}>
                <Link className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-black ${style.avatar}`} href={workspacePath(workspaceSlug, `members/${item.member}`)}>
                  {initials(item.member_name)}
                </Link>
                <Link className="min-w-0 flex-1" href={workspacePath(workspaceSlug, `members/${item.member}`)}>
                  <strong className="block truncate text-sm font-black">{item.member_name}</strong>
                  <span className="block truncate text-xs font-semibold text-slate-500">{shortCampaignLabel(item)}</span>
                </Link>
                <span className={`shrink-0 rounded px-2 py-1 text-xs font-black ${style.badge}`}>{style.label}</span>
              </div>
            );
          })}
          {!contributions.length ? <div className="rounded-lg bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">Aucune cotisation trouvee.</div> : null}
        </div>

        <Link className="mt-5 block text-center text-xs font-black text-blue-700" href={workspacePath(workspaceSlug, "members")}>Voir tous les membres</Link>
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
        <h2 className="mb-3 flex items-center gap-2 text-lg font-black"><Users className="size-5 text-blue-700" /> Membres non a jour</h2>
        <div className="grid gap-3">
          {(analytics?.top_unpaid || []).slice(0, 5).map((member) => (
            <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-red-50 p-3" key={member.member_id}>
              <div className="min-w-0">
                <strong className="block truncate text-sm font-black">{member.member_name}</strong>
                <span className="block truncate text-xs font-semibold text-red-700">{member.phone || "Telephone non renseigne"}</span>
              </div>
              <strong className="shrink-0 text-sm text-red-700">{compactMoney(member.amount_remaining, currency)}</strong>
            </div>
          ))}
          {!analytics?.top_unpaid?.length ? <p className="text-sm font-bold text-slate-500">Aucun membre prioritaire pour le moment.</p> : null}
        </div>
      </section>

      <section className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-black">Modes de paiement</h2>
        <div className="grid gap-2">
          {(analytics?.payment_methods || []).map((item) => (
            <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm font-bold" key={item.method}>
              <span className="truncate">{item.label}</span>
              <span className="shrink-0">{compactMoney(item.amount, currency)}</span>
            </div>
          ))}
          {!analytics?.payment_methods?.length ? <p className="text-sm font-bold text-slate-500">Aucun paiement valide pour cette periode.</p> : null}
        </div>
      </section>

      <section className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-black">Collecte par categorie</h2>
        <div className="grid gap-3">
          {(analytics?.type_performance || []).filter((item) => numberValue(item.expected) > 0 || numberValue(item.collected) > 0).slice(0, 6).map((item) => (
            <div className="rounded-lg bg-slate-50 p-3" key={item.type}>
              <div className="flex min-w-0 justify-between gap-3 text-sm font-black">
                <span className="truncate">{item.label}</span>
                <span className="shrink-0">{Math.round(progress(item.collection_rate))}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-blue-700" style={{ width: `${progress(item.collection_rate)}%` }} />
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-500">{formatMoney(item.collected, currency)} collectes sur {formatMoney(item.expected, currency)}</p>
            </div>
          ))}
          {!analytics?.type_performance?.some((item) => numberValue(item.expected) > 0 || numberValue(item.collected) > 0) ? <p className="text-sm font-bold text-slate-500">Aucune categorie de collecte disponible.</p> : null}
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
    </main>
  );
}
