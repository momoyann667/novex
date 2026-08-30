"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Filter, LayoutGrid, List, Plus, Search, Ticket, Users, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { CALENDAR_MODES, EVENT_STATUSES, EVENT_TYPES } from "./event-status";

const kpis = [
  ["18", "Total evenements", CalendarDays],
  ["7", "A venir", CalendarDays],
  ["4", "Ce mois-ci", CalendarDays],
  ["8", "Termines", CheckCircle2],
  ["1 240", "Participants prevus", Users],
  ["820", "Inscrits", Users],
  ["690", "Presents", Users],
  ["84%", "Presence", CheckCircle2],
  ["6 500 000 XOF", "Budget", WalletCards],
  ["3 200 000 XOF", "Depenses", WalletCards],
  ["4 450 000 XOF", "Recettes", WalletCards],
  ["1 250 000 XOF", "Resultat", WalletCards],
] as const;

const days = Array.from({ length: 35 }, (_, index) => index + 1);

const eventRows = [
  ["EVT-2026-001", "Gala solidaire", "30 Aout 2026", "FUNDRAISING", "Hotel Ivoire", "Awa Kone", "320 / 400", "REGISTRATION_OPEN"],
  ["EVT-2026-002", "Formation tresorerie", "5 Sept 2026", "TRAINING", "En ligne", "Yao Kouame", "86 / 100", "PLANNED"],
  ["EVT-2026-003", "Assemblee generale", "12 Sept 2026", "GENERAL_ASSEMBLY", "Siege", "Mariam Traore", "140 / 180", "PLANNED"],
] as const;

export function EventsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
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
            <Button asChild><Link href={`/app/${workspaceSlug}/events/new`}><Plus className="size-4" /> Nouvel evenement</Link></Button>
          </>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-9">
        {kpis.map(([value, label, Icon]) => (
          <Card key={label}><CardContent className="p-5"><Icon className="size-5 text-blue-700" /><div className="mt-3 text-2xl font-bold tabular-nums">{value}</div><p className="mt-1 text-sm text-slate-500">{label}</p></CardContent></Card>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
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
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><AlertTriangle className="size-4" /> Alertes</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {["Gala solidaire presque complet", "Formation tresorerie: rappel J-7 pret", "Documents manquants pour Assemblee generale", "Budget gala au-dessus de 90%"].map((item) => <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800" key={item}>{item}</div>)}
          </CardContent>
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
        <div className="mt-3 grid gap-2">
          {eventRows.map((row) => (
            <Link className="grid gap-3 rounded-md border border-border p-3 text-sm hover:border-blue-200 hover:bg-slate-50 lg:grid-cols-[1fr_160px_120px_160px_140px_120px_110px_120px]" href={`/app/${workspaceSlug}/events/${row[0]}`} key={row[0]}>
              <span><strong>{row[1]}</strong><span className="block text-xs text-slate-500">{row[0]}</span></span>
              {row.slice(2).map((item) => <span key={item}>{item}</span>)}
            </Link>
          ))}
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        {["Evenements", "Participants", "Performance"].map((title, index) => (
          <Card key={title}>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Ticket className="size-4" /> {title}</CardTitle></CardHeader>
            <CardContent><div className="flex h-36 items-end gap-2">{[30, 68, 52, 88, 74, 46].map((height) => <div className="flex-1 rounded-t bg-blue-700" key={`${title}-${height}`} style={{ height: `${Math.max(10, height - index * 8)}%` }} />)}</div></CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
