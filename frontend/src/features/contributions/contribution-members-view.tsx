import { Download, Filter, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const kpis = [
  ["0 XOF", "Total du"],
  ["0 XOF", "Total paye"],
  ["0 XOF", "Total restant"],
  ["0%", "Taux de paiement"],
  ["0", "Retards"],
  ["0 XOF", "Montant en retard"],
  ["0 jour", "Retard moyen"],
];

export function ContributionMembersView() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Membres et cotisations"
        description="Suivi individuel du recouvrement par membre."
        actions={
          <>
            <Button type="button" variant="outline"><Send className="size-4" /> Relancer</Button>
            <Button type="button" variant="outline"><Download className="size-4" /> Exporter</Button>
          </>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([value, label]) => (
          <Card key={label}><CardContent className="p-5"><div className="text-2xl font-bold tabular-nums">{value}</div><p className="mt-1 text-sm text-slate-500">{label}</p></CardContent></Card>
        ))}
      </section>
      <section className="rounded-card border border-border bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_140px_130px]">
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-slate-500">
            <Search className="size-4" />
            <input className="w-full bg-transparent outline-none" placeholder="Rechercher un membre..." />
          </label>
          <select className="min-h-10 rounded-md border border-border px-3 text-sm">
            <option>Tous les statuts</option>
            <option>A jour</option>
            <option>Partiel</option>
            <option>En retard</option>
            <option>Non paye</option>
          </select>
          <Button type="button" variant="outline"><Filter className="size-4" /> Trier</Button>
          <Button type="button" variant="outline">CSV</Button>
        </div>
        <div className="mt-4 hidden grid-cols-[1fr_120px_120px_120px_100px_130px_130px] gap-3 border-b border-border px-3 py-3 text-xs font-semibold uppercase text-slate-500 lg:grid">
          <span>Membre</span><span>Du</span><span>Paye</span><span>Reste</span><span>Taux</span><span>Statut</span><span>Echeance</span>
        </div>
        <div className="grid place-items-center p-10 text-center text-sm text-slate-500">Aucune ligne membre chargee.</div>
      </section>
    </div>
  );
}
