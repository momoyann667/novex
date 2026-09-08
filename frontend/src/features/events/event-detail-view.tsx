"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Banknote, CalendarClock, CheckCircle2, Clock3, FileText, LinkIcon, Loader2, MapPin, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { backendMediaUrl } from "@/lib/api/media";
import { getEvent, listMemberOptions, listProjectOptions, type EventResource } from "./api";

function money(value: string | number | null | undefined) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA`;
}

function dateTime(value: string | null | undefined) {
  if (!value) return "Non renseigné";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Abidjan"
  }).format(new Date(value));
}

function locationLabel(event: EventResource) {
  if (event.location_type === "ONLINE") return event.online_url || "Lien en ligne non renseigné";
  return [event.location, event.address, event.city].filter(Boolean).join(", ") || "Lieu non renseigné";
}

function projectName(event: EventResource, projects: Array<{ id: number; name: string }>) {
  if (!event.project) return "Aucun projet associé";
  return projects.find((project) => project.id === event.project)?.name || `Projet #${event.project}`;
}

function responsibleName(event: EventResource, members: Array<{ id: number; full_name: string; first_name: string; last_name: string }>) {
  if (!event.responsible_member) return "Aucun responsable";
  const member = members.find((item) => item.id === event.responsible_member);
  return member?.full_name || `${member?.first_name || ""} ${member?.last_name || ""}`.trim() || `Membre #${event.responsible_member}`;
}

function StatCard({ label, value, tone = "slate" }: Readonly<{ label: string; value: string; tone?: "blue" | "green" | "red" | "slate" }>) {
  const toneClass = {
    blue: "text-blue-700 bg-blue-50",
    green: "text-emerald-700 bg-emerald-50",
    red: "text-red-700 bg-red-50",
    slate: "text-slate-700 bg-slate-100"
  }[tone];
  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`rounded-md px-2 py-1 text-[11px] font-black ${toneClass}`}>{label}</span>
      <strong className="mt-4 block break-words text-2xl font-black tracking-normal text-slate-950">{value}</strong>
    </article>
  );
}

export function EventDetailView({ eventId, workspaceSlug }: Readonly<{ eventId: string; workspaceSlug: string }>) {
  const router = useRouter();
  const eventQuery = useQuery({
    queryKey: ["event", workspaceSlug, eventId],
    queryFn: () => getEvent(workspaceSlug, eventId)
  });
  const projectsQuery = useQuery({
    queryKey: ["project-options", workspaceSlug],
    queryFn: () => listProjectOptions(workspaceSlug)
  });
  const membersQuery = useQuery({
    queryKey: ["member-options", workspaceSlug],
    queryFn: () => listMemberOptions(workspaceSlug)
  });
  const event = eventQuery.data;
  const coverUrl = backendMediaUrl(event?.cover_image || "");
  const attendanceRate = Math.min(Number(event?.stats.attendance_rate || 0), 100);
  const budgetRate = Math.min(Number(event?.stats.budget_consumed_rate || 0), 100);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#f5f7f8] px-4 pb-28 pt-5 text-slate-950 md:rounded-[28px] md:px-6">
      <button className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-white px-3 text-sm font-black text-slate-700 shadow-sm" type="button" onClick={() => router.back()}>
        <ArrowLeft className="size-4" />
        Retour
      </button>

      {eventQuery.isLoading ? (
        <section className="grid min-h-80 place-items-center rounded-xl bg-white">
          <Loader2 className="size-8 animate-spin text-blue-700" />
        </section>
      ) : null}

      {eventQuery.isError ? (
        <section className="rounded-xl border border-red-100 bg-red-50 p-5 text-red-700">
          <h1 className="text-xl font-black">Impossible de charger cet événement</h1>
          <p className="mt-2 text-sm font-semibold">Vérifie que le backend tourne et réessaie depuis le calendrier.</p>
        </section>
      ) : null}

      {event ? (
        <div className="grid gap-5">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {coverUrl ? (
              <img className="h-52 w-full object-cover" src={coverUrl} alt="" />
            ) : (
              <div className="grid h-44 place-items-center bg-gradient-to-br from-blue-50 via-white to-orange-50">
                <CalendarClock className="size-14 text-blue-700" />
              </div>
            )}
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">{event.status_label || event.status}</span>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{event.event_type_label}</span>
              </div>
              <h1 className="mt-4 break-words text-3xl font-black leading-tight tracking-normal">{event.title}</h1>
              <p className="mt-2 text-sm font-bold text-slate-500">{event.code || `Événement #${event.id}`}</p>
              {event.description ? <p className="mt-4 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">{event.description}</p> : null}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <StatCard label="Participants" value={String(event.stats.participants || 0)} tone="blue" />
            <StatCard label="Confirmés" value={String(event.stats.confirmed || 0)} tone="green" />
            <StatCard label="Présents" value={String(event.stats.attended || 0)} tone="green" />
            <StatCard label="Capacité" value={event.capacity ? String(event.capacity) : "Illimitée"} />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black tracking-normal">Informations</h2>
            <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-600">
              <p className="flex gap-3"><Clock3 className="mt-0.5 size-5 shrink-0 text-blue-700" /><span><strong className="block text-slate-950">Début</strong>{dateTime(event.start_at)}</span></p>
              <p className="flex gap-3"><CalendarClock className="mt-0.5 size-5 shrink-0 text-blue-700" /><span><strong className="block text-slate-950">Fin</strong>{dateTime(event.end_at)}</span></p>
              <p className="flex gap-3"><MapPin className="mt-0.5 size-5 shrink-0 text-blue-700" /><span className="min-w-0 break-words"><strong className="block text-slate-950">Lieu</strong>{locationLabel(event)}</span></p>
              {event.location_type === "ONLINE" && event.online_url ? (
                <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-black text-white" href={event.online_url} target="_blank" rel="noreferrer">
                  <LinkIcon className="size-4" />
                  Ouvrir le lien
                </a>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black tracking-normal">Organisation</h2>
            <div className="mt-4 grid gap-3">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-500">Projet associé</p>
                <strong className="mt-1 block text-base">{projectName(event, projectsQuery.data || [])}</strong>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-500">Responsable</p>
                <strong className="mt-1 block text-base">{responsibleName(event, membersQuery.data || [])}</strong>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-500">Inscription</p>
                <strong className="mt-1 block text-base">{event.registration_required ? "Inscription requise" : "Inscription non requise"}</strong>
                {event.registration_deadline ? <span className="mt-1 block text-xs font-bold text-slate-500">Limite: {dateTime(event.registration_deadline)}</span> : null}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black tracking-normal">Présence</h2>
            <div className="mt-4 flex items-center justify-between text-sm font-bold text-slate-600">
              <span>Taux de présence</span>
              <strong className="text-slate-950">{attendanceRate}%</strong>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-700" style={{ width: `${attendanceRate}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3"><Users className="size-5 text-blue-700" /><p className="mt-2 text-xs font-bold text-slate-500">Absents</p><strong>{event.stats.absent || 0}</strong></div>
              <div className="rounded-lg bg-slate-50 p-3"><CheckCircle2 className="size-5 text-emerald-700" /><p className="mt-2 text-xs font-bold text-slate-500">Liste d'attente</p><strong>{event.stats.waitlisted || 0}</strong></div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black tracking-normal">Finances</h2>
            <div className="mt-4 flex items-center justify-between text-sm font-bold text-slate-600">
              <span>Budget utilisé</span>
              <strong className="text-slate-950">{budgetRate}%</strong>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${budgetRate}%` }} />
            </div>
            <div className="mt-4 grid gap-3">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4"><span className="inline-flex items-center gap-2 text-sm font-bold text-slate-500"><Banknote className="size-4" /> Budget</span><strong>{money(event.stats.budget || event.budget)}</strong></div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4"><span className="text-sm font-bold text-slate-500">Dépenses</span><strong>{money(event.stats.expenses)}</strong></div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4"><span className="text-sm font-bold text-slate-500">Recettes</span><strong>{money(event.stats.revenues)}</strong></div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4"><span className="text-sm font-bold text-slate-500">Résultat</span><strong>{money(event.stats.balance)}</strong></div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4"><span className="inline-flex items-center gap-2 text-sm font-bold text-slate-500"><Ticket className="size-4" /> Tarif</span><strong>{Number(event.ticket_price || 0) > 0 ? money(event.ticket_price) : "Gratuit"}</strong></div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-xl font-black tracking-normal"><FileText className="size-5 text-blue-700" /> Synthèse</h2>
            <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-600">
              <p><strong className="text-slate-950">Fuseau horaire :</strong> {event.timezone}</p>
              <p><strong className="text-slate-950">Récurrence :</strong> {event.recurrence}</p>
              <p><strong className="text-slate-950">Dernière mise à jour :</strong> {dateTime(event.updated_at)}</p>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
