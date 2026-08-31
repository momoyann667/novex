import Link from "next/link";
import { AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Clock3, FileDown, Filter, FolderKanban, ListChecks, Plus, Search, SlidersHorizontal, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { PROJECT_STATUSES } from "./project-status";

const kpis = [
  ["12", "Total projets", FolderKanban],
  ["7", "Actifs", BarChart3],
  ["3", "Termines", CheckCircle2],
  ["2", "En retard", Clock3],
  ["24 500 000 XOF", "Budget total", WalletCards],
  ["9 800 000 XOF", "Consomme", WalletCards],
  ["14 700 000 XOF", "Restant", WalletCards],
  ["58%", "Avancement moyen", ListChecks],
] as const;

const projects = [
  { id: "PRJ-2026-001", name: "Centre communautaire", status: "ACTIVE", owner: "Awa Kone", period: "Jan - Dec", budget: "10 000 000", progress: 62, risk: "HIGH" },
  { id: "PRJ-2026-002", name: "Campagne environnement", status: "PLANNED", owner: "Yao Kouame", period: "Mar - Jun", budget: "3 500 000", progress: 18, risk: "LOW" },
  { id: "PRJ-2026-003", name: "Programme formation", status: "ON_HOLD", owner: "Mariam Traore", period: "Fev - Aou", budget: "5 000 000", progress: 44, risk: "MEDIUM" },
] as const;

const riskRows = [
  ["Centre communautaire", "Eleve", "Budget > 90%, deux taches bloquees", "Reviser achat materiel"],
  ["Programme formation", "Moyen", "Planning suspendu", "Valider nouvelle echeance"],
  ["Gala solidaire", "Critique", "Deadline depassee", "Cloturer ou replanifier"],
] as const;

export function ProjectsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Projets"
        description="Planification, budget et suivi d'execution des projets de l'association."
        actions={
          <>
            <Button type="button" variant="outline"><Filter className="size-4" /> Filtres</Button>
            <Button asChild><Link href={`/app/${workspaceSlug}/projects/new`}><Plus className="size-4" /> Nouveau projet</Link></Button>
          </>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([value, label, Icon]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <Icon className="size-5 text-blue-700" />
              <div className="text-2xl font-bold tabular-nums text-slate-950">{value}</div>
              <p className="mt-1 text-sm text-slate-500">{label}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
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
            <div className="grid gap-2">
              {projects.map((project) => (
                <Link className="grid gap-3 rounded-md border border-border p-3 text-sm transition hover:border-blue-200 hover:bg-slate-50 lg:grid-cols-[1fr_130px_150px_130px_130px_110px]" href={`/app/${workspaceSlug}/projects/${project.id}`} key={project.id}>
                  <span><strong>{project.name}</strong><span className="block text-xs text-slate-500">{project.id}</span></span>
                  <span>{project.status}</span>
                  <span>{project.owner}</span>
                  <span>{project.period}</span>
                  <span className="tabular-nums">{project.budget}</span>
                  <span>{project.progress}%</span>
                </Link>
              ))}
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
            <CardTitle className="flex items-center gap-2 text-base text-slate-900"><AlertTriangle className="size-4" /> Risques portfolio</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {riskRows.map(([project, risk, cause, action]) => (
              <div className="rounded-md border border-border p-3 text-sm" key={project}>
                <div className="flex justify-between gap-3"><strong>{project}</strong><span className="text-amber-700">{risk}</span></div>
                <p className="mt-1 text-slate-600">{cause}</p>
                <p className="mt-2 text-xs font-semibold text-blue-700">{action}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        {(["Par statut", "Par responsable", "Par categorie"] as const).map((label, index) => (
          <Card key={label}>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="size-4" /> {label}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex h-36 items-end gap-2">
                {[40, 72, 55, 88, 62].map((height) => <div className="flex-1 rounded-t bg-blue-700" key={`${label}-${height}`} style={{ height: `${Math.max(12, height - index * 10)}%` }} />)}
              </div>
              <Button type="button" variant="outline" className="mt-4 w-full"><FileDown className="size-4" /> Exporter</Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
