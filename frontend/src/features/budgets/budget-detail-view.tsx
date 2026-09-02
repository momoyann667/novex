"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, BarChart3, Clock3, FileDown, Plus, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { getBudget, getBudgetAnalytics } from "./api";

function money(value: string | number | undefined, currency = "FCFA") {
  const amount = Number(value ?? 0);
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} ${currency === "XOF" ? "FCFA" : currency}`;
}

function dateLabel(value: string | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function riskTone(rate: number) {
  if (rate > 100) return "border-red-200 bg-red-50 text-red-700";
  if (rate >= 80) return "border-orange-200 bg-orange-50 text-orange-700";
  if (rate >= 50) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function BudgetDetailView({ workspaceSlug, budgetId }: Readonly<{ workspaceSlug: string; budgetId: string }>) {
  const budgetQuery = useQuery({ queryKey: ["budget", workspaceSlug, budgetId], queryFn: () => getBudget(workspaceSlug, budgetId) });
  const analyticsQuery = useQuery({ queryKey: ["budget-analytics", workspaceSlug, budgetId], queryFn: () => getBudgetAnalytics(workspaceSlug, budgetId) });
  const budget = budgetQuery.data;
  const analytics = analyticsQuery.data;
  const currency = budget?.currency ?? "FCFA";
  const rate = Number(analytics?.consumption_rate || 0);
  const title = budget?.name ?? "Budget";
  const kpis = [
    [money(analytics?.budget_total, currency), "Montant alloue"],
    [money(analytics?.actual, currency), "Montant depense"],
    [money(analytics?.committed, currency), "En attente / engage"],
    [money(analytics?.remaining, currency), "Montant restant"],
    [`${rate}%`, "Consommation"],
    [money(analytics?.overrun, currency), "Depassement"]
  ] as const;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 overflow-x-hidden p-4 md:p-0">
      <PageHeader
        title={title}
        description={`${dateLabel(budget?.start_date)} - ${dateLabel(budget?.end_date)}${budget?.description ? ` · ${budget.description}` : ""}`}
        actions={
          <>
            <Button asChild variant="outline"><Link href={`/app/${workspaceSlug}/budgets`}><ArrowLeft className="size-4" /> Retour</Link></Button>
            <Button type="button" variant="outline"><FileDown className="size-4" /> Export</Button>
            <Button asChild><Link href={`/app/${workspaceSlug}/finance/expenses`}><Plus className="size-4" /> Ajouter depense</Link></Button>
          </>
        }
      />
      {budgetQuery.error || analyticsQuery.error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">Impossible de charger le detail du budget.</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {analyticsQuery.isLoading ? [1, 2, 3, 4, 5, 6].map((item) => <div className="h-24 animate-pulse rounded-md border border-border bg-white" key={item} />) : kpis.map(([value, label]) => (
          <Card className="rounded-md" key={label}>
            <CardContent className="p-4">
              <div className="text-xl font-black tracking-normal text-slate-950">{value}</div>
              <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="rounded-md xl:col-span-8">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-950"><BarChart3 className="size-4" /> Evolution consommee</CardTitle></CardHeader>
          <CardContent>
            <div className="flex h-64 items-end gap-2 rounded-md border border-border bg-slate-50 p-4">
              {(analytics?.by_month.length ? analytics.by_month : []).map((item) => {
                const total = Number(analytics?.budget_total || 0);
                const itemRate = total ? Math.round((Number(item.actual) / total) * 100) : 0;
                return <div className="grid flex-1 gap-2" key={item.period}><div className="rounded-t bg-blue-700" style={{ height: `${Math.min(itemRate, 100)}%` }} /><span className="text-center text-[10px] text-slate-500">{dateLabel(item.period).slice(3)}</span></div>;
              })}
              {!analytics?.by_month.length ? <div className="grid flex-1 place-items-center text-sm font-semibold text-slate-500">Aucune depense validee sur ce budget.</div> : null}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-md xl:col-span-4">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-950"><AlertTriangle className="size-4" /> Etat du budget</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className={cn("rounded-md border p-3 font-bold", riskTone(rate))}>{rate > 100 ? "Budget depasse" : rate === 100 ? "Budget epuise" : rate >= 80 ? "Presque epuise" : rate >= 50 ? "A surveiller" : "Normal"}</div>
            <div className="rounded-md border border-border p-3 text-slate-600">Les alertes existantes sont declenchees une seule fois par seuil non resolu.</div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-md">
        <CardHeader><CardTitle className="text-base text-slate-950">Lignes budgetaires</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500"><tr>{["Categorie", "Prevu", "Engage", "Realise", "Restant", "%"].map((item) => <th className="py-3" key={item}>{item}</th>)}</tr></thead>
            <tbody>
              {analytics?.lines.map((line) => <tr className="border-t border-border" key={line.id}><td className="py-3 font-bold">{line.category}</td><td className="py-3 text-right">{money(line.planned, currency)}</td><td className="py-3 text-right">{money(line.committed, currency)}</td><td className="py-3 text-right">{money(line.actual, currency)}</td><td className="py-3 text-right">{money(line.remaining, currency)}</td><td className="py-3 text-right font-black">{line.consumption_rate}%</td></tr>)}
              {!analytics?.lines.length ? <tr><td className="py-8 text-center text-slate-500" colSpan={6}>Aucune ligne budgetaire.</td></tr> : null}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <section className="grid gap-4 pb-24 lg:grid-cols-2">
        <Card className="rounded-md">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-950"><ReceiptText className="size-4" /> Depenses associees</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {analytics?.transactions.map((item) => <div className="rounded-md border border-border p-3" key={item.id}><div className="flex justify-between gap-3"><strong>{item.description}</strong><span className="font-black">{money(item.amount, currency)}</span></div><p className="mt-1 text-xs text-slate-500">{dateLabel(item.date)} · {item.category} · {item.status}</p></div>)}
            {!analytics?.transactions.length ? <p className="text-sm font-semibold text-slate-500">Aucune depense associee.</p> : null}
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-950"><Clock3 className="size-4" /> Historique</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="rounded-md border border-border p-3">Budget cree le {budget ? dateLabel(budget.created_at.slice(0, 10)) : "-"}</div>
            <div className="rounded-md border border-border p-3">Derniere mise a jour le {budget ? dateLabel(budget.updated_at.slice(0, 10)) : "-"}</div>
            <div className="rounded-md border border-border p-3">Statut actuel: {budget?.status ?? "-"}</div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
