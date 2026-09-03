"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, CheckCircle2, CircleSlash2, Clock3, FolderKanban, MoreVertical, Plus, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { workspacePath } from "@/lib/workspace/routing";
import { getProjectBoard, type ProjectResource, type ProjectStatus } from "./api";

type FilterKey = "all" | "in_progress" | "completed" | "planned" | "cancelled";

const filters: Array<{ key: FilterKey; label: string; statuses?: ProjectStatus[] }> = [
  { key: "all", label: "Tout" },
  { key: "in_progress", label: "En cours", statuses: ["ACTIVE", "ON_HOLD"] },
  { key: "completed", label: "Termines", statuses: ["COMPLETED"] },
  { key: "planned", label: "Planifies", statuses: ["DRAFT", "PLANNED"] },
  { key: "cancelled", label: "Annules", statuses: ["CANCELLED"] }
];

function money(value: string | number | undefined, currency = "XOF") {
  const amount = Number(value ?? 0);
  const compact = amount >= 1000000 ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(amount / 1000000)}M` : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount);
  return `${compact} ${currency === "XOF" ? "FCFA" : currency}`;
}

function shortDate(value: string | null | undefined) {
  if (!value) return "Non defini";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(value));
}

function overdueDays(value: string | null | undefined) {
  if (!value) return 0;
  const due = new Date(value);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.max(Math.ceil((today.getTime() - due.getTime()) / 86400000), 0);
}

function responsibleLabel(project: ProjectResource) {
  return project.responsible_member_name || project.owner_name || project.responsible_user_name || "Responsable non defini";
}

function statusConfig(project: ProjectResource) {
  if (project.is_delayed) {
    return { label: "En retard", icon: AlertTriangle, badge: "bg-red-50 text-red-700 ring-red-200", progress: "bg-red-600", date: "text-red-700" };
  }
  if (project.status === "COMPLETED") {
    return { label: "Termine", icon: CheckCircle2, badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", progress: "bg-emerald-600", date: "text-slate-600" };
  }
  if (project.status === "CANCELLED") {
    return { label: "Annule", icon: CircleSlash2, badge: "bg-slate-100 text-slate-600 ring-slate-200", progress: "bg-slate-500", date: "text-slate-600" };
  }
  if (project.status === "DRAFT" || project.status === "PLANNED") {
    return { label: "Planifie", icon: Clock3, badge: "bg-violet-50 text-violet-700 ring-violet-200", progress: "bg-violet-600", date: "text-slate-600" };
  }
  return { label: "En cours", icon: Clock3, badge: "bg-blue-50 text-blue-700 ring-blue-200", progress: "bg-blue-600", date: "text-slate-600" };
}

function priorityLabel(project: ProjectResource) {
  if (project.priority === "CRITICAL") return "Priorite critique";
  if (project.priority === "HIGH") return "Priorite haute";
  if (project.priority === "LOW") return "Priorite basse";
  return project.status_label;
}

function ProjectCard({ project, workspaceSlug }: Readonly<{ project: ProjectResource; workspaceSlug: string }>) {
  const budget = Number(project.budget_summary?.budget ?? project.budget ?? 0);
  const spent = Number(project.budget_summary?.actual_expense ?? 0);
  const rate = Number(project.budget_summary?.consumed_rate ?? 0);
  const visibleRate = Math.min(Math.max(rate, 0), 100);
  const team = project.team_preview.length ? project.team_preview : responsibleLabel(project) !== "Responsable non defini" ? [{ id: project.id, name: responsibleLabel(project), role: "PROJECT_MANAGER" }] : [];
  const state = statusConfig(project);
  const StatusIcon = state.icon;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-3">
        <span className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-black ring-1", state.badge)}>
          <StatusIcon className="size-3.5" />
          {project.priority === "HIGH" || project.priority === "CRITICAL" ? priorityLabel(project) : state.label}
        </span>
        <button className="grid size-8 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100" type="button" aria-label="Actions du projet">
          <MoreVertical className="size-5" />
        </button>
      </div>

      <Link className="block" href={workspacePath(workspaceSlug, `projects/${project.id}`)}>
        <h2 className="text-xl font-black leading-tight text-slate-950">{project.name}</h2>
        <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-slate-600">{project.description || project.category || "Aucune description renseignee pour ce projet."}</p>

        <div className="mt-4">
          <div className="mb-1 flex items-end justify-between gap-3">
            <span className="text-xs font-bold text-slate-500">Budget alloue</span>
            {budget > 0 ? <strong className={cn("text-xl font-black tabular-nums", rate > 100 && "text-red-700")}>{Math.round(rate)}%</strong> : <strong className="text-sm font-black text-slate-600">Sans budget</strong>}
          </div>
          {budget > 0 ? (
            <>
              <p className={cn("text-sm font-black tabular-nums", rate > 100 ? "text-red-700" : "text-slate-950")}>{money(spent, project.currency)} / {money(budget, project.currency)}</p>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div className={cn("h-full rounded-full", state.progress)} style={{ width: `${visibleRate}%` }} />
              </div>
            </>
          ) : (
            <p className="text-sm font-semibold text-slate-500">Aucun montant defini.</p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex -space-x-2">
            {team.slice(0, 2).map((item) => (
              <span className="grid size-7 place-items-center rounded-full border-2 border-white bg-slate-900 text-[10px] font-black text-white" key={`${project.id}-${item.id}`} title={item.name}>
                {item.name.slice(0, 1).toUpperCase()}
              </span>
            ))}
            {team.length > 2 ? <span className="grid size-7 place-items-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-black text-slate-600">+{team.length - 2}</span> : null}
            {!team.length ? <span className="grid size-7 place-items-center rounded-full border-2 border-white bg-slate-100 text-slate-500"><UserRound className="size-3.5" /></span> : null}
          </div>
          <span className={cn("inline-flex items-center gap-1 text-xs font-bold", state.date)}>
            <CalendarDays className="size-3.5" />
            {project.is_delayed ? `Retard de ${overdueDays(project.end_date)}j` : shortDate(project.end_date)}
          </span>
        </div>
      </Link>
    </article>
  );
}

function SkeletonList() {
  return <div className="grid gap-4">{[1, 2, 3].map((item) => <div className="h-52 animate-pulse rounded-xl bg-white ring-1 ring-slate-200" key={item} />)}</div>;
}

export function ProjectsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["project-board", workspaceSlug, search],
    queryFn: () => getProjectBoard(workspaceSlug, search)
  });
  const projects = query.data?.projects || [];
  const visibleProjects = useMemo(() => {
    const selected = filters.find((filter) => filter.key === activeFilter);
    if (!selected?.statuses) return projects;
    return projects.filter((project) => selected.statuses?.includes(project.status));
  }, [activeFilter, projects]);

  function countFor(filter: (typeof filters)[number]) {
    if (filter.key === "all") return query.data?.counts.all ?? 0;
    if (filter.key === "in_progress") return projects.filter((project) => ["ACTIVE", "ON_HOLD"].includes(project.status)).length;
    if (filter.key === "planned") return projects.filter((project) => ["DRAFT", "PLANNED"].includes(project.status)).length;
    if (filter.key === "completed") return query.data?.counts.completed ?? 0;
    return query.data?.counts.cancelled ?? 0;
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#f5f7f8] px-3 pb-24 pt-5 text-slate-950">
      <header className="mb-4">
        <h1 className="text-2xl font-black tracking-normal">Gestion des Projets</h1>
      </header>

      <section className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {filters.map((filter) => (
          <button
            className={cn("min-h-8 shrink-0 rounded-full px-4 text-sm font-black ring-1", activeFilter === filter.key ? "bg-black text-white ring-black" : "bg-white text-slate-700 ring-slate-200")}
            key={filter.key}
            type="button"
            onClick={() => setActiveFilter(filter.key)}
          >
            {filter.label}
            <span className="ml-1 text-xs opacity-70">{countFor(filter)}</span>
          </button>
        ))}
      </section>

      <label className="mb-4 flex min-h-11 items-center gap-2 rounded-xl bg-white px-3 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
        <Search className="size-4 shrink-0" />
        <input className="min-w-0 flex-1 bg-transparent font-semibold outline-none" placeholder="Rechercher un projet..." value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>

      {query.isLoading ? <SkeletonList /> : null}
      {(query.error as { status?: number } | null)?.status === 503 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          Backend indisponible. Verifiez que Django tourne sur le port 8002.
          <button className="ml-2 underline" type="button" onClick={() => query.refetch()}>Reessayer</button>
        </div>
      ) : null}
      {!query.isLoading && !visibleProjects.length ? (
        <div className="grid min-h-60 place-items-center rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <div>
            <FolderKanban className="mx-auto size-10 text-blue-700" />
            <h2 className="mt-3 text-xl font-black text-slate-950">Aucun projet</h2>
            <p className="mt-1 text-sm text-slate-500">Commencez par creer votre premier projet.</p>
            <Button asChild className="mt-5"><Link href={workspacePath(workspaceSlug, "projects/new")}><Plus className="size-4" /> Nouveau projet</Link></Button>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4">
        {visibleProjects.map((project) => <ProjectCard project={project} workspaceSlug={workspaceSlug} key={project.id} />)}
      </section>

      <Link className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-5 z-30 grid size-14 place-items-center rounded-full bg-blue-700 text-white shadow-2xl md:bottom-7" href={workspacePath(workspaceSlug, "projects/new")} aria-label="Creer un projet">
        <Plus className="size-7" />
      </Link>
    </main>
  );
}
