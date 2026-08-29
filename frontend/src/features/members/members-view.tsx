import { Download, Filter, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const memberKpis = [
  ["0", "Membres"],
  ["0", "Actifs"],
  ["0", "Nouveaux ce mois"],
  ["0", "Cotisations en retard"],
];

export function MembersView() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Membres"
        description="Gerez les personnes membres de votre organisation, sans les confondre avec les utilisateurs NOVEX."
        actions={
          <>
            <Button type="button" variant="outline"><Upload className="size-4" /> Importer</Button>
            <Button type="button" variant="outline"><Download className="size-4" /> Exporter</Button>
            <Button type="button"><Plus className="size-4" /> Ajouter</Button>
          </>
        }
      />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {memberKpis.map(([value, label]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="text-3xl font-bold tabular-nums">{value}</div>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="flex flex-col gap-3 rounded-card border border-border bg-white p-4 md:flex-row md:items-center">
        <input className="min-h-10 flex-1 rounded-md border border-border px-3" placeholder="Rechercher par nom, telephone, email ou numero..." />
        <Button type="button" variant="outline"><Filter className="size-4" /> Filtres</Button>
      </section>
      <section className="overflow-hidden rounded-card border border-border bg-white">
        <div className="hidden grid-cols-[120px_1fr_160px_160px_140px_160px_100px] gap-3 border-b border-border px-4 py-3 text-xs font-semibold uppercase text-slate-500 md:grid">
          <span>N</span><span>Nom</span><span>Telephone</span><span>Categorie</span><span>Statut</span><span>Cotisation</span><span>Actions</span>
        </div>
        <div className="grid place-items-center p-10 text-center">
          <div>
            <h2 className="font-semibold">Aucun membre pour l'instant.</h2>
            <p className="mt-1 text-sm text-slate-500">Ajoutez un membre manuellement ou importez un fichier CSV/Excel apres validation.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
