import { Archive, Edit, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const tabs = ["Informations", "Cotisations", "Paiements", "Activite", "Documents"];

export function MemberDetailView({ memberId }: Readonly<{ memberId: string }>) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Fiche membre"
        description={`Membre #${memberId}`}
        actions={
          <>
            <Button type="button" variant="outline"><Edit className="size-4" /> Modifier</Button>
            <Button type="button" variant="outline"><Archive className="size-4" /> Archiver</Button>
          </>
        }
      />
      <Card>
        <CardContent className="grid gap-4 p-6 md:grid-cols-4">
          <div><p className="text-sm text-slate-500">Numero</p><strong>A charger</strong></div>
          <div><p className="text-sm text-slate-500">Membre depuis</p><strong>A charger</strong></div>
          <div><p className="text-sm text-slate-500">Statut</p><strong>A charger</strong></div>
          <div><p className="text-sm text-slate-500">Cotisation</p><strong>A charger</strong></div>
        </CardContent>
      </Card>
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((tab) => <Button key={tab} type="button" variant={tab === "Informations" ? "default" : "outline"}>{tab}</Button>)}
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><FileText className="size-4" /> Historique</CardTitle></CardHeader>
        <CardContent className="text-sm text-slate-500">Aucun evenement membre charge pour l'instant. L'audit log alimentera cet historique.</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><FileText className="size-4" /> Cotisations</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div><p className="text-sm text-slate-500">Total du</p><strong>0 XOF</strong></div>
          <div><p className="text-sm text-slate-500">Total paye</p><strong>0 XOF</strong></div>
          <div><p className="text-sm text-slate-500">Reste</p><strong>0 XOF</strong></div>
          <div><p className="text-sm text-slate-500">Taux</p><strong>0%</strong></div>
          <div><p className="text-sm text-slate-500">Derniere cotisation</p><strong>A charger</strong></div>
          <div><p className="text-sm text-slate-500">Prochaine echeance</p><strong>A charger</strong></div>
          <div><p className="text-sm text-slate-500">Statut</p><strong>A jour</strong></div>
        </CardContent>
      </Card>
    </div>
  );
}
