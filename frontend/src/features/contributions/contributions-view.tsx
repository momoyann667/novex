import { CalendarClock, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export function ContributionsView() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Cotisations"
        description="Pilotez les campagnes, montants dus, retards et recouvrements."
        actions={
          <>
            <Button type="button" variant="outline"><Send className="size-4" /> Relancer</Button>
            <Button type="button"><Plus className="size-4" /> Creer une campagne</Button>
          </>
        }
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["0 XOF", "Montant attendu"],
          ["0 XOF", "Collecte"],
          ["0 XOF", "Restant"],
          ["0%", "Taux de recouvrement"],
        ].map(([value, label]) => (
          <Card key={label}><CardContent className="p-5"><div className="text-3xl font-bold tabular-nums">{value}</div><p className="mt-1 text-sm text-slate-500">{label}</p></CardContent></Card>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader><CardTitle className="text-base text-slate-900">Evolution des cotisations</CardTitle></CardHeader>
          <CardContent>
            <div className="grid h-72 place-items-center rounded-md border border-dashed border-border bg-slate-50 text-center">
              <div>
                <CalendarClock className="mx-auto size-8 text-blue-700" />
                <p className="mt-2 font-semibold">Aucune campagne active.</p>
                <p className="text-sm text-slate-500">Les courbes objectif, collecte et restant apparaitront avec les donnees reelles.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader><CardTitle className="text-base text-slate-900">Cotisations en retard</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div className="text-3xl font-bold">0 membre</div>
            <p className="text-sm text-slate-500">Aucun retard calcule dans les donnees actuelles.</p>
            <Button type="button" variant="outline">Voir les membres concernes</Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
