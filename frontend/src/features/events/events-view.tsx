"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Filter, LayoutGrid, List, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { CALENDAR_MODES, EVENT_STATUSES, EVENT_TYPES } from "./event-status";
import { EventForm } from "./event-form";

const kpis = [
  ["0", "A venir"],
  ["0", "Ce mois-ci"],
  ["0", "Termines"],
  ["0", "Annules"],
  ["0", "Participants prevus"],
  ["0%", "Participation"],
  ["0 XOF", "Budget"],
  ["0 XOF", "Depenses"],
  ["0 XOF", "Recettes"],
];

const days = Array.from({ length: 35 }, (_, index) => index + 1);

export function EventsView() {
  const [mode, setMode] = useState<(typeof CALENDAR_MODES)[number]>("Mois");
  const [visualMode, setVisualMode] = useState<"list" | "cards">("list");

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Evenements"
        description="Calendrier, participants, presences et budget evenementiel."
        actions={
          <>
            <Button type="button" variant="outline"><Filter className="size-4" /> Filtres</Button>
            <Button type="button"><Plus className="size-4" /> Nouvel evenement</Button>
          </>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-9">
        {kpis.map(([value, label]) => (
          <Card key={label}><CardContent className="p-5"><div className="text-2xl font-bold tabular-nums">{value}</div><p className="mt-1 text-sm text-slate-500">{label}</p></CardContent></Card>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="flex items-center gap-2 text-base text-slate-900"><CalendarDays className="size-4" /> Calendrier NOVEX</CardTitle>
              <div className="flex flex-wrap gap-2">
                {CALENDAR_MODES.map((item) => (
                  <button className={`min-h-9 rounded-md px-3 text-sm font-semibold ${mode === item ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700"}`} key={item} onClick={() => setMode(item)} type="button">
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" aria-label="Periode precedente"><ChevronLeft className="size-4" /></Button>
              <strong>Aout 2026</strong>
              <Button type="button" variant="outline" aria-label="Periode suivante"><ChevronRight className="size-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {mode === "Mois" ? (
              <div className="grid grid-cols-7 overflow-hidden rounded-md border border-border">
                {["L", "M", "M", "J", "V", "S", "D"].map((day) => <div className="bg-slate-50 p-2 text-center text-xs font-semibold text-slate-500" key={day}>{day}</div>)}
                {days.map((day) => (
                  <button className="aspect-square border-t border-border p-2 text-left text-sm hover:bg-blue-50" key={day} type="button">
                    <span className="font-semibold">{day <= 31 ? day : ""}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid place-items-center rounded-md border border-dashed border-border bg-slate-50 p-10 text-center">
                <div><CalendarDays className="mx-auto size-8 text-blue-700" /><p className="mt-2 font-semibold">Vue {mode}</p><p className="text-sm text-slate-500">Les evenements de la periode chargee par l'API calendrier apparaitront ici.</p></div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-900">Creation rapide</CardTitle></CardHeader>
          <CardContent><EventForm /></CardContent>
        </Card>
      </section>
      <section className="rounded-card border border-border bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px_120px]">
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-slate-500">
            <Search className="size-4" />
            <input className="w-full bg-transparent outline-none" placeholder="Rechercher un evenement..." />
          </label>
          <select className="min-h-10 rounded-md border border-border px-3 text-sm"><option>Type</option>{EVENT_TYPES.map((type) => <option key={type.value}>{type.label}</option>)}</select>
          <select className="min-h-10 rounded-md border border-border px-3 text-sm"><option>Statut</option>{EVENT_STATUSES.map((status) => <option key={status.value}>{status.label}</option>)}</select>
          <Button type="button" variant="outline" onClick={() => setVisualMode(visualMode === "list" ? "cards" : "list")}>{visualMode === "list" ? <LayoutGrid className="size-4" /> : <List className="size-4" />} Vue</Button>
        </div>
        <div className="mt-4 hidden grid-cols-[1fr_160px_120px_160px_140px_120px_110px_100px] gap-3 border-b border-border px-3 py-3 text-xs font-semibold uppercase text-slate-500 lg:grid">
          <span>Evenement</span><span>Date</span><span>Type</span><span>Lieu</span><span>Responsable</span><span>Participants</span><span>Budget</span><span>Statut</span>
        </div>
        <div className="grid place-items-center p-10 text-center">
          <div>
            <CalendarDays className="mx-auto size-8 text-blue-700" />
            <h2 className="mt-3 font-semibold">Aucun evenement dans cette periode.</h2>
            <p className="mt-1 text-sm text-slate-500">Le calendrier charge uniquement la fenetre demandee pour rester rapide.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
