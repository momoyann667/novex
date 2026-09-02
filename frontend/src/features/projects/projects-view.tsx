"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, CircleSlash2, Clock3, FolderKanban, Pause, Plus, Search, UserRound, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { workspacePath } from "@/lib/workspace/routing";
import { getProjectBoard, updateProjectStatus, type ProjectResource, type ProjectStatus } from "./api";

type FilterKey = "all" | "in_progress" | "completed" | "cancelled";

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "Tout" },
  { key: "completed", label: "Termines" },
  { key: "in_progress", label: "En cours" },
  { key: "cancelled", label: "Annules" }
];

const columns: Array<{ key: FilterKey; label: string; statuses: ProjectStatus[] }> = [
  { key: "in_progress", label: "En cours", statuses: ["DRAFT", "PLANNED", "ACTIVE", "ON_HOLD"] },
  { key: "completed", label: "Termines", statuses: ["COMPLETED"] },
  { key: "cancelled", label: "Annules", statuses: ["CANCELLED"] }
];

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
  return project.responsible_member_name || project.owner_name || project.responsible_user_name || "Responsable non defini";
}

function priorityTone(priority: string) {
  if (priority === "CRITICAL") return "bg-red-50 text-red-700 ring-red-100";
  if (priority === "HIGH") return "bg-orange-50 text-orange-700 ring-orange-100";
  if (priority === "LOW") return "bg-slate-100 text-slate-600 ring-slate-200";
  return "bg-blue-50 text-blue-700 ring-blue-100";
}

function statusAction(status: ProjectStatus): "activate" | "pause" | "complete" | "cancel" {
  if (status === "COMPLETED" || status === "CANCELLED") return "activate";
  if (status === "ON_HOLD") return "activate";
  return "pause";
}

function ProjectCard({ project, workspaceSlug }: Readonly<{ project: ProjectResource; workspaceSlug: string }>) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (action: "activate" | "pause" | "complete" | "cancel") => updateProjectStatus(workspaceSlug, project.id, action),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project-board", workspaceSlug] });
    }
  });
  const budget = Number(project.budget_summary?.budget ?? project.budget ?? 0);
  const spent = Number(project.budget_summary?.actual_expense ?? 0);
  const rate = Number(project.budget_summary?.consumed_rate ?? 0);
  const visibleRate = Math.min(Math.max(rate, 0), 100);
  const team = project.team_preview.length ? project.team_preview : responsibleLabel(project) !== "Responsable non defini" ? [{ id: project.id, name: responsibleLabel(project), role: "PROJECT_MANAGER" }] : [];

  return (
    <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <Link className="block" href={workspacePath(workspaceSlug, `projects/${project.id}`)}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-black uppercase ring-1", priorityTone(project.priority))}>{project.priority_label}</span>
          <span className="text-xs font-bold text-slate-500">{project.status_label}</span>
        </div>
        <h3 className="text-lg font-black leading-tight text-slate-950">{project.name}</h3>
        <p className="mt-2 line-clamp-2 min-h-10 text-sm text-slate-500">{project.description || "Aucune description renseignee."}</p>
        <div className="mt-4 rounded-md bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-bold text-slate-600">Budget</span>
            {budget > 0 ? <strong className={cn("tabular-nums", rate > 100 && "text-red-700")}>{Math.round(rate)}%</strong> : <strong>Sans budget</strong>}
          </div>
          {budget > 0 ? (
            <>
              <p className="mt-1 text-sm font-black text-slate-950">{money(spent, project.currency)} / {money(budget, project.currency)}</p>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div className={cn("h-full rounded-full", rate > 100 ? "bg-red-600" : "bg-blue-700")} style={{ width: `${visibleRate}%` }} />
              </div>
              {rate > 100 ? <p className="mt-2 text-xs font-bold text-red-700">Budget depasse</p> : null}
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Aucun budget alloue a ce projet.</p>
          )}
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-600">
          <CalendarDays className="size-4 text-blue-700" />
          <span>{shortDate(project.start_date)} - {shortDate(project.end_date)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex -space-x-2">
            {team.slice(0, 3).map((item) => (
              <span className="grid size-8 place-items-center rounded-full border-2 border-white bg-slate-900 text-xs font-black text-white" key={`${project.id}-${item.id}`} title={item.name}>
                {item.name.slice(0, 1).toUpperCase()}
              </span>
            ))}
            {team.length > 3 ? <span className="grid size-8 place-items-center rounded-full border-2 border-white bg-blue-700 text-xs font-black text-white">+{team.length - 3}</span> : null}
          </div>
          <span className="inline-flex min-w-0 items-center gap-1 text-xs font-bold text-slate-500">
            <UserRound className="size-4" />
            <span className="truncate">{responsibleLabel(project)}</span>
          </span>
        </div>
      </Link>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button className="min-h-9" disabled={mutation.isPending} type="button" variant="outline" onClick={() => mutation.mutate(statusAction(project.status))}>
          {project.status === "ON_HOLD" || project.status === "COMPLETED" || project.status === "CANCELLED" ? <CheckCircle2 className="size-4" /> : <Pause className="size-4" />}
          {project.status === "ON_HOLD" || project.status === "COMPLETED" || project.status === "CANCELLED" ? "Activer" : "Pause"}
        </Button>
        <Button className="min-h-9" disabled={mutation.isPending} type="button" variant="outline" onClick={() => mutation.mutate(project.status === "COMPLETED" ? "cancel" : "complete")}>
          {project.status === "COMPLETED" ? <CircleSlash2 className="size-4" /> : <CheckCircle2 className="size-4" />}
          {project.status === "COMPLETED" ? "Annuler" : "Terminer"}
        </Button>
      </div>
    </article>
  );
}

function SkeletonBoard() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {[1, 2, 3].map((item) => <div className="h-72 animate-pulse rounded-md bg-white ring-1 ring-slate-200" key={item} />)}
    </div>
  );
}

export function ProjectsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["project-board", workspaceSlug, search],
    queryFn: () => getProjectBoard(workspaceSlug, search)
  });
  const projects = query.data?.projects || [];
  const visibleColumns = useMemo(() => columns.filter((column) => activeFilter === "all" || column.key === activeFilter), [activeFilter]);

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-5 overflow-x-hidden p-4 pb-24 md:p-0">
      <PageHeader
        title="Projets"
        description="Planifiez, suivez et pilotez les projets de votre association."
        actions={<Button asChild><Link href={workspacePath(workspaceSlug, "projects/new")}><Plus className="size-4" /> Nouveau</Link></Button>}
      />

      <section className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="px-2 pb-2 text-xs font-black uppercase text-slate-500">Etats</h2>
          <div className="flex gap-2 overflow-x-auto lg:grid lg:overflow-visible">
            {filters.map((filter) => (
              <button
                className={cn("flex min-h-11 shrink-0 items-center justify-between gap-4 rounded-md px-3 text-sm font-black", activeFilter === filter.key ? "bg-black text-white" : "text-slate-600 hover:bg-slate-50")}
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
              >
                <span>{filter.label}</span>
                <span>{query.data?.counts[filter.key] ?? 0}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0">
          <label className="mb-4 flex min-h-12 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-500 shadow-sm">
            <Search className="size-5 shrink-0" />
            <input className="min-w-0 flex-1 bg-transparent font-semibold outline-none" placeholder="Rechercher un projet..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>

          {query.isLoading ? <SkeletonBoard /> : null}
          {query.isError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              Impossible de charger les projets.
              <button className="ml-2 underline" type="button" onClick={() => query.refetch()}>Reessayer</button>
            </div>
          ) : null}
          {!query.isLoading && !query.isError && !projects.length ? (
            <div className="grid min-h-72 place-items-center rounded-md border border-slate-200 bg-white p-8 text-center shadow-sm">
              <div>
                <FolderKanban className="mx-auto size-10 text-blue-700" />
                <h2 className="mt-3 text-xl font-black text-slate-950">Aucun projet</h2>
                <p className="mt-1 text-sm text-slate-500">Commencez par creer votre premier projet.</p>
                <Button asChild className="mt-5"><Link href={workspacePath(workspaceSlug, "projects/new")}><Plus className="size-4" /> Nouveau projet</Link></Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            {visibleColumns.map((column) => {
              const items = projects.filter((project) => column.statuses.includes(project.status));
              return (
                <div className="min-w-0 rounded-md bg-slate-100 p-3" key={column.key}>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-black uppercase text-slate-700">{column.label}</h2>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-slate-600">{items.length}</span>
                  </div>
                  <div className="grid gap-3">
                    {items.map((project) => <ProjectCard project={project} workspaceSlug={workspaceSlug} key={project.id} />)}
                    {!items.length ? <div className="rounded-md border border-dashed border-slate-300 bg-white/70 p-4 text-sm font-semibold text-slate-500">Aucun projet {column.label.toLowerCase()}.</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </section>

      <Link className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-5 z-30 grid size-14 place-items-center rounded-full bg-blue-700 text-white shadow-2xl md:bottom-7" href={workspacePath(workspaceSlug, "projects/new")} aria-label="Creer un projet">
        <Plus className="size-7" />
      </Link>
    </main>
  );
}
