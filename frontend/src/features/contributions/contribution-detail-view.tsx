import { Banknote, CheckCircle2, Clock, CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export function ContributionDetailView({ contributionId }: Readonly<{ contributionId: string }>) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Fiche cotisation"
        description={`Cotisation #${contributionId}`}
        actions={
          <>
            <Button type="button" variant="outline"><Banknote className="size-4" /> Paiement manuel</Button>
            <Button type="button" variant="outline"><ShieldCheck className="size-4" /> Exonerer</Button>
          </>
        }
      />
      <section className="rounded-card border border-border bg-white p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_260px] md:items-center">
          <div>
            <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">PENDING</span>
            <h1 className="mt-3 text-2xl font-bold tracking-normal">Nom de la cotisation</h1>
            <p className="mt-1 text-sm text-slate-500">Montant, echeance et historique seront charges depuis l'API.</p>
          </div>
          <div>
            <div className="mb-2 flex justify-between text-sm"><span>Recouvrement</span><strong>0%</strong></div>
            <div className="h-3 rounded-full bg-slate-100"><div className="h-3 w-0 rounded-full bg-blue-700" /></div>
          </div>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[["0 XOF", "Montant attendu"], ["0 XOF", "Montant collecte"], ["0 XOF", "Reste"], ["0%", "Taux de recouvrement"]].map(([value, label]) => (
          <Card key={label}><CardContent className="p-5"><div className="text-2xl font-bold tabular-nums">{value}</div><p className="mt-1 text-sm text-slate-500">{label}</p></CardContent></Card>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><CreditCard className="size-4" /> Membres</CardTitle></CardHeader>
          <CardContent>
            <div className="hidden grid-cols-[1fr_120px_120px_120px_120px_130px_120px] gap-3 border-b border-border px-3 py-3 text-xs font-semibold uppercase text-slate-500 lg:grid">
              <span>Membre</span><span>Du</span><span>Paye</span><span>Reste</span><span>Statut</span><span>Echeance</span><span>Actions</span>
            </div>
            <div className="grid place-items-center p-10 text-center text-sm text-slate-500">Aucun membre charge.</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-900">Historique</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm text-slate-600">
            <div className="flex items-center gap-2"><Clock className="size-4 text-blue-700" /> Echeances et statuts</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-700" /> Paiements partiels</div>
            <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-slate-700" /> Exonerations auditees</div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
