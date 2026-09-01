"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, Ticket, Users, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { workspacePath } from "@/lib/workspace/routing";
import { getEventsOverview, listCalendarItems, type CalendarItem, type EventOverview } from "./api";

type EventRow = {
  id: string;
  title: string;
  date: string;
  time: string;
  type: string;
  location: string;
  participants: string;
  participantPercent: number;
  budget: string;
  expense: string;
  revenue: string;
  status: "Bientot" | "Ouvert" | "Complet" | "Echeance" | "Rappel";
  sourceType: CalendarItem["source_type"];
  sourceUrl: string;
};

const monthNames = ["Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin", "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre"];
const currency = "FCFA";

const emptyOverview: EventOverview = {
  upcoming_events: 0,
  month_events: 0,
  completed_events: 0,
  cancelled_events: 0,
  planned_participants: 0,
  average_attendance_rate: 0,
  total_budget: 0,
  total_expenses: 0,
  total_revenues: 0,
  net_result: 0
};

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthLabel(date: Date) {
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function getCalendarDays(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();
  const leadingCount = (firstDay.getDay() + 6) % 7;
  const currentDays = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    return { day, date: toIsoDate(new Date(year, month, day)), outside: false };
  });
  const leadingDays = Array.from({ length: leadingCount }, (_, index) => {
    const day = previousMonthDays - leadingCount + index + 1;
    return { day, date: toIsoDate(new Date(year, month - 1, day)), outside: true };
  });
  const trailingCount = Math.max(0, 42 - leadingDays.length - currentDays.length);
  const trailingDays = Array.from({ length: trailingCount }, (_, index) => {
    const day = index + 1;
    return { day, date: toIsoDate(new Date(year, month + 1, day)), outside: true };
  });
  return [...leadingDays, ...currentDays, ...trailingDays];
}

function getDisplayDay(dateIso: string) {
  return Number(dateIso.slice(8, 10));
}

function getDisplayMonth(dateIso: string) {
  return monthNames[Number(dateIso.slice(5, 7)) - 1].slice(0, 3);
}

function eventDotClass(status: EventRow["status"]) {
  return {
    Bientot: "bg-blue-700",
    Ouvert: "bg-emerald-600",
    Complet: "bg-amber-500",
    Echeance: "bg-rose-600",
    Rappel: "bg-cyan-600"
  }[status];
}

function statusClass(status: EventRow["status"]) {
  return {
    Bientot: "bg-blue-50 text-blue-700",
    Ouvert: "bg-emerald-50 text-emerald-700",
    Complet: "bg-amber-50 text-amber-700",
    Echeance: "bg-rose-50 text-rose-700",
    Rappel: "bg-cyan-50 text-cyan-700"
  }[status];
}

function eventDaySummary(dateIso: string, events: EventRow[]) {
  const count = events.filter((event) => event.date === dateIso).length;
  if (!count) return "";
  return `${count} evenement${count > 1 ? "s" : ""}`;
}

function money(value: string | number | null | undefined) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ${currency}`;
}

function mapStatus(status: string, sourceType: CalendarItem["source_type"]): EventRow["status"] {
  if (["DEADLINE", "PROJECT", "TASK", "CONTRIBUTION", "FINANCE"].includes(sourceType)) return "Echeance";
  if (["REMINDER", "COMMUNICATION"].includes(sourceType)) return "Rappel";
  if (status === "COMPLETED" || status === "CANCELLED" || status === "ARCHIVED") return "Complet";
  if (status === "REGISTRATION_OPEN" || status === "PUBLISHED" || status === "ONGOING") return "Ouvert";
  return "Bientot";
}

function typeLabel(sourceType: CalendarItem["source_type"]) {
  return {
    EVENT: "Evenement",
    MEETING: "Reunion",
    DEADLINE: "Echeance",
    CONTRIBUTION: "Cotisation",
    PROJECT: "Projet",
    TASK: "Tache",
    REMINDER: "Rappel",
    COMMUNICATION: "Communication",
    FINANCE: "Finance",
    OTHER: "Autre"
  }[sourceType];
}

function toEventRow(item: CalendarItem): EventRow {
  const participantPercent = item.source_type === "EVENT" ? 0 : 100;
  return {
    id: item.id,
    title: item.title,
    date: item.start_at.slice(0, 10),
    time: item.all_day ? "Journee" : new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" }).format(new Date(item.start_at)),
    type: typeLabel(item.source_type),
    location: item.location || item.description || "NOVEX",
    participants: item.source_type === "EVENT" ? "-" : "Planifie",
    participantPercent,
    budget: item.description || "Source NOVEX",
    expense: item.status || "-",
    revenue: item.source_type,
    status: mapStatus(item.status, item.source_type),
    sourceType: item.source_type,
    sourceUrl: item.source_url
  };
}

export function EventsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const [today] = useState(() => new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));
  const todayIso = toIsoDate(today);
  const monthStart = toIsoDate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1));
  const monthEnd = toIsoDate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0));
  const calendarQuery = useQuery({
    queryKey: ["calendar-items", workspaceSlug, monthStart, monthEnd],
    queryFn: () => listCalendarItems(workspaceSlug, { start: monthStart, end: monthEnd })
  });
  const overviewQuery = useQuery({
    queryKey: ["events-overview", workspaceSlug],
    queryFn: () => getEventsOverview(workspaceSlug)
  });
  const events = calendarQuery.data?.map(toEventRow) ?? [];
  const overview = overviewQuery.data ?? emptyOverview;
  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const selectedEvents = useMemo(() => events.filter((event) => event.date === selectedDate), [events, selectedDate]);
  const upcomingEvents = overviewQuery.data ? overview.upcoming_events : events.filter((event) => event.date >= todayIso).length;
  const averageParticipation = overviewQuery.data ? Math.round(overview.average_attendance_rate) : Math.round(events.reduce((total, event) => total + event.participantPercent, 0) / Math.max(events.length, 1));
  const selectedDay = getDisplayDay(selectedDate);
  const selectedMonth = getDisplayMonth(selectedDate);

  function changeMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-4 pb-28 pt-5 text-slate-950 md:rounded-[28px] md:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-normal">Evenements</h1>
          <p className="mt-2 max-w-md text-sm font-semibold leading-5 text-slate-600">Gerez le calendrier et les performances de vos rassemblements.</p>
        </div>
        <Button asChild className="hidden min-h-11 px-4 md:inline-flex">
          <Link href={workspacePath(workspaceSlug, "events/new")}>
            <Plus className="size-4" />
            Nouvel evenement
          </Link>
        </Button>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <article className="min-h-24 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">Evenements a venir</p>
          <p className="mt-2 text-3xl font-black">{upcomingEvents}</p>
        </article>
        <article className="min-h-24 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">Participation moy.</p>
          <p className="mt-2 text-3xl font-black text-emerald-600">{averageParticipation}%</p>
        </article>
        <article className="min-h-24 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">Inscrits</p>
          <p className="mt-2 text-3xl font-black">{overview.planned_participants || events.reduce((total, event) => total + Number(event.participants.split("/")[0] || 0), 0)}</p>
        </article>
        <article className="min-h-24 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">Budget total</p>
          <p className="mt-2 text-2xl font-black">{money(overview.total_budget)}</p>
        </article>
      </section>

      {calendarQuery.isError ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">API calendrier indisponible. Verifiez le backend puis rechargez la page.</p>
      ) : null}

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black tracking-normal">{getMonthLabel(visibleMonth)}</h2>
          <div className="flex gap-1">
            <button className="grid size-8 place-items-center rounded-md hover:bg-slate-100" type="button" aria-label="Mois precedent" onClick={() => changeMonth(-1)}>
              <ChevronLeft className="size-4" />
            </button>
            <button className="grid size-8 place-items-center rounded-md hover:bg-slate-100" type="button" aria-label="Mois suivant" onClick={() => changeMonth(1)}>
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-y-2 text-center text-xs font-black text-blue-900">
          {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-y-2">
          {calendarDays.map(({ day, date, outside }, index) => {
            const dayEvents = events.filter((event) => event.date === date);
            const isToday = date === todayIso;
            const isSelected = date === selectedDate;
            return (
              <button
                className={`relative mx-auto grid size-10 place-items-center rounded-full text-sm font-bold transition-colors ${outside ? "text-slate-300" : isSelected ? "bg-slate-950 text-white" : isToday ? "bg-blue-700 text-white" : "text-slate-800 hover:bg-blue-50"}`}
                type="button"
                key={`${date}-${index}`}
                onClick={() => setSelectedDate(date)}
                aria-label={`${day} ${getMonthLabel(new Date(date))} ${eventDaySummary(date, events)}`}
              >
                {day}
                {dayEvents.length ? (
                  <span className="absolute -bottom-1 flex gap-0.5">
                    {dayEvents.slice(0, 3).map((event) => <span className={`block size-1.5 rounded-full border border-white ${eventDotClass(event.status)}`} key={event.id} />)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-[11px] font-bold text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-blue-700" /> Bientot</span>
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-600" /> Ouvert</span>
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500" /> Complet</span>
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-rose-600" /> Echeance</span>
          <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-cyan-600" /> Rappel</span>
          <span className="inline-flex items-center gap-1"><span className="size-4 rounded-full bg-blue-700" /> Jour actuel</span>
        </div>
      </section>

      <section className="mt-5 grid gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Planning du {selectedDay} {selectedMonth.toLowerCase()}</h2>
          <span className="text-xs font-bold text-slate-500">{selectedEvents.length} selection</span>
        </div>

        {selectedEvents.length ? selectedEvents.map((event) => (
          <Link
            className="block rounded-lg border border-slate-200 border-l-blue-700 bg-white p-4 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/40"
            href={workspacePath(workspaceSlug, event.sourceUrl)}
            key={event.id}
          >
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span className={`rounded px-2 py-1 ${statusClass(event.status)}`}>{event.status}</span>
              <Clock3 className="size-4" />
              <span>{getDisplayDay(event.date)} {getDisplayMonth(event.date)}, {event.time}</span>
            </div>
            <h3 className="mt-2 text-xl font-black tracking-normal">{event.title}</h3>
            <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
              <MapPin className="size-4" />
              {event.location}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-md bg-slate-50 p-3">
                <p className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"><Users className="size-3" /> {event.type}</p>
                <p className="mt-1 text-2xl font-black">{event.participants}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${event.participantPercent}%` }} />
                </div>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"><WalletCards className="size-3" /> Infos</p>
                <p className="mt-1 text-base font-black">{event.budget}</p>
                <p className="mt-2 text-xs font-bold text-red-600">Dep. {event.expense}</p>
              </div>
              <div className="col-span-2 rounded-md bg-slate-50 p-3">
                <p className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"><Ticket className="size-3" /> Source</p>
                <p className="mt-1 text-2xl font-black text-emerald-600">{event.revenue}</p>
              </div>
            </div>
          </Link>
        )) : (
          <article className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
            <CalendarDays className="mx-auto size-8 text-slate-300" />
            <h3 className="mt-3 text-lg font-black">Aucun evenement ce jour</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Selectionnez une date avec un point pour afficher les details.</p>
          </article>
        )}
      </section>

      <Button asChild className="fixed bottom-24 right-5 z-20 grid size-14 place-items-center rounded-full bg-blue-700 p-0 text-white shadow-xl shadow-blue-900/25 md:hidden">
        <Link href={workspacePath(workspaceSlug, "events/new")} aria-label="Ajouter un evenement">
          <Plus className="size-7" />
        </Link>
      </Button>
    </main>
  );
}
