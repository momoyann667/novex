import Link from "next/link";
import { ArrowLeft, CalendarDays, KanbanSquare, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const columns = [
  ["A faire", ["Valider budget", "Identifier fournisseurs"]],
  ["En cours", ["Achat materiel", "Planifier terrain"]],
  ["Bloque", ["Signature convention"]],
  ["Termine", ["Cadrage projet", "Equipe noyau"]],
];

export function ProjectTasksView({ workspaceSlug, projectId }: Readonly<{ workspaceSlug: string; projectId: string }>) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Taches projet"
        description="Kanban, liste et calendrier avec validation backend des transitions."
        actions={
          <>
            <Button asChild variant="outline"><Link href={`/app/${workspaceSlug}/projects/${projectId}`}><ArrowLeft className="size-4" /> Projet</Link></Button>
            <Button type="button"><Plus className="size-4" /> Tache</Button>
          </>
        }
      />
      <div className="flex gap-2 overflow-x-auto">
        {["Kanban", "Liste", "Calendrier"].map((mode, index) => <Button type="button" variant={index === 0 ? "default" : "outline"} key={mode}>{index === 0 ? <KanbanSquare className="size-4" /> : index === 1 ? <List className="size-4" /> : <CalendarDays className="size-4" />} {mode}</Button>)}
      </div>
      <section className="grid gap-4 xl:grid-cols-4">
        {columns.map(([title, tasks]) => (
          <Card key={String(title)}>
            <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {(tasks as string[]).map((task) => <div className="rounded-md border border-border bg-slate-50 p-3 text-sm" key={task}><strong>{task}</strong><p className="mt-1 text-xs text-slate-500">Priorite moyenne - echeance proche</p></div>)}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

