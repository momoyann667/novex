import { Clock, CreditCard, FileText, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const details = [
  ["Montant brut", "A charger"],
  ["Frais provider", "A charger"],
  ["Frais NOVEX", "A charger"],
  ["Montant net", "A charger"],
  ["Membre", "A charger"],
  ["Cotisation", "A charger"],
  ["Provider", "A charger"],
  ["Transaction", "A charger"],
];

export function PaymentDetailView({ paymentId }: Readonly<{ paymentId: string }>) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Paiement #${paymentId}`}
        description="Reference, frais, recu et journal de confirmation."
        actions={<Button type="button" variant="outline"><RotateCcw className="size-4" /> Rembourser</Button>}
      />
      <Card>
        <CardContent className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
          {details.map(([label, value]) => <div key={label}><p className="text-sm text-slate-500">{label}</p><strong>{value}</strong></div>)}
        </CardContent>
      </Card>
      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="grid gap-4 p-6">
            <div className="flex items-center gap-2 font-semibold"><Clock className="size-5 text-blue-700" /> Timeline</div>
            {["payment.initialized", "payment.processing", "payment.succeeded"].map((event) => (
              <div key={event} className="rounded-md border border-border p-3 text-sm">
                <strong>{event}</strong>
                <p className="text-slate-500">Charge depuis PaymentEvent avec metadata expurgee des secrets.</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-4 p-6 text-sm text-slate-600">
            <div className="flex items-center gap-2 font-semibold text-slate-900"><ShieldCheck className="size-5 text-blue-700" /> Controle backend</div>
            <p>Le detail affiche le statut persiste par l'API. Aucun parametre retour provider ne suffit a confirmer le paiement.</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline"><FileText className="size-4" /> Recu</Button>
              <Button type="button" variant="outline"><CreditCard className="size-4" /> Cotisation</Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
