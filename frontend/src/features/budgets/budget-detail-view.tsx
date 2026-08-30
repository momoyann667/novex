import Link from "next/link";
import { AlertTriangle, ArrowLeft, BarChart3, Clock3, FileDown, Plus, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const kpis = [["5 000 000 XOF", "Budget"], ["2 400 000 XOF", "Consomme"], ["380 000 XOF", "Engage"], ["2 220 000 XOF", "Disponible"], ["48%", "Taux"], ["2 600 000 XOF", "Ecart"]];
const lines = [["Communication", "500 000", "0", "350 000", "150 000", "70%"], ["Transport", "1 000 000", "120 000", "610 000", "270 000", "61%"], ["Projets", "3 500 000", "260 000", "1 440 000", "1 800 000", "41%"]];
const history = ["Budget cree", "Budget active", "Depense de 150 000 affectee", "Seuil de 50% atteint"];

export function BudgetDetailView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Budget annuel 2027"
        description="Informations, KPI, repartition, transactions, alertes et historique."
        actions={
          <>
            <Button asChild variant="outline"><Link href={`/app/${workspaceSlug}/budgets`}><ArrowLeft className="size-4" /> Retour</Link></Button>
            <Button type="button" variant="outline"><FileDown className="size-4" /> Export</Button>
            <Button type="button"><Plus className="size-4" /> Ajouter depense</Button>
          </>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {kpis.map(([value, label]) => <Card key={label}><CardContent className="p-4"><div className="text-xl font-bold tabular-nums">{value}</div><p className="text-xs text-slate-500">{label}</p></CardContent></Card>)}
      </section>
      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="size-4" /> Evolution consommee</CardTitle></CardHeader>
          <CardContent>
            <div className="flex h-64 items-end gap-2 rounded-md border border-border p-4">
              {[10, 18, 27, 39, 48, 54, 62, 70].map((height) => <div className="grid flex-1 gap-2" key={height}><div className="rounded-t bg-blue-700" style={{ height: `${height}%` }} /><span className="text-center text-xs text-slate-500">{height}%</span></div>)}
            </div>
          </CardContent>
        </Card>
        <Card className="xl:col-span-4">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="size-4" /> Alertes</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-800">Seuil 50% atteint, notification in-app et email preparees.</div>
            <div className="rounded-md border border-slate-200 p-3 text-slate-600">WhatsApp et SMS reserves aux integrations futures.</div>
          </CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader><CardTitle className="text-base">Lignes budgetaires</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500"><tr>{["Categorie", "Prevu", "Engage", "Realise", "Restant", "%"].map((item) => <th className="py-3" key={item}>{item}</th>)}</tr></thead>
            <tbody>{lines.map((row) => <tr className="border-t border-border" key={row[0]}>{row.map((item, index) => <td className={`py-3 ${index > 0 ? "text-right tabular-nums" : ""}`} key={item}>{item}</td>)}</tr>)}</tbody>
          </table>
        </CardContent>
      </Card>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ReceiptText className="size-4" /> Transactions liees</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">{["Transport equipe - 150 000 XOF", "Campagne communication - 350 000 XOF", "Location salle - 420 000 XOF"].map((item) => <div className="rounded-md border border-border p-3" key={item}>{item}</div>)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock3 className="size-4" /> Historique</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">{history.map((item) => <div className="rounded-md border border-border p-3" key={item}>{item}</div>)}</CardContent>
        </Card>
      </section>
    </div>
  );
}

