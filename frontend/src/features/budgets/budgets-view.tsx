"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, ChevronRight, Download, Landmark, Plus, RotateCcw, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { getBudgetDashboard, listBudgets, type BudgetResource } from "./api";

function money(value: string | number | undefined, currency = "FCFA") {
  const amount = Number(value ?? 0);
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} ${currency === "XOF" ? "FCFA" : currency}`;
}

function riskLabel(risk: string, rate: number) {
  if (rate > 100 || risk === "EXCEEDED") return "Depasse";
  if (rate === 100) return "Epuise";
  if (rate >= 80 || risk === "CRITICAL") return "Presque epuise";
  if (rate >= 50 || risk === "WATCH" || risk === "ATTENTION") return "A surveiller";
  if (rate === 0) return "Non consomme";
  return "Normal";
}

function tone(label: string) {
  if (label === "Depasse") return "border-red-200 bg-red-50 text-red-700";
  if (label === "Epuise" || label === "Presque epuise") return "border-orange-200 bg-orange-50 text-orange-700";
  if (label === "A surveiller") return "border-amber-200 bg-amber-50 text-amber-700";
  if (label === "Non consomme") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function Donut({ rate }: Readonly<{ rate: number }>) {
  const displayRate = Math.round(rate);
  const visibleRate = Math.min(Math.max(rate, 0), 100);
  return (
    <div className="relative grid size-44 place-items-center rounded-full" style={{ background: `conic-gradient(${rate > 100 ? "#dc2626" : "#0f72f2"} ${visibleRate * 3.6}deg, #e5e7eb 0deg)` }}>
      <div className="grid size-32 place-items-center rounded-full bg-white shadow-inner">
        <div className="text-center">
          <div className={cn("text-4xl font-black tracking-normal", rate > 100 ? "text-red-700" : "text-slate-950")}>{displayRate}%</div>
          <p className="text-xs font-bold text-slate-500">consomme</p>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return <div className="min-h-32 animate-pulse rounded-card border border-border bg-white p-5"><div className="h-4 w-28 rounded bg-slate-100" /><div className="mt-5 h-9 w-36 rounded bg-slate-100" /><div className="mt-5 h-3 rounded bg-slate-100" /></div>;
}

function BudgetCard({ budget, workspaceSlug }: Readonly<{ budget: BudgetResource; workspaceSlug: string }>) {
  const metrics = budget.metrics;
  const rate = Number(metrics.consumption_rate || 0);
  const state = riskLabel(metrics.risk_level, rate);
  const firstCategory = metrics.lines[0]?.category || "Budget general";
  const currency = budget.currency;

  return (
    <Link href={`/app/${workspaceSlug}/budgets/${budget.id}`} className="block">
      <Card className="h-full rounded-md transition hover:border-blue-200 hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-black text-slate-950">{budget.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{firstCategory}</p>
            </div>
            <span className={cn("shrink-0 rounded-md border px-2 py-1 text-xs font-bold", tone(state))}>{state}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-500">Alloue</span><strong className="block text-slate-950">{money(metrics.budget_total, currency)}</strong></div>
            <div><span className="text-slate-500">Depense</span><strong className="block text-slate-950">{money(metrics.actual, currency)}</strong></div>
            <div><span className="text-slate-500">Restant</span><strong className="block text-slate-950">{money(metrics.remaining, currency)}</strong></div>
            <div><span className="text-slate-500">Lignes</span><strong className="block text-slate-950">{metrics.lines.length}</strong></div>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
            <div className={cn("h-full", rate > 100 ? "bg-red-600" : rate >= 80 ? "bg-orange-500" : rate >= 50 ? "bg-amber-500" : "bg-blue-700")} style={{ width: `${Math.min(rate, 100)}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-sm font-bold text-slate-700">
            <span>{rate}%</span>
            <span className="inline-flex items-center gap-1 text-blue-700">Detail <ChevronRight className="size-4" /></span>
          </div>
          {Number(metrics.overrun) > 0 ? <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs font-bold text-red-700">Depassement: {money(metrics.overrun, currency)}</div> : null}
        </CardContent>
      </Card>
    </Link>
  );
}

export function BudgetsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const dashboardQuery = useQuery({ queryKey: ["budget-dashboard", workspaceSlug, year], queryFn: () => getBudgetDashboard(workspaceSlug, year) });
  const budgetsQuery = useQuery({ queryKey: ["budgets", workspaceSlug, year], queryFn: () => listBudgets(workspaceSlug, year) });
  const dashboard = dashboardQuery.data;
  const rate = Number(dashboard?.consumption_rate || 0);
  const currency = dashboard?.currency ?? "FCFA";

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 overflow-x-hidden p-4 md:p-0">
      <PageHeader
        title="Budgets"
        description="Planifiez, suivez et controlez les ressources financieres de votre association."
        actions={
          <>
            <label className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-bold text-slate-700">
              <CalendarDays className="size-4 text-blue-700" />
              <input className="w-20 bg-transparent outline-none" type="number" value={year} onChange={(event) => setYear(Number(event.target.value))} aria-label="Annee budgetaire" />
            </label>
            <Button type="button" variant="outline"><Download className="size-4" /> Exporter</Button>
            <Button asChild><Link href={`/app/${workspaceSlug}/budgets/new`}><Plus className="size-4" /> Nouveau budget</Link></Button>
          </>
        }
      />

      {(dashboardQuery.error as { status?: number } | null)?.status === 503 ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">Backend indisponible. Verifiez que Django tourne sur le port 8002.</div> : null}

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-md">
          <CardContent className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="grid place-items-center">
              {dashboardQuery.isLoading ? <div className="size-44 animate-pulse rounded-full bg-slate-100" /> : <Donut rate={rate} />}
            </div>
            <div>
              <CardTitle className="text-xs uppercase text-slate-500">Budget annuel</CardTitle>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Consommation globale</h2>
              <p className="mt-2 text-sm text-slate-500">Calcul base sur le montant total depense divise par le montant total alloue pour {year}.</p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-slate-50 p-3"><span className="text-slate-500">Budgets analyses</span><strong className="block text-xl text-slate-950">{dashboard?.budgets.length ?? 0}</strong></div>
                <div className={cn("rounded-md border p-3", tone(riskLabel("", rate)))}><span>Etat</span><strong className="block text-xl">{riskLabel("", rate)}</strong></div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-3">
          {dashboardQuery.isLoading ? [1, 2].map((item) => <SkeletonCard key={item} />) : (
            <>
              <Card className="rounded-md"><CardContent className="p-5"><Landmark className="size-5 text-blue-700" /><p className="mt-3 text-sm font-bold text-slate-500">Montant alloue</p><div className="mt-1 text-3xl font-black text-slate-950">{money(dashboard?.budget_total, currency)}</div><p className="mt-2 text-sm text-slate-500">{money(dashboard?.remaining, currency)} restant</p></CardContent></Card>
              <Card className="rounded-md"><CardContent className="p-5"><WalletCards className="size-5 text-blue-700" /><p className="mt-3 text-sm font-bold text-slate-500">Montant depense</p><div className="mt-1 text-3xl font-black text-slate-950">{money(dashboard?.actual, currency)}</div><p className="mt-2 text-sm text-slate-500">{money(dashboard?.committed, currency)} en attente/engage</p></CardContent></Card>
            </>
          )}
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">Budgets</h2>
            <p className="text-sm text-slate-500">Suivez la consommation et l'etat de chaque budget.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => setYear(now.getFullYear())}><RotateCcw className="size-4" /> Reinitialiser</Button>
        </div>
        {budgetsQuery.isLoading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <SkeletonCard key={item} />)}</div> : null}
        {!budgetsQuery.isLoading && (!budgetsQuery.data?.length || budgetsQuery.isError) ? (
          <Card className="rounded-md">
            <CardContent className="grid place-items-center p-10 text-center">
              <Landmark className="size-10 text-blue-700" />
              <h3 className="mt-3 text-lg font-black text-slate-950">Aucun budget cree</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500">Creez votre premier budget pour suivre l'utilisation de vos ressources.</p>
              <Button asChild className="mt-5"><Link href={`/app/${workspaceSlug}/budgets/new`}><Plus className="size-4" /> Creer un budget</Link></Button>
            </CardContent>
          </Card>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {budgetsQuery.data?.map((budget) => <BudgetCard budget={budget} workspaceSlug={workspaceSlug} key={budget.id} />)}
        </div>
      </section>

      {dashboard?.alerts.length ? (
        <section className="grid gap-3 pb-24">
          <h2 className="text-lg font-black text-slate-950">Alertes budgetaires</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {dashboard.alerts.map((alert) => <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800" key={alert.id}><AlertTriangle className="mb-2 size-4" />{alert.message}</div>)}
          </div>
        </section>
      ) : null}

      <Link className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-5 z-30 grid size-14 place-items-center rounded-full bg-blue-700 text-white shadow-2xl md:bottom-7" href={`/app/${workspaceSlug}/budgets/new`} aria-label="Creer un budget">
        <Plus className="size-7" />
      </Link>
    </div>
  );
}
