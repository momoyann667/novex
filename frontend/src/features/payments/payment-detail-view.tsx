import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export function PaymentDetailView({ paymentId }: Readonly<{ paymentId: string }>) {
  return (
    <div className="grid gap-6">
      <PageHeader title={`Paiement #${paymentId}`} description="Detail de transaction, limite aux roles autorises." />
      <Card>
        <CardContent className="grid gap-4 p-6 md:grid-cols-2">
          <div><p className="text-sm text-slate-500">Montant</p><strong>A charger</strong></div>
          <div><p className="text-sm text-slate-500">Statut</p><strong>A charger</strong></div>
          <div><p className="text-sm text-slate-500">Membre</p><strong>A charger</strong></div>
          <div><p className="text-sm text-slate-500">Methode</p><strong>A charger</strong></div>
          <div><p className="text-sm text-slate-500">Provider</p><strong>A charger</strong></div>
          <div><p className="text-sm text-slate-500">Date</p><strong>A charger</strong></div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex gap-3 p-6 text-sm text-slate-600">
          <ShieldCheck className="size-5 text-blue-700" />
          Les informations techniques du fournisseur devront etre visibles uniquement aux roles autorises.
        </CardContent>
      </Card>
    </div>
  );
}
