import { CreditCard, Download, FileText, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export function MemberFinancialHistoryView({ memberId }: Readonly<{ memberId: string }>) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Historique financier membre"
        description={`Membre #${memberId} - cotisations, paiements et recus.`}
        actions={<Button type="button" variant="outline"><Download className="size-4" /> Exporter</Button>}
      />
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["0 XOF", "Total cotisations"],
          ["0 XOF", "Total paye"],
          ["0 XOF", "Reste a payer"],
          ["0", "Paiements"],
          ["0", "Retards"],
          ["A charger", "Dernier paiement"],
        ].map(([value, label]) => (
          <Card key={label}><CardContent className="p-5"><div className="text-2xl font-bold tabular-nums">{value}</div><p className="mt-1 text-sm text-slate-500">{label}</p></CardContent></Card>
        ))}
      </section>
      <section className="rounded-card border border-border bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_150px_150px]">
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-slate-500">
            <Search className="size-4" />
            <input className="w-full bg-transparent outline-none" placeholder="Cotisation, reference, methode..." />
          </label>
          <select className="min-h-10 rounded-md border border-border px-3 text-sm"><option>Statut</option><option>SUCCESS</option><option>PROCESSING</option><option>FAILED</option></select>
          <select className="min-h-10 rounded-md border border-border px-3 text-sm"><option>Methode</option><option>Mobile Money</option><option>Carte</option><option>Manuel</option></select>
          <Button type="button" variant="outline"><Filter className="size-4" /> Periode</Button>
        </div>
        <div className="mt-4 hidden grid-cols-[130px_1fr_130px_140px_120px_140px] gap-3 border-b border-border px-3 py-3 text-xs font-semibold uppercase text-slate-500 lg:grid">
          <span>Date</span><span>Cotisation</span><span>Montant</span><span>Methode</span><span>Statut</span><span>Recu</span>
        </div>
        <div className="grid place-items-center p-10 text-center">
          <div>
            <CreditCard className="mx-auto size-8 text-blue-700" />
            <h2 className="mt-3 font-semibold">Aucun historique charge.</h2>
            <p className="mt-1 text-sm text-slate-500">Les lignes permettront de voir le paiement, le detail et le recu.</p>
            <Button type="button" className="mt-4" variant="outline"><FileText className="size-4" /> Voir les recus</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
