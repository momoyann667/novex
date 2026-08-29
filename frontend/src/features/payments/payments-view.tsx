import { ArrowDownUp, Banknote, CreditCard, Download, Filter, Landmark, RefreshCcw, Search, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const kpis = [
  ["0 XOF", "Encaissements reussis"],
  ["0 XOF", "En attente provider"],
  ["0", "Paiements echoues"],
  ["0%", "Taux de succes"],
];

const methods = [
  { label: "Mobile Money", icon: Smartphone },
  { label: "Carte", icon: CreditCard },
  { label: "Agregateur", icon: ArrowDownUp },
  { label: "Virement", icon: Landmark },
];

export function PaymentsView() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Paiements"
        description="Historique, providers, confirmations webhook et remboursements des cotisations."
        actions={
          <>
            <Button type="button" variant="outline"><Download className="size-4" /> Export</Button>
            <Button type="button"><Banknote className="size-4" /> Encaisser</Button>
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
          <CardHeader><CardTitle className="text-base text-slate-900">Flux provider</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-4">
              {methods.map((method) => {
                const Icon = method.icon;
                return (
                  <div key={method.label} className="rounded-md border border-border p-4">
                    <Icon className="size-5 text-blue-700" />
                    <p className="mt-3 text-sm font-semibold">{method.label}</p>
                    <p className="text-xs text-slate-500">Provider env-HMAC ou connecteur futur.</p>
                  </div>
                );
              })}
            </div>
            <div className="rounded-md border border-border p-4">
              <div className="flex items-start gap-3 text-sm text-slate-600">
                <ShieldCheck className="size-5 text-blue-700" />
                <p>Un paiement ne passe a reussi qu'apres verification backend: reference, montant, devise, signature HMAC et transition autorisee.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader><CardTitle className="text-base text-slate-900">Initialisation rapide</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <label className="grid gap-1 text-sm"><span className="text-slate-500">Cotisation</span><input className="min-h-10 rounded-md border border-border px-3 outline-none" placeholder="ID cotisation" /></label>
            <label className="grid gap-1 text-sm"><span className="text-slate-500">Montant</span><input className="min-h-10 rounded-md border border-border px-3 outline-none" placeholder="0" /></label>
            <select className="min-h-10 rounded-md border border-border px-3 text-sm">
              <option>Mobile Money</option>
              <option>Carte bancaire</option>
              <option>Agregateur</option>
              <option>Virement</option>
            </select>
            <Button type="button"><CreditCard className="size-4" /> Initialiser</Button>
          </CardContent>
        </Card>
      </section>
      <section className="rounded-card border border-border bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_180px_150px_120px]">
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-slate-500">
            <Search className="size-4" />
            <input className="w-full bg-transparent outline-none" placeholder="Reference, membre ou transaction provider..." />
          </label>
          <select className="min-h-10 rounded-md border border-border px-3 text-sm"><option>Statut</option><option>SUCCESS</option><option>PROCESSING</option><option>FAILED</option><option>REFUNDED</option></select>
          <select className="min-h-10 rounded-md border border-border px-3 text-sm"><option>Methode</option>{methods.map((item) => <option key={item.label}>{item.label}</option>)}</select>
          <Button type="button" variant="outline"><Filter className="size-4" /> Periode</Button>
          <Button type="button" variant="outline"><RefreshCcw className="size-4" /> Sync</Button>
        </div>
        <div className="mt-4 hidden grid-cols-[150px_1fr_120px_120px_130px_140px_120px] gap-3 border-b border-border px-3 py-3 text-xs font-semibold uppercase text-slate-500 lg:grid">
          <span>Reference</span><span>Membre</span><span>Montant</span><span>Net</span><span>Statut</span><span>Provider</span><span>Date</span>
        </div>
        <div className="grid place-items-center p-10 text-center">
          <div>
            <CreditCard className="mx-auto size-8 text-blue-700" />
            <h2 className="mt-3 font-semibold">Aucun paiement charge.</h2>
            <p className="mt-1 text-sm text-slate-500">La liste affichera les paiements pagines exposes par l'API du workspace.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
