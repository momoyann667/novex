import { FileWarning, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export function FinanceExpensesView() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Depenses" description="Suivi des sorties, fournisseurs, projets, evenements et justificatifs." actions={<Button type="button"><Plus className="size-4" /> Creer une depense</Button>} />
      <section className="grid gap-4 md:grid-cols-4">
        {["Total depenses", "Depenses du mois", "Nombre de depenses", "Depense moyenne"].map((label) => <Card key={label}><CardContent className="p-5"><div className="text-2xl font-bold">0 XOF</div><p className="text-sm text-slate-500">{label}</p></CardContent></Card>)}
      </section>
      <section className="rounded-card border border-border bg-white p-6">
        <div className="grid place-items-center p-10 text-center">
          <div><FileWarning className="mx-auto size-8 text-blue-700" /><h2 className="mt-3 font-semibold">Aucune depense chargee.</h2><p className="text-sm text-slate-500">Les depenses sensibles passeront en validation selon le seuil configure.</p></div>
        </div>
      </section>
    </div>
  );
}
