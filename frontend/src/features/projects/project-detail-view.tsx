import Link from "next/link";
import { Activity, AlertTriangle, Banknote, CalendarDays, CheckCircle2, FileText, FolderKanban, ListChecks, Pause, PieChart, ScrollText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const tabs = [
  ["Vue d'ensemble", FolderKanban],
  ["Budget", PieChart],
  ["Depenses", Banknote],
  ["Taches", ListChecks],
  ["Documents", FileText],
  ["Activite", Activity],
  ["Rapports", ScrollText],
] as const;

const projectKpis = [["10 000 000 XOF", "Budget"], ["4 000 000 XOF", "Consomme"], ["6 000 000 XOF", "Restant"], ["62%", "Progression"], ["18 / 29", "Taches"], ["5 / 8", "Objectifs"]] as const;

const quickCards = [["Planning", "Debut, jalons, fin", CalendarDays], ["Equipe", "6 membres actifs", Users], ["Risque", "HIGH - budget proche limite", AlertTriangle], ["Rapport", "Pret pour export", ScrollText]] as const;

export function ProjectDetailView({ projectId, workspaceSlug }: Readonly<{ projectId: string; workspaceSlug: string }>) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Projet ${projectId}`}
        description="Statut, responsable, progression, budget, equipe, objectifs et risques."
        actions={
          <>
            <Button type="button" variant="outline"><Pause className="size-4" /> Pause</Button>
            <Button type="button"><CheckCircle2 className="size-4" /> Terminer</Button>
          </>
        }
      />
      <section className="rounded-card border border-border bg-white p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_240px] md:items-center">
          <div>
            <div className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">DRAFT</div>
            <h1 className="mt-3 text-2xl font-bold tracking-normal">Nom du projet</h1>
            <p className="mt-1 text-sm text-slate-500">Code {projectId} - Responsable Awa Kone - J-45</p>
          </div>
          <div>
            <div className="mb-2 flex justify-between text-sm"><span>Progression</span><strong>0%</strong></div>
            <div className="h-3 rounded-full bg-slate-100"><div className="h-3 w-0 rounded-full bg-blue-700" /></div>
          </div>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {projectKpis.map(([value, label]) => (
          <Card key={label}><CardContent className="p-5"><div className="text-2xl font-bold tabular-nums">{value}</div><p className="mt-1 text-sm text-slate-500">{label}</p></CardContent></Card>
        ))}
      </section>
      <section className="flex gap-2 overflow-x-auto border-b border-border pb-2">
        {tabs.map(([label, Icon]) => (
          <button className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100" key={label} type="button">
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-4">
        {quickCards.map(([title, body, Icon]) => (
          <Card key={String(title)}><CardContent className="p-4"><Icon className="size-5 text-blue-700" /><strong className="mt-3 block">{title}</strong><p className="text-sm text-slate-500">{body}</p></CardContent></Card>
        ))}
      </section>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link href={`/app/${workspaceSlug}/projects/${projectId}/tasks`}><ListChecks className="size-4" /> Taches</Link></Button>
        <Button asChild variant="outline"><Link href={`/app/${workspaceSlug}/projects/${projectId}/report`}><ScrollText className="size-4" /> Rapport</Link></Button>
      </div>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-900">Budget par categorie</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {["Materiel", "Main-d'oeuvre", "Transport", "Communication", "Logistique", "Prestataires", "Administration", "Autres"].map((label) => (
              <div className="rounded-md border border-border p-3" key={label}>
                <div className="flex justify-between text-sm"><strong>{label}</strong><span>0%</span></div>
                <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 w-0 rounded-full bg-blue-700" /></div>
                <p className="mt-2 text-xs text-slate-500">0 XOF depense - 0 XOF restant</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-900">Activite recente</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {["Projet cree", "Membre ajoute", "Tache creee", "Depense ajoutee", "Jalon termine"].map((item) => <div className="rounded-md border border-border p-3" key={item}>{item}</div>)}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
