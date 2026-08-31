import { AlertTriangle, ArrowDown, ArrowUp, BarChart3, FileWarning, Plus, Scale, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const primaryKpis = [
  ["0 XOF", "Solde disponible", Wallet],
  ["0 XOF", "Total recettes", ArrowUp],
  ["0 XOF", "Total depenses", ArrowDown],
  ["0 XOF", "Flux net", Scale],
  ["0 XOF", "Recettes du mois", ArrowUp],
  ["0 XOF", "Depenses du mois", ArrowDown],
] satisfies ReadonlyArray<readonly [string, string, LucideIcon]>;

const secondaryKpis = [
  ["0%", "Croissance recettes"],
  ["0%", "Croissance depenses"],
  ["0%", "Depenses / recettes"],
  ["0 XOF", "Moyenne mensuelle"],
  ["0 XOF", "Plus grosse recette"],
  ["0 XOF", "Plus grosse depense"],
];

export function FinanceDashboardView() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Finances"
        description="Tresorerie, recettes, depenses, categories et grand livre financier."
        actions={
          <>
            <Button type="button" variant="outline"><ArrowDown className="size-4" /> Depense rapide</Button>
            <Button type="button"><Plus className="size-4" /> Recette</Button>
          </>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {primaryKpis.map(([value, label, Icon]) => (
          <Card key={String(label)}><CardContent className="p-5"><Icon className="size-5 text-blue-700" /><div className="mt-3 text-3xl font-bold tabular-nums">{value}</div><p className="text-sm text-slate-500">{label}</p></CardContent></Card>
        ))}
      </section>
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {secondaryKpis.map(([value, label]) => (
          <Card key={label}><CardContent className="p-4"><div className="text-xl font-bold tabular-nums">{value}</div><p className="text-xs text-slate-500">{label}</p></CardContent></Card>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="size-4" /> Evolution financiere</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-2">{["7 jours", "30 jours", "3 mois", "6 mois", "12 mois"].map((item) => <Button key={item} type="button" variant="outline">{item}</Button>)}</div>
            <div className="flex h-64 items-end gap-2 rounded-md border border-border p-4">
              {[38, 72, 46, 88, 56, 78, 64, 92].map((height) => <div key={height} className="grid flex-1 gap-1"><div className="rounded-t bg-emerald-600" style={{ height: `${height}%` }} /><div className="rounded-t bg-red-500" style={{ height: `${Math.max(12, height - 28)}%` }} /></div>)}
            </div>
          </CardContent>
        </Card>
        <Card className="xl:col-span-4">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="size-4" /> Alertes</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {["Depenses inhabituelles", "Budget presque atteint", "Justificatif manquant"].map((label) => <div key={label} className="flex items-center gap-3 rounded-md border border-border p-3"><FileWarning className="size-4 text-amber-700" /><span>{label}</span><span className="ml-auto text-slate-500">0</span></div>)}
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        {["Repartition des recettes", "Repartition des depenses"].map((title) => (
          <Card key={title}>
            <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {["Cotisations", "Dons", "Subventions", "Transport", "Communication", "Autres"].slice(0, 5).map((item) => <div key={item} className="flex justify-between"><span>{item}</span><span className="text-slate-500">0 XOF - 0%</span></div>)}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
