"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Plus, ReceiptText, Target, TrendingUp, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { workspacePath } from "@/lib/workspace/routing";
import { createIncome, getIncomeSummary, listIncome, listIncomeCategories, listIncomeMembers, type IncomePayload, type IncomeSource, type SenderType } from "./income-api";

const sources: Array<{ value: IncomeSource; label: string; color: string }> = [
  { value: "CONTRIBUTION", label: "Cotisations", color: "#0f72f2" },
  { value: "DONATION", label: "Dons", color: "#10b981" },
  { value: "GRANT", label: "Subventions", color: "#f59e0b" },
  { value: "SPONSORSHIP", label: "Sponsoring", color: "#111827" }
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: string | number | undefined, currency = "XOF") {
  const amount = Number(value ?? 0);
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} ${currency === "XOF" ? "FCFA" : currency}`;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function memberName(member: { full_name?: string; first_name?: string; last_name?: string; id: number }) {
  return member.full_name || `${member.first_name || ""} ${member.last_name || ""}`.trim() || `Membre ${member.id}`;
}

function Donut({ rows }: Readonly<{ rows: Array<{ amount: string | number; percentage: string | number; source: string }> }>) {
  let cursor = 0;
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const gradient = rows.map((row) => {
    const source = sources.find((item) => item.value === row.source);
    const size = total > 0 ? Number(row.percentage || 0) * 3.6 : 0;
    const segment = `${source?.color || "#94a3b8"} ${cursor}deg ${cursor + size}deg`;
    cursor += size;
    return segment;
  }).join(", ");
  return <div className="mx-auto grid size-44 place-items-center rounded-full" style={{ background: total > 0 ? `conic-gradient(${gradient}, #e5e7eb ${cursor}deg 360deg)` : "#e5e7eb" }}><div className="grid size-28 place-items-center rounded-full bg-white text-center shadow-inner"><strong className="text-2xl text-slate-950">{total > 0 ? "100%" : "0%"}</strong><span className="text-xs font-bold text-slate-500">sources</span></div></div>;
}

function IncomeForm({ workspaceSlug, onClose }: Readonly<{ workspaceSlug: string; onClose: () => void }>) {
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({ queryKey: ["income-categories", workspaceSlug], queryFn: () => listIncomeCategories(workspaceSlug) });
  const membersQuery = useQuery({ queryKey: ["income-members", workspaceSlug], queryFn: () => listIncomeMembers(workspaceSlug) });
  const [form, setForm] = useState({ description: "", amount: "", category: "", transaction_date: todayIso(), source: "DONATION" as IncomeSource, sender_type: "OTHER" as SenderType, member: "", sender_name: "", notes: "" });
  const selectedCategory = categoriesQuery.data?.find((category) => category.name.toLowerCase().includes(sources.find((source) => source.value === form.source)?.label.toLowerCase().slice(0, 4) || ""));
  const canSubmit = form.description.trim().length > 1 && Number(form.amount) > 0 && (form.category || selectedCategory) && (form.sender_type === "MEMBER" ? form.member : form.sender_name.trim().length > 1);
  const mutation = useMutation({
    mutationFn: () => {
      const payload: IncomePayload = {
        description: form.description.trim(),
        amount: form.amount,
        category: Number(form.category || selectedCategory?.id),
        transaction_date: form.transaction_date,
        source: form.source,
        sender_type: form.sender_type,
        member: form.sender_type === "MEMBER" ? Number(form.member) : null,
        sender_name: form.sender_type === "OTHER" ? form.sender_name.trim() : memberName(membersQuery.data?.find((member) => String(member.id) === form.member) || { id: Number(form.member) }),
        notes: form.notes
      };
      return createIncome(workspaceSlug, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["income-summary", workspaceSlug] });
      await queryClient.invalidateQueries({ queryKey: ["income-list", workspaceSlug] });
      onClose();
    }
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 md:grid md:place-items-center" role="dialog" aria-label="Nouvelle recette">
      <section className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl md:h-[90vh] md:rounded-lg">
        <header className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="text-xl font-black text-slate-950">Nouvelle recette</h2>
            <p className="text-sm text-slate-500">Enregistrez une cotisation, un don, une subvention ou un sponsoring.</p>
          </div>
          <Button type="button" variant="outline" onClick={onClose}><ArrowLeft className="size-4" /> Annuler</Button>
        </header>
        <form className="grid flex-1 content-start gap-4 overflow-y-auto p-4 pb-28" onSubmit={(event) => { event.preventDefault(); if (canSubmit) mutation.mutate(); }}>
          <label className="grid gap-2 text-sm font-bold">Titre de la recette *<input className="min-h-12 rounded-md border border-border px-3 outline-none focus:border-blue-600" required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Don exceptionnel" /></label>
          <label className="grid gap-2 text-sm font-bold">Description<textarea className="min-h-24 rounded-md border border-border px-3 py-3 outline-none focus:border-blue-600" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Contexte, details ou reference..." /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold">Source *<select className="min-h-12 rounded-md border border-border bg-white px-3 outline-none focus:border-blue-600" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as IncomeSource })}>{sources.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-bold">Categorie *<select className="min-h-12 rounded-md border border-border bg-white px-3 outline-none focus:border-blue-600" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="">Categorie automatique</option>{categoriesQuery.data?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold">Date *<input className="min-h-12 rounded-md border border-border px-3 outline-none focus:border-blue-600" required type="date" value={form.transaction_date} onChange={(event) => setForm({ ...form, transaction_date: event.target.value })} /></label>
            <label className="grid gap-2 text-sm font-bold">Montant *<input className="min-h-12 rounded-md border border-border px-3 outline-none focus:border-blue-600" min="1" required type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="500000" /></label>
          </div>
          <section className="grid gap-3 rounded-md border border-slate-200 p-3">
            <h3 className="font-black text-slate-950">Envoyeur</h3>
            <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-1">
              {(["MEMBER", "OTHER"] as const).map((type) => <button className={`min-h-10 rounded-md text-sm font-black ${form.sender_type === type ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"}`} key={type} type="button" onClick={() => setForm({ ...form, sender_type: type })}>{type === "MEMBER" ? "Membre" : "Autre"}</button>)}
            </div>
            {form.sender_type === "MEMBER" ? (
              <label className="grid gap-2 text-sm font-bold">Selectionner le membre<select className="min-h-12 rounded-md border border-border bg-white px-3 outline-none focus:border-blue-600" value={form.member} onChange={(event) => setForm({ ...form, member: event.target.value })}><option value="">Choisir un membre</option>{membersQuery.data?.map((member) => <option key={member.id} value={member.id}>{memberName(member)}</option>)}</select></label>
            ) : (
              <label className="grid gap-2 text-sm font-bold">Nom de l'envoyeur<input className="min-h-12 rounded-md border border-border px-3 outline-none focus:border-blue-600" value={form.sender_name} onChange={(event) => setForm({ ...form, sender_name: event.target.value })} placeholder="Fondation XYZ" /></label>
            )}
          </section>
          {mutation.isError ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{mutation.error.message}</p> : null}
          <div className="fixed inset-x-0 bottom-0 grid grid-cols-2 gap-3 border-t border-border bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:absolute">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button disabled={!canSubmit || mutation.isPending} type="submit">{mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Creer la recette</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function FinanceIncomeView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const summaryQuery = useQuery({ queryKey: ["income-summary", workspaceSlug], queryFn: () => getIncomeSummary(workspaceSlug) });
  const listQuery = useQuery({ queryKey: ["income-list", workspaceSlug, page], queryFn: () => listIncome(workspaceSlug, page) });
  const summary = summaryQuery.data;
  const currency = summary?.currency || "XOF";
  const target = Number(summary?.annual_target || 0);
  const progress = Number(summary?.target_progress || 0);
  const visualProgress = Math.min(Math.max(progress, 0), 100);
  const rows = summary?.revenue_by_source || [];
  const hasRevenue = rows.some((row) => Number(row.amount) > 0);
  const totalPages = Math.max(Math.ceil((listQuery.data?.count || 0) / 5), 1);
  const monthLabel = summary ? new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(`${summary.month.start}T00:00:00`)) : "Mois actuel";

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#f5f7f8] px-3 pb-24 pt-5 text-slate-950 md:p-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black tracking-normal">Recettes</h1>
          <p className="mt-1 text-sm text-slate-500">Cotisations, dons, subventions et sponsoring.</p>
        </div>
        <Button type="button" onClick={() => setShowForm(true)}><Plus className="size-4" /> Creer</Button>
      </header>

      <section className="mb-5 grid gap-3 md:grid-cols-3">
        <Card className="rounded-lg"><CardContent className="p-4"><Wallet className="size-5 text-blue-700" /><p className="mt-3 text-sm font-bold text-slate-500">Recette totale</p><div className="mt-1 text-2xl font-black">{summaryQuery.isLoading ? "..." : money(summary?.total_revenue, currency)}</div><p className="mt-1 text-xs font-bold text-slate-500">{summary?.mandate.label || "Mandat en cours"}</p></CardContent></Card>
        <Card className="rounded-lg"><CardContent className="p-4"><TrendingUp className="size-5 text-emerald-600" /><p className="mt-3 text-sm font-bold text-slate-500">Recette du mois</p><div className="mt-1 text-2xl font-black">{summaryQuery.isLoading ? "..." : money(summary?.monthly_revenue, currency)}</div><p className="mt-1 text-xs font-bold text-slate-500">{monthLabel}</p></CardContent></Card>
        <Card className="rounded-lg"><CardContent className="p-4"><Target className="size-5 text-amber-600" /><p className="mt-3 text-sm font-bold text-slate-500">Objectif annuel</p><div className="mt-1 text-2xl font-black">{target > 0 ? money(target, currency) : "Non defini"}</div>{target > 0 ? <><p className="mt-1 text-xs font-bold text-slate-500">{money(summary?.total_revenue, currency)} realises - {progress}%</p><div className="mt-3 h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-blue-700" style={{ width: `${visualProgress}%` }} /></div>{progress > 100 ? <p className="mt-2 text-xs font-black text-emerald-700">Objectif depasse</p> : null}</> : <Link className="mt-2 block text-sm font-black text-blue-700" href={workspacePath(workspaceSlug, "settings/finance")}>Configurer l'objectif</Link>}</CardContent></Card>
      </section>

      <Card className="mb-5 rounded-lg">
        <CardHeader><CardTitle className="text-lg">Repartition par source</CardTitle></CardHeader>
        <CardContent>
          {hasRevenue ? <Donut rows={rows} /> : <div className="grid min-h-40 place-items-center text-center text-sm font-semibold text-slate-500">Aucune recette enregistree</div>}
          <div className="mt-5 grid gap-2">
            {rows.map((row) => {
              const source = sources.find((item) => item.value === row.source);
              return <div className="flex items-center justify-between gap-3 text-sm" key={row.source}><span className="flex items-center gap-2 font-bold"><span className="size-3 rounded-full" style={{ backgroundColor: source?.color }} />{row.label}</span><span className="font-black">{money(row.amount, currency)} <span className="text-slate-500">({row.percentage}%)</span></span></div>;
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ReceiptText className="size-5" /> Dernieres recettes</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {listQuery.isLoading ? <div className="h-40 animate-pulse rounded-md bg-slate-100" /> : null}
          {listQuery.isError ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">Impossible de charger les recettes.</div> : null}
          {listQuery.data?.results.map((income) => <div className="grid grid-cols-[88px_1fr_auto] gap-3 rounded-md border border-slate-200 p-3 text-sm" key={income.id}><span className="font-bold text-slate-500">{dateLabel(income.transaction_date)}</span><span className="min-w-0"><strong className="block truncate">{income.description}</strong><span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-black text-blue-700">{sources.find((source) => source.value === income.source)?.label || income.category_name}</span></span><strong className="text-right">{money(income.amount, income.currency)}</strong></div>)}
          {!listQuery.isLoading && !listQuery.data?.results.length ? <div className="rounded-md border border-dashed border-slate-300 p-5 text-center text-sm font-semibold text-slate-500">Aucune recette enregistree.</div> : null}
          <div className="flex items-center justify-between pt-2 text-sm font-bold text-slate-600">
            <span>Page {page} / {totalPages}</span>
            <div className="flex gap-2"><Button disabled={page <= 1} type="button" variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="size-4" /></Button><Button disabled={page >= totalPages} type="button" variant="outline" onClick={() => setPage((value) => value + 1)}><ChevronRight className="size-4" /></Button></div>
          </div>
        </CardContent>
      </Card>

      <button className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-5 z-30 grid size-14 place-items-center rounded-full bg-blue-700 text-white shadow-2xl md:bottom-7" type="button" aria-label="Creer une recette" onClick={() => setShowForm(true)}><Plus className="size-7" /></button>
      {showForm ? <IncomeForm workspaceSlug={workspaceSlug} onClose={() => setShowForm(false)} /> : null}
    </main>
  );
}
