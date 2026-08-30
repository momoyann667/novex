import { CalendarDays, CheckCircle2, FolderKanban, Gauge, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const steps = ["General", "Periode", "Montant", "Categories", "Portee", "Alertes", "Confirmation"];
const lines = [
  ["Transport", "500 000"],
  ["Communication", "300 000"],
  ["Evenement", "800 000"],
];

export function BudgetFormView() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Nouveau budget" description="Creation guidee avec controles backend sur periode, scope et repartition." />
      <div className="grid gap-2 md:grid-cols-7">
        {steps.map((step, index) => <div className="rounded-md border border-border bg-white p-3 text-sm" key={step}><span className="text-xs text-slate-500">Etape {index + 1}</span><div className="font-semibold">{step}</div></div>)}
      </div>
      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader><CardTitle className="text-base">Parametres du budget</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            {["Nom du budget", "Description", "Date de debut", "Date de fin", "Montant total", "Devise"].map((label) => (
              <label className="grid gap-2 text-sm font-medium" key={label}>{label}<input className="min-h-11 rounded-md border border-border px-3 font-normal" placeholder={label} /></label>
            ))}
            <div className="grid gap-3 md:grid-cols-3">
              {["Mensuel", "Trimestriel", "Annuel"].map((item) => <Button type="button" variant="outline" key={item}><CalendarDays className="size-4" /> {item}</Button>)}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {["Association", "Projet", "Evenement"].map((item) => <Button type="button" variant="outline" key={item}><FolderKanban className="size-4" /> {item}</Button>)}
            </div>
          </CardContent>
        </Card>
        <Card className="xl:col-span-4">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Gauge className="size-4" /> Repartition</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            {lines.map(([name, amount]) => <div className="flex items-center justify-between rounded-md border border-border p-3 text-sm" key={name}><span>{name}</span><strong>{amount} XOF</strong></div>)}
            <div className="flex justify-between border-t border-border pt-4 text-lg font-bold"><span>Total</span><span>1 600 000 XOF</span></div>
            <Button type="button" variant="outline"><Plus className="size-4" /> Ajouter une ligne</Button>
            <Button type="button"><CheckCircle2 className="size-4" /> Creer le budget</Button>
            <Button type="button" variant="ghost"><SlidersHorizontal className="size-4" /> Regles d'alerte</Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

