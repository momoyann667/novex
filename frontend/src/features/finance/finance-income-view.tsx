import { Plus, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export function FinanceIncomeView() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Recettes" description="Dons, subventions, ventes, sponsors et cotisations synchronisees." actions={<Button type="button"><Plus className="size-4" /> Creer une recette</Button>} />
      <section className="grid gap-4 md:grid-cols-4">
        {["Total recettes", "Recettes du mois", "Nombre de recettes", "Moyenne"].map((label) => <Card key={label}><CardContent className="p-5"><div className="text-2xl font-bold">0 XOF</div><p className="text-sm text-slate-500">{label}</p></CardContent></Card>)}
      </section>
      <section className="rounded-card border border-border bg-white p-6">
        <div className="grid place-items-center p-10 text-center">
          <div><ReceiptText className="mx-auto size-8 text-blue-700" /><h2 className="mt-3 font-semibold">Aucune recette chargee.</h2><p className="text-sm text-slate-500">Le formulaire utilisera React Hook Form et Zod lors du raccord interactif.</p></div>
        </div>
      </section>
    </div>
  );
}
