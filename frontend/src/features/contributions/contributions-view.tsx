import { BarChart3, CalendarClock, CreditCard, Filter, Plus, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { ContributionCampaignForm } from "./contribution-campaign-form";
import { CONTRIBUTION_STATUSES, CONTRIBUTION_TYPES } from "./contribution-status";

const kpis = [
  ["0 XOF", "Total attendu"],
  ["0 XOF", "Total collecte"],
  ["0 XOF", "Reste a collecter"],
  ["0%", "Taux de recouvrement"],
  ["0", "Membres a jour"],
  ["0", "Membres en retard"],
  ["0", "Echeances proches"],
  ["0", "Cotisations actives"],
];

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
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([value, label]) => (
          <Card key={label}><CardContent className="p-5"><div className="text-3xl font-bold tabular-nums">{value}</div><p className="mt-1 text-sm text-slate-500">{label}</p></CardContent></Card>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><BarChart3 className="size-4" /> Evolution des collectes</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid h-72 place-items-center rounded-md border border-dashed border-border bg-slate-50 text-center">
              <div>
                <CalendarClock className="mx-auto size-8 text-blue-700" />
                <p className="mt-2 font-semibold">Aucune campagne active.</p>
                <p className="text-sm text-slate-500">Les courbes objectif, collecte et restant apparaitront avec les donnees reelles.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-border p-4">
                <strong>Repartition des statuts</strong>
                <div className="mt-4 grid gap-2 text-sm text-slate-600">
                  {CONTRIBUTION_STATUSES.slice(0, 4).map((item) => <div className="flex justify-between" key={item.value}><span>{item.label}</span><span>0</span></div>)}
                </div>
              </div>
              <div className="rounded-md border border-border p-4">
                <strong>Tendance recouvrement</strong>
                <div className="mt-4 h-2 rounded-full bg-slate-100"><div className="h-2 w-0 rounded-full bg-blue-700" /></div>
                <p className="mt-2 text-sm text-slate-500">0% sur la periode selectionnee.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader><CardTitle className="text-base text-slate-900">Creer une campagne</CardTitle></CardHeader>
          <CardContent>
            <ContributionCampaignForm />
          </CardContent>
        </Card>
      </section>
      <section className="rounded-card border border-border bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_180px_140px]">
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-slate-500">
            <Search className="size-4" />
            <input className="w-full bg-transparent outline-none" placeholder="Nom, prenom, telephone ou numero membre..." />
          </label>
          <select className="min-h-10 rounded-md border border-border px-3 text-sm"><option>Statut</option>{CONTRIBUTION_STATUSES.map((item) => <option key={item.value}>{item.label}</option>)}</select>
          <select className="min-h-10 rounded-md border border-border px-3 text-sm"><option>Type campagne</option>{CONTRIBUTION_TYPES.map((item) => <option key={item.value}>{item.label}</option>)}</select>
          <Button type="button" variant="outline"><Filter className="size-4" /> Periode</Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Tous", "A jour", "Partiellement payes", "En retard", "Non payes"].map((filter) => <Button key={filter} type="button" variant="outline">{filter}</Button>)}
        </div>
        <div className="mt-4 hidden grid-cols-[1fr_120px_120px_120px_120px_130px_160px] gap-3 border-b border-border px-3 py-3 text-xs font-semibold uppercase text-slate-500 lg:grid">
          <span>Membre</span><span>Montant du</span><span>Paye</span><span>Reste</span><span>Statut</span><span>Echeance</span><span>Actions</span>
        </div>
        <div className="grid place-items-center p-10 text-center">
          <div>
            <CreditCard className="mx-auto size-8 text-blue-700" />
            <h2 className="mt-3 font-semibold">Aucune cotisation individuelle chargee.</h2>
            <p className="mt-1 text-sm text-slate-500">Les obligations generees par campagne apparaitront ici avec pagination API.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
