import { Ban, CheckCircle2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export function FinanceTransactionDetailView({ transactionId }: Readonly<{ transactionId: string }>) {
  return (
    <div className="grid gap-6">
      <PageHeader title={`Transaction #${transactionId}`} description="Montant, categorie, source, createur et justificatifs." actions={<><Button type="button" variant="outline"><CheckCircle2 className="size-4" /> Valider</Button><Button type="button" variant="outline"><Ban className="size-4" /> Annuler</Button></>} />
      <Card><CardContent className="grid gap-4 p-6 md:grid-cols-3">
        {["Montant", "Type", "Description", "Categorie", "Date", "Source", "Reference", "Createur", "Justificatif"].map((label) => <div key={label}><p className="text-sm text-slate-500">{label}</p><strong>A charger</strong></div>)}
      </CardContent></Card>
      <Card><CardContent className="flex items-center gap-3 p-6 text-sm text-slate-600"><FileText className="size-5 text-blue-700" /> Les modifications d'une transaction validee passeront par ajustement auditable.</CardContent></Card>
    </div>
  );
}
