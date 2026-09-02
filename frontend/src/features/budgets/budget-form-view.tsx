"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bell, CalendarDays, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { activateBudget, createBudget, createBudgetLine, getBudgetSettings, listBudgetCategories, updateBudgetSettings } from "./api";

function todayYear() {
  return new Date().getFullYear();
}

export function BudgetFormView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const router = useRouter();
  const year = todayYear();
  const [form, setForm] = useState({
    name: "",
    total_amount: "",
    category: "",
    period_type: "ANNUAL",
    start_date: `${year}-01-01`,
    end_date: `${year}-12-31`,
    description: ""
  });
  const [thresholds, setThresholds] = useState<number[]>([50, 80, 90, 100]);
  const categoriesQuery = useQuery({ queryKey: ["budget-categories", workspaceSlug], queryFn: () => listBudgetCategories(workspaceSlug) });
  const settingsQuery = useQuery({ queryKey: ["budget-settings", workspaceSlug], queryFn: () => getBudgetSettings(workspaceSlug) });

  const createMutation = useMutation({
    mutationFn: async () => {
      const cleanedThresholds = [...new Set(thresholds.map(Number).filter((value) => value > 0 && value <= 100))].sort((a, b) => a - b);
      if (cleanedThresholds.length) {
        await updateBudgetSettings(workspaceSlug, {
          thresholds: {
            ...(settingsQuery.data?.thresholds ?? {}),
            watch: cleanedThresholds[0] ?? 50,
            attention: cleanedThresholds.find((value) => value >= 75) ?? cleanedThresholds[1] ?? 80,
            critical: cleanedThresholds.find((value) => value >= 90) ?? cleanedThresholds.at(-1) ?? 90,
            exceeded: 100
          }
        });
      }
      const budget = await createBudget(workspaceSlug, {
        name: form.name.trim(),
        description: form.description.trim(),
        period_type: form.period_type,
        scope_type: "WORKSPACE",
        start_date: form.start_date,
        end_date: form.end_date,
        total_amount: form.total_amount
      });
      await createBudgetLine(workspaceSlug, budget.id, { category: Number(form.category), planned_amount: form.total_amount });
      await activateBudget(workspaceSlug, budget.id);
      return budget;
    },
    onSuccess: (budget) => {
      router.push(`/app/${workspaceSlug}/budgets/${budget.id}`);
    }
  });

  const invalidThresholds = thresholds.some((value) => !Number.isFinite(value) || value <= 0 || value > 100) || new Set(thresholds).size !== thresholds.length;
  const canSubmit = form.name.trim().length > 0 && Number(form.total_amount) > 0 && Boolean(form.category) && form.start_date <= form.end_date && !invalidThresholds && !createMutation.isPending;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5 overflow-x-hidden p-4 md:p-0">
      <PageHeader
        title="Nouveau budget"
        description="Creez un budget et definissez ses regles de suivi."
        actions={<Button asChild variant="outline"><Link href={`/app/${workspaceSlug}/budgets`}><ArrowLeft className="size-4" /> Retour</Link></Button>}
      />

      {createMutation.error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{createMutation.error.message}</div> : null}

      <form
        className="grid gap-5 pb-24"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) createMutation.mutate();
        }}
      >
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base text-slate-950">Informations generales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="grid gap-2 text-sm font-bold text-slate-800">
              Nom du budget *
              <input className="min-h-12 rounded-md border border-border px-3 font-medium outline-none focus:border-blue-600" maxLength={180} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Budget fonctionnement 2026" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-800">
                Montant alloue *
                <input className="min-h-12 rounded-md border border-border px-3 font-medium outline-none focus:border-blue-600" min="1" required type="number" value={form.total_amount} onChange={(event) => setForm({ ...form, total_amount: event.target.value })} placeholder="5000000" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-800">
                Categorie *
                <select className="min-h-12 rounded-md border border-border bg-white px-3 outline-none focus:border-blue-600" required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                  <option value="">Selectionner une categorie</option>
                  {categoriesQuery.data?.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-2 text-sm font-bold text-slate-800">
                Periode
                <select className="min-h-12 rounded-md border border-border bg-white px-3 outline-none focus:border-blue-600" value={form.period_type} onChange={(event) => setForm({ ...form, period_type: event.target.value })}>
                  <option value="MONTHLY">Mensuel</option>
                  <option value="QUARTERLY">Trimestriel</option>
                  <option value="SEMIANNUAL">Semestriel</option>
                  <option value="ANNUAL">Annuel</option>
                  <option value="CUSTOM">Personnalise</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-800">
                Date de debut *
                <input className="min-h-12 rounded-md border border-border px-3 font-medium outline-none focus:border-blue-600" required type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} />
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-800">
                Date de fin *
                <input className="min-h-12 rounded-md border border-border px-3 font-medium outline-none focus:border-blue-600" required type="date" value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-bold text-slate-800">
              Description
              <textarea className="min-h-28 rounded-md border border-border px-3 py-3 font-medium outline-none focus:border-blue-600" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Budget destine aux depenses courantes..." />
            </label>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-slate-950"><Bell className="size-4 text-blue-700" /> Alerte de consommation</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-slate-500">Recevez une alerte lorsque le budget atteint un certain niveau de consommation.</p>
            <div className="grid gap-3">
              {thresholds.map((threshold, index) => (
                <div className="flex items-center gap-3 rounded-md border border-border p-3" key={`${threshold}-${index}`}>
                  <CalendarDays className="size-4 text-blue-700" />
                  <label className="flex flex-1 items-center gap-2 text-sm font-bold text-slate-800">
                    Alerte {index + 1}
                    <input className="ml-auto min-h-10 w-24 rounded-md border border-border px-3 text-right outline-none focus:border-blue-600" min="1" max="100" type="number" value={threshold} onChange={(event) => setThresholds(thresholds.map((item, itemIndex) => itemIndex === index ? Number(event.target.value) : item))} />
                    %
                  </label>
                  <button className="grid size-10 place-items-center rounded-md bg-red-50 text-red-700 disabled:opacity-40" disabled={thresholds.length <= 1} type="button" aria-label="Supprimer le seuil" onClick={() => setThresholds(thresholds.filter((_, itemIndex) => itemIndex !== index))}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            {invalidThresholds ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">Chaque seuil doit etre unique et compris entre 1 et 100%.</div> : null}
            <Button type="button" variant="outline" onClick={() => setThresholds([...thresholds, Math.min(100, (thresholds.at(-1) ?? 70) + 10)])}><Plus className="size-4" /> Ajouter un seuil</Button>
          </CardContent>
        </Card>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:static md:rounded-md md:border">
          <Button className="w-full" disabled={!canSubmit} type="submit">
            {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Creer le budget
          </Button>
        </div>
      </form>
    </div>
  );
}
