"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Banknote, CheckCircle2, ChevronLeft, ChevronRight, Download, Eye, FileText, Loader2, Plus, RotateCcw, Search, ShieldCheck, SlidersHorizontal, TrendingDown, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import {
  approveExpense,
  cancelExpense,
  createExpense,
  getExpenseDashboard,
  listExpenseBudgetLines,
  listExpenseBudgets,
  listExpenseCategories,
  listExpenses,
  rejectExpense,
  type ExpenseBudgetLine,
  type ExpenseCategory,
  type ExpenseFilters,
  type ExpensePayload,
  type ExpenseResource,
  type ExpenseStatus
} from "./expenses-api";

const months = [
  ["all", "Tous les mois"],
  [1, "Janvier"],
  [2, "Fevrier"],
  [3, "Mars"],
  [4, "Avril"],
  [5, "Mai"],
  [6, "Juin"],
  [7, "Juillet"],
  [8, "Aout"],
  [9, "Septembre"],
  [10, "Octobre"],
  [11, "Novembre"],
  [12, "Decembre"]
] as const;

const statusLabels: Record<ExpenseStatus, string> = {
  DRAFT: "Brouillon",
  PENDING: "En attente",
  VALIDATED: "Validee",
  REJECTED: "Refusee",
  CANCELLED: "Annulee"
};

const paymentMethods = [
  ["", "Non precise"],
  ["CASH", "Especes"],
  ["MOBILE_MONEY", "Mobile Money"],
  ["BANK_TRANSFER", "Virement"],
  ["CARD", "Carte"],
  ["OTHER", "Autre"]
] as const;

function money(value: string | number | undefined, currency = "FCFA") {
  const amount = Number(value ?? 0);
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} ${currency === "XOF" ? "FCFA" : currency}`;
}

function compactMoney(value: string | number | undefined, currency = "FCFA") {
  const amount = Number(value ?? 0);
  const suffix = currency === "XOF" ? "FCFA" : currency;
  if (Math.abs(amount) >= 1000000) return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(amount / 1000000)}M ${suffix}`;
  if (Math.abs(amount) >= 1000) return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount / 1000)}K ${suffix}`;
  return money(amount, suffix);
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function statusTone(status: ExpenseStatus) {
  if (status === "VALIDATED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "PENDING") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "REJECTED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "CANCELLED") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function budgetTone(state: string) {
  if (state === "Budget depasse") return "border-red-200 bg-red-50 text-red-700";
  if (state === "Presque epuise") return "border-orange-200 bg-orange-50 text-orange-700";
  if (state === "A surveiller") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function SkeletonCard() {
  return <div className="min-h-32 animate-pulse rounded-card border border-border bg-white p-5"><div className="h-4 w-24 rounded bg-slate-100" /><div className="mt-5 h-8 w-36 rounded bg-slate-100" /><div className="mt-4 h-3 w-full rounded bg-slate-100" /></div>;
}

function ExpenseForm({
  budgetLines,
  categories,
  currency,
  isSubmitting,
  onClose,
  onSubmit
}: Readonly<{ budgetLines: ExpenseBudgetLine[]; categories: ExpenseCategory[]; currency: string; isSubmitting: boolean; onClose: () => void; onSubmit: (payload: ExpensePayload) => void }>) {
  const [form, setForm] = useState({
    description: "",
    amount: "",
    category: "",
    transaction_date: todayIso(),
    budget_line: "",
    supplier_name: "",
    supplier_phone: "",
    invoice_reference: "",
    payment_method: "",
    notes: ""
  });

  const selectedLine = budgetLines.find((line) => String(line.id) === form.budget_line);
  const categoryOptions = useMemo(() => {
    const seen = new Set<number>();
    return [
      ...categories.map((item) => ({ id: item.id, name: item.name })),
      ...budgetLines.map((line) => ({ id: line.category_id, name: line.category_name }))
    ].filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [budgetLines, categories]);
  const amountExceedsBudget = selectedLine && Number(form.amount || 0) > Number(selectedLine.remaining || selectedLine.planned_amount || 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 md:grid md:place-items-center" role="dialog" aria-label="Nouvelle depense">
      <section className="relative ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl md:h-[90vh] md:rounded-card">
        <header className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="text-xl font-black text-slate-950">Nouvelle depense</h2>
            <p className="text-sm text-slate-500">Enregistrez une sortie pour votre association.</p>
          </div>
          <button className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-700" type="button" aria-label="Fermer" onClick={onClose}>
            <X className="size-5" />
          </button>
        </header>
        <form
          className="grid flex-1 content-start gap-4 overflow-y-auto p-4 pb-28"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({
              description: form.description.trim(),
              amount: form.amount,
              category: Number(form.category || selectedLine?.category_id),
              transaction_date: form.transaction_date,
              budget_line: form.budget_line ? Number(form.budget_line) : null,
              supplier_name: form.supplier_name,
              supplier_phone: form.supplier_phone,
              invoice_reference: form.invoice_reference,
              payment_method: form.payment_method,
              notes: form.notes
            });
          }}
        >
          <label className="grid gap-2 text-sm font-bold text-slate-800">
            Intitule *
            <input className="min-h-12 rounded-md border border-border px-3 font-medium outline-none focus:border-blue-600" required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Ex: Achat fournitures" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-800">
              Montant *
              <input className="min-h-12 rounded-md border border-border px-3 font-medium outline-none focus:border-blue-600" required min="1" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="250000" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-800">
              Date *
              <input className="min-h-12 rounded-md border border-border px-3 font-medium outline-none focus:border-blue-600" required type="date" value={form.transaction_date} onChange={(event) => setForm({ ...form, transaction_date: event.target.value })} />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-bold text-slate-800">
            Budget
            <select className="min-h-12 rounded-md border border-border bg-white px-3 outline-none focus:border-blue-600" value={form.budget_line} onChange={(event) => {
              const line = budgetLines.find((item) => String(item.id) === event.target.value);
              setForm({ ...form, budget_line: event.target.value, category: line ? String(line.category_id) : form.category });
            }}>
              <option value="">Aucun budget</option>
              {budgetLines.map((line) => <option key={line.id} value={line.id}>{line.budget_name} - {line.category_name}</option>)}
            </select>
          </label>
          {selectedLine ? (
            <div className={cn("rounded-md border p-3 text-sm", amountExceedsBudget ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-100 bg-blue-50 text-blue-800")}>
              Budget restant estime: <strong>{money(selectedLine.remaining || selectedLine.planned_amount, currency)}</strong>
              {amountExceedsBudget ? <div>Cette depense depasse le montant disponible sur ce budget.</div> : null}
            </div>
          ) : null}
          <label className="grid gap-2 text-sm font-bold text-slate-800">
            Categorie *
            <select className="min-h-12 rounded-md border border-border bg-white px-3 outline-none focus:border-blue-600" required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              <option value="">Selectionner une categorie</option>
              {categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-800">
              Moyen de paiement
              <select className="min-h-12 rounded-md border border-border bg-white px-3 outline-none focus:border-blue-600" value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value })}>
                {paymentMethods.map(([value, label]) => <option key={value || "empty"} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-800">
              Reference
              <input className="min-h-12 rounded-md border border-border px-3 font-medium outline-none focus:border-blue-600" value={form.invoice_reference} onChange={(event) => setForm({ ...form, invoice_reference: event.target.value })} placeholder="Facture, recu..." />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-800">
              Fournisseur
              <input className="min-h-12 rounded-md border border-border px-3 font-medium outline-none focus:border-blue-600" value={form.supplier_name} onChange={(event) => setForm({ ...form, supplier_name: event.target.value })} placeholder="Nom fournisseur" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-800">
              Telephone
              <input className="min-h-12 rounded-md border border-border px-3 font-medium outline-none focus:border-blue-600" value={form.supplier_phone} onChange={(event) => setForm({ ...form, supplier_phone: event.target.value })} placeholder="+225..." />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-bold text-slate-800">
            Commentaire
            <textarea className="min-h-28 rounded-md border border-border px-3 py-3 font-medium outline-none focus:border-blue-600" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Description, contexte, pieces attendues..." />
          </label>
          <div className="fixed inset-x-0 bottom-0 grid grid-cols-2 gap-3 border-t border-border bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:absolute">
            <Button className="w-full" type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button className="w-full" disabled={isSubmitting || !form.description || !form.amount || !(form.category || selectedLine)} type="submit">
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Creer la depense
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function FinanceExpensesView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | "all">(now.getMonth() + 1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [budget, setBudget] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseResource | null>(null);
  const queryClient = useQueryClient();
  const filters: ExpenseFilters = { year, month, page, pageSize: 4, status, budget, category, search };

  const dashboardQuery = useQuery({ queryKey: ["expense-dashboard", workspaceSlug, year, month], queryFn: () => getExpenseDashboard(workspaceSlug, filters) });
  const budgetsQuery = useQuery({ queryKey: ["expense-budgets", workspaceSlug, year, month], queryFn: () => listExpenseBudgets(workspaceSlug, filters) });
  const expensesQuery = useQuery({ queryKey: ["expenses", workspaceSlug, filters], queryFn: () => listExpenses(workspaceSlug, filters) });
  const categoriesQuery = useQuery({ queryKey: ["expense-categories", workspaceSlug], queryFn: () => listExpenseCategories(workspaceSlug) });
  const linesQuery = useQuery({ queryKey: ["expense-budget-lines", workspaceSlug], queryFn: () => listExpenseBudgetLines(workspaceSlug) });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["expense-dashboard", workspaceSlug] });
    queryClient.invalidateQueries({ queryKey: ["expense-budgets", workspaceSlug] });
    queryClient.invalidateQueries({ queryKey: ["expenses", workspaceSlug] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: ExpensePayload) => createExpense(workspaceSlug, payload),
    onSuccess: () => {
      setShowForm(false);
      setPage(1);
      refresh();
    }
  });
  const approveMutation = useMutation({ mutationFn: (id: number) => approveExpense(workspaceSlug, id), onSuccess: refresh });
  const rejectMutation = useMutation({ mutationFn: (id: number) => rejectExpense(workspaceSlug, id, "Refus depuis NOVEX"), onSuccess: refresh });
  const cancelMutation = useMutation({ mutationFn: (id: number) => cancelExpense(workspaceSlug, id, "Annulation depuis NOVEX"), onSuccess: refresh });

  const dashboard = dashboardQuery.data;
  const currency = dashboard?.currency ?? "FCFA";
  const totalPages = Math.max(1, Math.ceil((expensesQuery.data?.count ?? 0) / 4));
  const budgetTotal = budgetsQuery.data?.reduce((sum, item) => sum + Number(item.budget_total || 0), 0) ?? 0;
  const monthlyBudgetRate = budgetTotal > 0 ? Math.round((Number(dashboard?.monthly_expenses || 0) / budgetTotal) * 100) : null;
  const kpis = [
    ["Total Depenses (YTD)", compactMoney(dashboard?.total_expenses, currency), dashboard?.period.label ?? "", TrendingDown, "text-emerald-700"],
    ["Depenses du mois", compactMoney(dashboard?.monthly_expenses, currency), monthlyBudgetRate === null ? "Budget non defini" : `${monthlyBudgetRate}% du budget`, Banknote, "text-blue-700"],
    ["En attente d'approbation", compactMoney(dashboard?.pending_amount, currency), `${dashboard?.pending_count ?? 0} requetes`, AlertTriangle, "text-blue-700"],
    ["Depenses Validees (Mois)", compactMoney(dashboard?.approved_amount, currency), `${dashboard?.approved_count ?? 0} approuvees`, ShieldCheck, "text-emerald-700"]
  ] as const;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 overflow-x-hidden p-4 md:p-0">
      <PageHeader title="Depenses" description="Suivez, controlez et analysez les depenses de votre association." actions={<Button type="button" onClick={() => setShowForm(true)}><Plus className="size-4" /> Nouvelle depense</Button>} />

      <section className="grid gap-3 rounded-card border border-border bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto]">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Annee
          <input className="min-h-11 rounded-md border border-border px-3 outline-none focus:border-blue-600" type="number" value={year} onChange={(event) => { setYear(Number(event.target.value)); setPage(1); }} />
        </label>
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Mois
          <select className="min-h-11 rounded-md border border-border bg-white px-3 outline-none focus:border-blue-600" value={month} onChange={(event) => { setMonth(event.target.value === "all" ? "all" : Number(event.target.value)); setPage(1); }}>
            {months.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <Button className="self-end" type="button" variant="outline" onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); setStatus(""); setBudget(""); setCategory(""); setSearch(""); setPage(1); }}>
          <RotateCcw className="size-4" /> Reinitialiser
        </Button>
      </section>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {dashboardQuery.isLoading ? [1, 2, 3, 4].map((item) => <SkeletonCard key={item} />) : kpis.map(([label, value, sub, Icon, tone]) => (
          <Card className="rounded-md" key={label}>
            <CardContent className="p-4">
              <CardTitle className="text-[11px] font-semibold leading-tight text-slate-600">{label}</CardTitle>
              <div className="mt-3 text-2xl font-black tracking-normal text-slate-950">{value}</div>
              <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-slate-500">
                <Icon className={cn("size-4", tone)} />
                {sub}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="overflow-hidden rounded-md border border-border bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 p-4">
          <div>
            <h2 className="text-lg font-black leading-tight text-slate-950">Historique des transactions</h2>
          </div>
          <div className="flex gap-2">
            <button className="grid size-10 place-items-center rounded-md border border-border text-slate-700" type="button" aria-label="Filtrer les depenses">
              <SlidersHorizontal className="size-4" />
            </button>
            <button className="grid size-10 place-items-center rounded-md border border-border text-slate-700" type="button" aria-label="Exporter les depenses">
              <Download className="size-4" />
            </button>
          </div>
        </div>
        <div className="grid gap-3 border-y border-border bg-slate-50 p-3 md:grid-cols-5">
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-white px-3 md:col-span-2">
            <Search className="size-4 text-slate-400" />
            <input className="w-full bg-transparent text-sm outline-none" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Rechercher une depense..." />
          </label>
          <select className="min-h-10 rounded-md border border-border bg-white px-3 text-sm outline-none" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">Tous les statuts</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="min-h-10 rounded-md border border-border bg-white px-3 text-sm outline-none" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
            <option value="">Toutes categories</option>
            {categoriesQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className="min-h-10 rounded-md border border-border bg-white px-3 text-sm outline-none" value={budget} onChange={(event) => { setBudget(event.target.value); setPage(1); }}>
            <option value="">Tous budgets</option>
            {budgetsQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        {expensesQuery.error ? <div className="border-b border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{expensesQuery.error.message}</div> : null}
        <table className="w-full table-fixed text-left">
          <thead className="text-[10px] font-black uppercase tracking-normal text-slate-500">
            <tr>
              <th className="w-[28%] px-3 py-3">Date</th>
              <th className="w-[46%] px-3 py-3">Description</th>
              <th className="w-[26%] px-3 py-3 text-right">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs">
            {expensesQuery.isLoading ? [1, 2, 3, 4].map((item) => (
              <tr key={item}>
                <td className="px-3 py-5"><div className="h-3 w-14 animate-pulse rounded bg-slate-100" /></td>
                <td className="px-3 py-5"><div className="h-3 w-28 animate-pulse rounded bg-slate-100" /></td>
                <td className="px-3 py-5"><div className="ml-auto h-3 w-16 animate-pulse rounded bg-slate-100" /></td>
              </tr>
            )) : null}
            {!expensesQuery.isLoading && !expensesQuery.data?.results.length ? (
              <tr>
                <td className="px-3 py-10 text-center text-sm font-semibold text-slate-500" colSpan={3}>Aucune transaction trouvee.</td>
              </tr>
            ) : null}
            {expensesQuery.data?.results.map((expense) => (
              <tr className="align-top" key={expense.id}>
                <td className="px-3 py-4 font-medium text-slate-700">{dateLabel(expense.transaction_date)}</td>
                <td className="px-3 py-4">
                  <button className="block w-full text-left" type="button" onClick={() => setSelectedExpense(expense)}>
                    <span className="line-clamp-2 font-black leading-tight text-slate-950">{expense.description}</span>
                    <span className="mt-1 block line-clamp-1 text-[11px] font-medium text-slate-500">{expense.budget_name || expense.category_name || "Sans budget"}</span>
                  </button>
                </td>
                <td className="px-3 py-4 text-right font-black text-slate-950">{money(expense.amount, expense.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-border p-3">
          <span className="text-[11px] font-medium text-slate-500">Affichage {expensesQuery.data?.count ? `${(page - 1) * 4 + 1}-${Math.min(page * 4, expensesQuery.data.count)}` : "0"} sur {expensesQuery.data?.count ?? 0}</span>
          <div className="flex gap-1">
            <button className="grid size-9 place-items-center rounded-md text-slate-500 disabled:opacity-40" disabled={page <= 1} type="button" aria-label="Page precedente" onClick={() => setPage((value) => Math.max(1, value - 1))}>
              <ChevronLeft className="size-4" />
            </button>
            <button className="grid size-9 place-items-center rounded-md text-slate-700 disabled:opacity-40" disabled={page >= totalPages} type="button" aria-label="Page suivante" onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">Depenses des budgets</h2>
          <p className="text-sm text-slate-500">Suivez la consommation des budgets de votre association.</p>
        </div>
        {budgetsQuery.isLoading ? <div className="grid gap-3 md:grid-cols-2">{[1, 2].map((item) => <SkeletonCard key={item} />)}</div> : null}
        {!budgetsQuery.isLoading && !budgetsQuery.data?.length ? (
          <Card><CardContent className="p-6 text-center"><LandmarkEmpty /><h3 className="mt-2 font-black">Aucun budget disponible</h3><p className="mt-1 text-sm text-slate-500">Creez d'abord un budget depuis le menu Budgets pour suivre sa consommation.</p><Button asChild className="mt-4"><Link href={`/app/${workspaceSlug}/budgets`}>Ouvrir Budgets</Link></Button></CardContent></Card>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          {budgetsQuery.data?.map((item) => {
            const rate = Number(item.consumption_rate || 0);
            return (
              <Link className="block" href={`/app/${workspaceSlug}/budgets/${item.id}`} key={item.id}>
                <Card className="h-full transition hover:border-blue-200 hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-black text-slate-950">{item.name}</h3>
                        <p className="text-sm text-slate-500">{item.category || "Budget general"}</p>
                      </div>
                      <span className={cn("shrink-0 rounded-md border px-2 py-1 text-xs font-bold", budgetTone(item.state))}>{item.state}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                      <span><strong className="block text-slate-950">{money(item.budget_total, item.currency)}</strong>Budget</span>
                      <span><strong className="block text-slate-950">{money(item.spent, item.currency)}</strong>Depense</span>
                      <span><strong className="block text-slate-950">{money(item.remaining, item.currency)}</strong>Restant</span>
                    </div>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className={cn("h-full", rate > 100 ? "bg-red-600" : rate >= 80 ? "bg-orange-500" : rate >= 50 ? "bg-amber-500" : "bg-blue-700")} style={{ width: `${Math.min(rate, 100)}%` }} />
                    </div>
                    <div className="mt-2 flex justify-between text-sm font-bold text-slate-700"><span>{rate}% consomme</span><span>{Number(item.overrun) > 0 ? `Depassement ${money(item.overrun, item.currency)}` : ""}</span></div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <button className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-5 z-30 grid size-14 place-items-center rounded-full bg-blue-700 text-white shadow-2xl md:bottom-7" type="button" aria-label="Nouvelle depense" onClick={() => setShowForm(true)}>
        <Plus className="size-7" />
      </button>

      {showForm ? <ExpenseForm budgetLines={linesQuery.data ?? []} categories={categoriesQuery.data ?? []} currency={currency} isSubmitting={createMutation.isPending} onClose={() => setShowForm(false)} onSubmit={(payload) => createMutation.mutate(payload)} /> : null}
      {selectedExpense ? (
        <div className="fixed inset-0 z-50 bg-slate-950/45 md:grid md:place-items-center" role="dialog" aria-label="Detail depense">
          <section className="ml-auto flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white p-5 shadow-2xl md:h-auto md:max-h-[90vh] md:rounded-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">{selectedExpense.description}</h2>
                <p className="text-sm text-slate-500">{selectedExpense.reference}</p>
              </div>
              <button className="grid size-10 place-items-center rounded-full bg-slate-100" type="button" aria-label="Fermer" onClick={() => setSelectedExpense(null)}><X className="size-5" /></button>
            </div>
            <div className="mt-5 rounded-card bg-slate-50 p-4">
              <div className="text-3xl font-black text-slate-950">{money(selectedExpense.amount, selectedExpense.currency)}</div>
              <span className={cn("mt-3 inline-flex rounded-md border px-2 py-1 text-xs font-bold", statusTone(selectedExpense.status))}>{statusLabels[selectedExpense.status]}</span>
            </div>
            <dl className="mt-5 grid gap-3 text-sm">
              {[
                ["Budget", selectedExpense.budget_name || "Sans budget"],
                ["Categorie", selectedExpense.category_name],
                ["Date", dateLabel(selectedExpense.transaction_date)],
                ["Creee par", selectedExpense.created_by_name || "NOVEX"],
                ["Moyen de paiement", selectedExpense.payment_method || "Non precise"],
                ["Reference facture", selectedExpense.invoice_reference || "-"],
                ["Fournisseur", selectedExpense.supplier_name || "-"],
                ["Justificatifs", String(selectedExpense.documents_count || 0)],
                ["Commentaire", selectedExpense.notes || "-"],
                ["Motif", selectedExpense.cancellation_reason || "-"]
              ].map(([label, value]) => <div className="rounded-md border border-border p-3" key={label}><dt className="text-xs font-bold uppercase text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-900">{value}</dd></div>)}
            </dl>
            <div className="mt-5 grid gap-2">
              {selectedExpense.status === "PENDING" ? (
                <>
                  <Button type="button" onClick={() => approveMutation.mutate(selectedExpense.id)}><CheckCircle2 className="size-4" /> Approuver</Button>
                  <Button type="button" variant="outline" onClick={() => rejectMutation.mutate(selectedExpense.id)}><XCircle className="size-4" /> Refuser</Button>
                </>
              ) : null}
              {selectedExpense.status !== "CANCELLED" && selectedExpense.status !== "REJECTED" ? <Button type="button" variant="destructive" onClick={() => cancelMutation.mutate(selectedExpense.id)}><XCircle className="size-4" /> Annuler</Button> : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function LandmarkEmpty() {
  return <Banknote className="mx-auto size-9 text-blue-700" />;
}
