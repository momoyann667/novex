import { Download, Eye, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";

export function FinanceLedgerView() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Transactions" description="Grand livre financier de l'association." actions={<Button type="button" variant="outline"><Download className="size-4" /> Export</Button>} />
      <section className="rounded-card border border-border bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px_160px_140px_140px]">
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-slate-500"><Search className="size-4" /><input className="w-full bg-transparent outline-none" placeholder="Description, reference, categorie, fournisseur..." /></label>
          <select className="min-h-10 rounded-md border border-border px-3 text-sm"><option>Type</option><option>INCOME</option><option>EXPENSE</option></select>
          <select className="min-h-10 rounded-md border border-border px-3 text-sm"><option>Source</option><option>MANUAL</option><option>PAYMENT</option><option>PROJECT</option><option>EVENT</option></select>
          <select className="min-h-10 rounded-md border border-border px-3 text-sm"><option>Statut</option><option>VALIDATED</option><option>PENDING</option><option>CANCELLED</option></select>
          <Button type="button" variant="outline"><Filter className="size-4" /> Filtres</Button>
        </div>
        <div className="mt-4 hidden grid-cols-[120px_100px_1fr_150px_120px_120px_150px_80px] gap-3 border-b border-border px-3 py-3 text-xs font-semibold uppercase text-slate-500 lg:grid">
          <span>Date</span><span>Type</span><span>Description</span><span>Categorie</span><span>Entree</span><span>Sortie</span><span>Reference</span><span></span>
        </div>
        <div className="grid gap-2 px-3 py-8 text-center text-sm text-slate-500">
          Aucune transaction chargee. Les recettes, depenses et cotisations synchronisees apparaitront ici.
          <Button type="button" variant="outline" className="mx-auto"><Eye className="size-4" /> Voir un detail</Button>
        </div>
      </section>
    </div>
  );
}
