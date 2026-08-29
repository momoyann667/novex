import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export function PaymentsView() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Paiements"
        description="Suivi des paiements manuels et architecture prete pour les fournisseurs en ligne."
        actions={<Button type="button">+ Enregistrer un paiement</Button>}
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["0 XOF", "Total"],
          ["0 XOF", "Aujourd'hui"],
          ["0", "Reussis"],
          ["0", "En attente"],
        ].map(([value, label]) => (
          <Card key={label}><CardContent className="p-5"><div className="text-3xl font-bold tabular-nums">{value}</div><p className="mt-1 text-sm text-slate-500">{label}</p></CardContent></Card>
        ))}
      </section>
      <Card>
        <CardContent className="grid gap-4 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-blue-50 p-2 text-blue-700"><ShieldCheck className="size-5" /></div>
            <div>
              <h2 className="font-semibold">Paiements en ligne verrouilles jusqu'a activation PRO.</h2>
              <p className="mt-1 text-sm text-slate-500">
                Le frontend ne declare jamais un paiement reussi. Les confirmations devront passer par webhook signe et idempotent.
              </p>
            </div>
          </div>
          <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-slate-500">
            Aucun paiement enregistre dans ce workspace.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
