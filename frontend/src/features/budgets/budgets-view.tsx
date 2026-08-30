import Link from "next/link";
import { AlertTriangle, Archive, BarChart3, FileSpreadsheet, Gauge, Landmark, Plus, TrendingUp, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const kpis = [
  ["8 500 000 XOF", "Budget total", Landmark],
  ["1 950 000 XOF", "Engage", WalletCards],
  ["3 120 000 XOF", "Consomme", TrendingUp],
  ["3 430 000 XOF", "Restant", Gauge],
  ["36.7%", "Consommation", BarChart3],
  ["2", "Budgets a risque", AlertTriangle],
];

const budgets = [
  { id: "annual-2027", name: "Budget annuel 2027", used: "2 400 000", total: "5 000 000", rate: 48, rest: "2 600 000", state: "Normal" },
  { id: "gala-annual", name: "Gala annuel", used: "1 280 000", total: "1 500 000", rate: 85, rest: "220 000", state: "Attention" },
  { id: "center-project", name: "Construction centre", used: "3 100 000", total: "2 900 000", rate: 107, rest: "-200 000", state: "Depasse" },
];

const rows = [
  ["Communication", "500 000", "0", "350 000", "150 000", "70%"],
  ["Transport", "1 000 000", "120 000", "610 000", "270 000", "61%"],
  ["Evenements", "2 000 000", "550 000", "1 200 000", "250 000", "60%"],
  ["Fournitures", "500 000", "45 000", "160 000", "295 000", "32%"],
];

function tone(state: string) {
  if (state === "Depasse") return "border-red-200 bg-red-50 text-red-700";
  if (state === "Attention") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function BudgetsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Budgets"
        description="Controle budgetaire, previsionnel, realise, alertes et depenses affectees."
        actions={
          <>
            <Button type="button" variant="outline"><Archive className="size-4" /> Archives</Button>
            <Button asChild><Link href={`/app/${workspaceSlug}/budgets/new`}><Plus className="size-4" /> Nouveau budget</Link></Button>
          </>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map(([value, label, Icon]) => (
          <Card key={String(label)}>
            <CardContent className="p-5">
              <Icon className="size-5 text-blue-700" />
              <div className="mt-3 text-3xl font-bold tabular-nums">{value}</div>
              <p className="text-sm text-slate-500">{label}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-3">
        {budgets.map((budget) => (
          <Link href={`/app/${workspaceSlug}/budgets/${budget.id}`} key={budget.id}>
            <Card className="h-full transition hover:border-blue-200 hover:shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between gap-3 text-base text-slate-900">
                  <span>{budget.name}</span>
                  <span className={`rounded-md border px-2 py-1 text-xs ${tone(budget.state)}`}>{budget.state}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums">{budget.used} / {budget.total} XOF</div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full ${budget.rate >= 100 ? "bg-red-600" : budget.rate >= 75 ? "bg-amber-500" : "bg-blue-700"}`} style={{ width: `${Math.min(budget.rate, 100)}%` }} />
                </div>
                <div className="mt-3 flex justify-between text-sm text-slate-600"><span>{budget.rate}%</span><span>Restant: {budget.rest} XOF</span></div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileSpreadsheet className="size-4" /> Previsionnel vs realise</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr>{["Categorie", "Prevu", "Engage", "Realise", "Restant", "%"].map((item) => <th className="py-3" key={item}>{item}</th>)}</tr></thead>
              <tbody>
                {rows.map((row) => <tr className="border-t border-border" key={row[0]}>{row.map((item, index) => <td className={`py-3 ${index > 0 ? "text-right tabular-nums" : ""}`} key={item}>{item}</td>)}</tr>)}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card className="xl:col-span-4">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="size-4" /> Alertes budgetaires</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {["Gala annuel: seuil 75% atteint", "Construction centre: budget depasse", "Depenses non budgetisees: 180 000 XOF"].map((item) => (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800" key={item}>{item}</div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
