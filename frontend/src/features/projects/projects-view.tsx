import { BarChart3, CalendarDays, Filter, FolderKanban, Plus, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { PROJECT_STATUSES } from "./project-status";
import { ProjectForm } from "./project-form";

const kpis = [
  ["0", "Total projets"],
  ["0", "Actifs"],
  ["0", "Termines"],
  ["0", "En retard"],
  ["0 XOF", "Budget total"],
  ["0 XOF", "Depenses"],
  ["0 XOF", "Restant"],
  ["0%", "Avancement moyen"],
];

export function ProjectsView() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Projets"
        description="Planification, budget et suivi d'execution des projets de l'association."
        actions={
          <>
            <Button type="button" variant="outline"><Filter className="size-4" /> Filtres</Button>
            <Button type="button"><Plus className="size-4" /> Nouveau projet</Button>
          </>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([value, label]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="text-2xl font-bold tabular-nums text-slate-950">{value}</div>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-slate-900"><BarChart3 className="size-4" /> Portefeuille projets</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
              <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-slate-500">
                <Search className="size-4" />
                <input className="w-full bg-transparent outline-none" placeholder="Rechercher un projet..." />
              </label>
              <select className="min-h-10 rounded-md border border-border px-3 text-sm">
                <option>Tous les statuts</option>
                {PROJECT_STATUSES.map((status) => <option key={status.value}>{status.label}</option>)}
              </select>
              <Button type="button" variant="outline"><SlidersHorizontal className="size-4" /> Trier</Button>
            </div>
            <div className="hidden grid-cols-[1fr_130px_150px_130px_130px_110px] gap-3 border-b border-border px-3 py-3 text-xs font-semibold uppercase text-slate-500 lg:grid">
              <span>Projet</span><span>Statut</span><span>Responsable</span><span>Periode</span><span>Budget</span><span>Progression</span>
            </div>
            <div className="grid place-items-center rounded-md border border-dashed border-border bg-slate-50 p-10 text-center">
              <div>
                <FolderKanban className="mx-auto size-8 text-blue-700" />
                <h2 className="mt-3 font-semibold">Aucun projet pour l'instant.</h2>
                <p className="mt-1 text-sm text-slate-500">Les projets crees depuis ce workspace apparaitront ici avec leurs budgets et delais.</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Page 1 sur 1</span>
              <div className="flex gap-2">
                <Button type="button" variant="outline">Precedent</Button>
                <Button type="button" variant="outline">Suivant</Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-slate-900">Creation rapide</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectForm />
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        {["Materiel", "Main-d'oeuvre", "Transport"].map((label) => (
          <div className="rounded-card border border-border bg-white p-5 shadow-sm" key={label}>
            <div className="flex items-center justify-between">
              <strong>{label}</strong>
              <CalendarDays className="size-4 text-blue-700" />
            </div>
            <div className="mt-4 h-2 rounded-full bg-slate-100">
              <div className="h-2 w-0 rounded-full bg-blue-700" />
            </div>
            <p className="mt-2 text-sm text-slate-500">0 XOF consomme</p>
          </div>
        ))}
      </section>
    </div>
  );
}
