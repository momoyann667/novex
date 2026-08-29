import { BarChart3, Download, Send, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const recoveryKpis = [
  ["0 XOF", "Total attendu"],
  ["0 XOF", "Total collecte"],
  ["0%", "Taux de recouvrement"],
  ["0 XOF", "Montant en retard"],
  ["0", "Retardataires"],
  ["0 XOF", "Montant moyen du"],
  ["0 XOF", "Montant moyen paye"],
];

const delaySegments = ["1-7 jours", "8-30 jours", "31-60 jours", "61-90 jours", "90+ jours"];

export function ContributionRecoveryView() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Recouvrement"
        description="Analyse des retards, relances et performances de campagnes."
        actions={
          <>
            <Button type="button" variant="outline"><Download className="size-4" /> Export</Button>
            <Button type="button"><Send className="size-4" /> Relance en masse</Button>
          </>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {recoveryKpis.map(([value, label]) => (
          <Card key={label}><CardContent className="p-5"><div className="text-2xl font-bold tabular-nums">{value}</div><p className="mt-1 text-sm text-slate-500">{label}</p></CardContent></Card>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><BarChart3 className="size-4" /> Segmentation des retards</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {delaySegments.map((segment) => (
              <div key={segment}>
                <div className="mb-1 flex justify-between text-sm"><span>{segment}</span><strong>0</strong></div>
                <div className="h-2 rounded-full bg-slate-100"><div className="h-2 w-0 rounded-full bg-blue-700" /></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><ShieldAlert className="size-4" /> Plus gros montants a recouvrer</CardTitle></CardHeader>
          <CardContent className="grid place-items-center p-10 text-center text-sm text-slate-500">Aucun impaye charge.</CardContent>
        </Card>
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        {["Cette semaine", "Ce mois", "Prochain mois"].map((period) => (
          <Card key={period}><CardContent className="p-5"><strong>{period}</strong><p className="mt-3 text-2xl font-bold">0 membre</p><p className="text-sm text-slate-500">0 XOF attendus</p></CardContent></Card>
        ))}
      </section>
    </div>
  );
}
