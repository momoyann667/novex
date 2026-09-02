"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowLeft, Banknote, CalendarDays, CheckCircle2, CircleSlash2, FileText, FolderKanban, ListChecks, Pause, ScrollText, ShieldAlert, Users, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { workspacePath } from "@/lib/workspace/routing";
import { getProject, updateProjectStatus, type ProjectResource } from "./api";

function money(value: string | number | undefined, currency = "XOF") {
  const amount = Number(value ?? 0);
  const label = currency === "XOF" ? "FCFA" : currency;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} ${label}`;
}

function shortDate(value: string | null | undefined) {
  if (!value) return "Non definie";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function responsibleLabel(project: ProjectResource) {
  return project.responsible_member_name || project.owner_name || project.responsible_user_name || "Non defini";
}

export function ProjectDetailView({ projectId, workspaceSlug }: Readonly<{ projectId: string; workspaceSlug: string }>) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["project", workspaceSlug, projectId], queryFn: () => getProject(workspaceSlug, projectId) });
  const mutation = useMutation({
    mutationFn: (action: "activate" | "pause" | "complete" | "cancel") => updateProjectStatus(workspaceSlug, Number(projectId), action),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project", workspaceSlug, projectId] });
      await queryClient.invalidateQueries({ queryKey: ["project-board", workspaceSlug] });
    }
  });

  if (query.isLoading) {
    return <main className="grid gap-4 p-4"><div className="h-48 animate-pulse rounded-md bg-white ring-1 ring-slate-200" /><div className="h-40 animate-pulse rounded-md bg-white ring-1 ring-slate-200" /></main>;
  }

  if (query.isError || !query.data) {
    return (
      <main className="grid gap-4 p-4">
        <Button asChild variant="outline"><Link href={workspacePath(workspaceSlug, "projects")}><ArrowLeft className="size-4" /> Retour</Link></Button>
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">Impossible de charger ce projet.</div>
      </main>
    );
  }

  const project = query.data;
  const budget = Number(project.budget_summary.budget || 0);
  const spent = Number(project.budget_summary.actual_expense || 0);
  const remaining = Number(project.budget_summary.remaining || 0);
  const rate = Number(project.budget_summary.consumed_rate || 0);
  const visibleRate = Math.min(Math.max(rate, 0), 100);
  const kpis = [
    [budget > 0 ? money(budget, project.currency) : "Sans budget", "Budget"],
    [money(spent, project.currency), "Consomme"],
    [budget > 0 ? money(remaining, project.currency) : "Non defini", "Restant"],
    [`${Math.round(rate)}%`, "Consommation"],
    [`${project.analytics.completed_tasks} / ${project.analytics.task_count}`, "Taches"],
    [`${project.analytics.completed_milestones} / ${project.analytics.milestone_count}`, "Jalons"]
  ] as const;

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-5 overflow-x-hidden p-4 pb-24 md:p-0">
      <PageHeader
        title={project.name}
        description={`${project.status_label} - ${project.code}`}
        actions={
          <>
            <Button asChild variant="outline"><Link href={workspacePath(workspaceSlug, "projects")}><ArrowLeft className="size-4" /> Retour</Link></Button>
            <Button disabled={mutation.isPending} type="button" variant="outline" onClick={() => mutation.mutate(project.status === "ON_HOLD" ? "activate" : "pause")}><Pause className="size-4" /> Pause</Button>
            <Button disabled={mutation.isPending} type="button" onClick={() => mutation.mutate("complete")}><CheckCircle2 className="size-4" /> Terminer</Button>
          </>
        }
      />

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-5 md:grid-cols-[1fr_260px] md:items-center">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-100">{project.priority_label}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{project.category || "Sans categorie"}</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{project.description || "Aucune description renseignee."}</p>
            <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-600 sm:grid-cols-2">
              <span className="inline-flex items-center gap-2"><Users className="size-4 text-blue-700" /> Responsable: {responsibleLabel(project)}</span>
              <span className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-blue-700" /> {shortDate(project.start_date)} - {shortDate(project.end_date)}</span>
            </div>
          </div>
          <div>
            <div className="mb-2 flex justify-between text-sm"><span>Budget consomme</span><strong className={cn(rate > 100 && "text-red-700")}>{Math.round(rate)}%</strong></div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-3 rounded-full", rate > 100 ? "bg-red-600" : "bg-blue-700")} style={{ width: `${visibleRate}%` }} /></div>
            {budget <= 0 ? <p className="mt-2 text-sm font-bold text-slate-500">Sans budget</p> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {kpis.map(([value, label]) => (
          <Card className="rounded-md" key={label}><CardContent className="p-4"><div className="text-xl font-black tabular-nums text-slate-950">{value}</div><p className="mt-1 text-sm font-semibold text-slate-500">{label}</p></CardContent></Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="rounded-md">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FolderKanban className="size-4" /> Vue d'ensemble</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md bg-slate-50 p-3"><WalletCards className="mb-2 size-4 text-blue-700" /> Budget alloue<br /><strong>{budget > 0 ? money(budget, project.currency) : "Sans budget"}</strong></div>
              <div className="rounded-md bg-slate-50 p-3"><Banknote className="mb-2 size-4 text-blue-700" /> Depenses validees<br /><strong>{money(spent, project.currency)}</strong></div>
              <div className="rounded-md bg-slate-50 p-3"><ShieldAlert className="mb-2 size-4 text-blue-700" /> Risque<br /><strong>{project.risk.level}</strong></div>
              <div className="rounded-md bg-slate-50 p-3"><ListChecks className="mb-2 size-4 text-blue-700" /> Progression<br /><strong>{project.progress}%</strong></div>
            </div>
            {project.risk.causes.length ? <p className="rounded-md border border-amber-200 bg-amber-50 p-3 font-bold text-amber-800">{project.risk.causes.join(", ")}</p> : null}
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="size-4" /> Equipe</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="rounded-md border border-slate-200 p-3"><strong>Responsable</strong><p className="text-slate-500">{responsibleLabel(project)}</p></div>
            {project.team_preview.map((item) => <div className="rounded-md border border-slate-200 p-3" key={item.id}><strong>{item.name}</strong><p className="text-slate-500">{item.role}</p></div>)}
            {!project.team_preview.length ? <p className="text-sm text-slate-500">Aucun collaborateur ajoute.</p> : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Button asChild variant="outline"><Link href={workspacePath(workspaceSlug, `projects/${projectId}/tasks`)}><ListChecks className="size-4" /> Taches</Link></Button>
        <Button asChild variant="outline"><Link href={workspacePath(workspaceSlug, "documents")}><FileText className="size-4" /> Documents</Link></Button>
        <Button asChild variant="outline"><Link href={workspacePath(workspaceSlug, `projects/${projectId}/report`)}><ScrollText className="size-4" /> Rapport</Link></Button>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-black text-slate-950">Actions statut</h2>
          <Activity className="size-4 text-slate-500" />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button disabled={mutation.isPending} type="button" variant="outline" onClick={() => mutation.mutate("activate")}><CheckCircle2 className="size-4" /> Mettre en cours</Button>
          <Button disabled={mutation.isPending} type="button" variant="outline" onClick={() => mutation.mutate("complete")}><CheckCircle2 className="size-4" /> Terminer</Button>
          <Button disabled={mutation.isPending} type="button" variant="outline" onClick={() => mutation.mutate("cancel")}><CircleSlash2 className="size-4" /> Annuler</Button>
        </div>
      </section>
    </main>
  );
}
