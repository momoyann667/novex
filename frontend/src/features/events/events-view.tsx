"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, Ticket, Users, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";

type EventRow = {
  id: string;
  title: string;
  day: number;
  time: string;
  type: string;
  location: string;
  participants: string;
  participantPercent: number;
  budget: string;
  expense: string;
  revenue: string;
  status: "Bientot" | "Ouvert" | "Complet";
};

const monthLabel = "Novembre 2023";
const todayDay = 10;
const leadingDays = [30, 31];

const events: EventRow[] = [
  {
    id: "EVT-2023-001",
    title: "Assemblee Generale Annuelle",
    day: 15,
    time: "18:00",
    type: "Conference",
    location: "Centre de Conference",
    participants: "120/150",
    participantPercent: 80,
    budget: "5 000 EUR",
    expense: "3 200 EUR",
    revenue: "6 500 EUR",
    status: "Bientot"
  },
  {
    id: "EVT-2023-002",
    title: "Atelier Formation Numerique",
    day: 19,
    time: "09:00",
    type: "Formation",
    location: "En ligne (Zoom)",
    participants: "45/50",
    participantPercent: 90,
    budget: "500 EUR",
    expense: "120 EUR",
    revenue: "0 EUR",
    status: "Ouvert"
  },
  {
    id: "EVT-2023-003",
    title: "Reunion Bureau Executif",
    day: 10,
    time: "16:30",
    type: "Reunion",
    location: "Siege NOVEX",
    participants: "12/12",
    participantPercent: 100,
    budget: "150 EUR",
    expense: "80 EUR",
    revenue: "0 EUR",
    status: "Complet"
  },
  {
    id: "EVT-2023-004",
    title: "Journee Communautaire",
    day: 24,
    time: "08:00",
    type: "Social",
    location: "Parc municipal",
    participants: "210/300",
    participantPercent: 70,
    budget: "2 800 EUR",
    expense: "1 100 EUR",
    revenue: "900 EUR",
    status: "Bientot"
  }
];

const days = [
  ...leadingDays.map((day) => ({ day, outside: true })),
  ...Array.from({ length: 30 }, (_, index) => ({ day: index + 1, outside: false })),
  ...[1, 2, 3].map((day) => ({ day, outside: true }))
];

function eventDotClass(status: EventRow["status"]) {
  return {
    Bientot: "bg-blue-700",
    Ouvert: "bg-emerald-600",
    Complet: "bg-amber-500"
  }[status];
}

function statusClass(status: EventRow["status"]) {
  return {
    Bientot: "bg-blue-50 text-blue-700",
    Ouvert: "bg-emerald-50 text-emerald-700",
    Complet: "bg-amber-50 text-amber-700"
  }[status];
}

function eventDaySummary(day: number) {
  const count = events.filter((event) => event.day === day).length;
  if (!count) return "";
  return `${count} evenement${count > 1 ? "s" : ""}`;
}

export function EventsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const [selectedDay, setSelectedDay] = useState(15);
  const selectedEvents = useMemo(() => events.filter((event) => event.day === selectedDay), [selectedDay]);
  const upcomingEvents = events.filter((event) => event.day >= todayDay).length;
  const averageParticipation = Math.round(events.reduce((total, event) => total + event.participantPercent, 0) / events.length);

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-4 pb-28 pt-5 text-slate-950 md:rounded-[28px] md:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-normal">Evenements</h1>
          <p className="mt-2 max-w-md text-sm font-semibold leading-5 text-slate-600">Gerez le calendrier et les performances de vos rassemblements.</p>
        </div>
        <Button asChild className="hidden min-h-11 px-4 md:inline-flex">
          <Link href={`/app/${workspaceSlug}/events/new`}>
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
          <p className="mt-2 text-3xl font-black">387</p>
        </article>
        <article className="min-h-24 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-500">Budget total</p>
          <p className="mt-2 text-2xl font-black">8 450 EUR</p>
        </article>
      </section>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black tracking-normal">{monthLabel}</h2>
          <div className="flex gap-1">
            <button className="grid size-8 place-items-center rounded-md hover:bg-slate-100" type="button" aria-label="Mois precedent">
              <ChevronLeft className="size-4" />
            </button>
            <button className="grid size-8 place-items-center rounded-md hover:bg-slate-100" type="button" aria-label="Mois suivant">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-y-2 text-center text-xs font-black text-blue-900">
          {["L", "M", "M", "J", "V", "S", "D"].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-y-2">
          {days.map(({ day, outside }, index) => {
            const dayEvents = outside ? [] : events.filter((event) => event.day === day);
            const isToday = !outside && day === todayDay;
            const isSelected = !outside && day === selectedDay;
            return (
              <button
                className={`relative mx-auto grid size-10 place-items-center rounded-full text-sm font-bold transition-colors ${outside ? "text-slate-300" : isSelected ? "bg-slate-950 text-white" : isToday ? "bg-blue-700 text-white" : "text-slate-800 hover:bg-blue-50"}`}
                type="button"
                key={`${outside ? "outside" : "current"}-${day}-${index}`}
                onClick={() => !outside && setSelectedDay(day)}
                aria-label={`${day} novembre ${eventDaySummary(day)}`}
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
          <span className="inline-flex items-center gap-1"><span className="size-4 rounded-full bg-blue-700" /> Jour actuel</span>
        </div>
      </section>

      <section className="mt-5 grid gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Evenements du {selectedDay} novembre</h2>
          <span className="text-xs font-bold text-slate-500">{selectedEvents.length} selection</span>
        </div>

        {selectedEvents.length ? selectedEvents.map((event) => (
          <Link
            className="block rounded-lg border border-slate-200 border-l-blue-700 bg-white p-4 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/40"
            href={`/app/${workspaceSlug}/events/${event.id}`}
            key={event.id}
          >
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span className={`rounded px-2 py-1 ${statusClass(event.status)}`}>{event.status}</span>
              <Clock3 className="size-4" />
              <span>{selectedDay} Nov, {event.time}</span>
            </div>
            <h3 className="mt-2 text-xl font-black tracking-normal">{event.title}</h3>
            <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
              <MapPin className="size-4" />
              {event.location}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-md bg-slate-50 p-3">
                <p className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"><Users className="size-3" /> Participants</p>
                <p className="mt-1 text-2xl font-black">{event.participants}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${event.participantPercent}%` }} />
                </div>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"><WalletCards className="size-3" /> Budget</p>
                <p className="mt-1 text-base font-black">{event.budget}</p>
                <p className="mt-2 text-xs font-bold text-red-600">Dep. {event.expense}</p>
              </div>
              <div className="col-span-2 rounded-md bg-slate-50 p-3">
                <p className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"><Ticket className="size-3" /> Recettes</p>
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
        <Link href={`/app/${workspaceSlug}/events/new`} aria-label="Ajouter un evenement">
          <Plus className="size-7" />
        </Link>
      </Button>
    </main>
  );
}
