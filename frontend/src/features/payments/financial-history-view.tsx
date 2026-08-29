import { ArrowDown, ArrowUp, Download, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const rows = [
  ["Cotisation", "Cotisation annuelle - membre", "+0 XOF", "NOVEX-2026-...", "SUCCESS"],
  ["Remboursement", "Remboursement partiel prepare", "-0 XOF", "RF-NOVEX-...", "REFUNDED"],
  ["Ajustement", "Correction financiere auditable", "0 XOF", "ADJ-...", "POSTED"],
];

export function FinancialHistoryView() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Historique financier"
        description="Journal association des paiements, remboursements et ajustements auditables."
        actions={<Button type="button" variant="outline"><Download className="size-4" /> Exporter</Button>}
      />
      <section className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5"><ArrowUp className="size-5 text-emerald-700" /><div className="mt-3 text-3xl font-bold">0 XOF</div><p className="text-sm text-slate-500">Entrees</p></CardContent></Card>
        <Card><CardContent className="p-5"><ArrowDown className="size-5 text-red-700" /><div className="mt-3 text-3xl font-bold">0 XOF</div><p className="text-sm text-slate-500">Sorties</p></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-3xl font-bold">0</div><p className="text-sm text-slate-500">Operations tracees</p></CardContent></Card>
      </section>
      <section className="rounded-card border border-border bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_150px_150px]">
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-slate-500">
            <Search className="size-4" />
            <input className="w-full bg-transparent outline-none" placeholder="Reference, membre, libelle..." />
          </label>
          <select className="min-h-10 rounded-md border border-border px-3 text-sm"><option>Type</option><option>Cotisation</option><option>Remboursement</option><option>Ajustement</option></select>
          <select className="min-h-10 rounded-md border border-border px-3 text-sm"><option>Statut</option><option>SUCCESS</option><option>REFUNDED</option><option>POSTED</option></select>
          <Button type="button" variant="outline"><Filter className="size-4" /> Periode</Button>
        </div>
        <div className="mt-4 hidden grid-cols-[120px_140px_1fr_130px_150px_120px] gap-3 border-b border-border px-3 py-3 text-xs font-semibold uppercase text-slate-500 lg:grid">
          <span>Date</span><span>Type</span><span>Description</span><span>Montant</span><span>Reference</span><span>Statut</span>
        </div>
        {rows.map(([type, description, amount, reference, status]) => (
          <div key={`${type}-${reference}`} className="grid gap-2 border-b border-border px-3 py-4 text-sm last:border-b-0 lg:grid-cols-[120px_140px_1fr_130px_150px_120px]">
            <span>A charger</span><strong>{type}</strong><span>{description}</span><span>{amount}</span><span className="font-mono text-xs">{reference}</span><span>{status}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
