"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, Banknote, CalendarClock, CheckCircle2, CheckSquare, FileText, FolderKanban, Megaphone, QrCode, ScrollText, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { getEvent, type EventResource } from "./api";

const tabs = [
  ["Resume", FolderKanban],
  ["Participants", Users],
  ["Budget", Banknote],
  ["Depenses", Banknote],
  ["Recettes", Banknote],
  ["Documents", FileText],
  ["Presences", CheckSquare],
  ["Activite", Activity],
  ["Rapport", ScrollText],
] as const;

const quickCards = [["QR event", "NOVEX EVENT EVT-2026-001", QrCode], ["Billetterie", "3 types de tickets", Ticket], ["Programme", "8 sessions planifiees", CalendarClock], ["Communication", "Rappel J-7 pret", Megaphone]] as const;

function money(value: string | number | null | undefined) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA`;
}

function eventKpis(event?: EventResource) {
  if (!event) {
    return [["0", "Participants"], ["0", "Confirmes"], ["0", "Presents"], ["0%", "Presence"], ["0", "Capacite"], ["0%", "Remplissage"], ["0 FCFA", "Recettes"], ["0 FCFA", "Resultat"]] as const;
  }
  return [
    [String(event.stats.participants || 0), "Participants"],
    [String(event.stats.confirmed || 0), "Confirmes"],
    [String(event.stats.attended || 0), "Presents"],
    [`${event.stats.attendance_rate || 0}%`, "Presence"],
    [String(event.capacity || event.stats.capacity || 0), "Capacite"],
    [`${event.stats.occupancy_rate || 0}%`, "Remplissage"],
    [money(event.stats.revenues), "Recettes"],
    [money(event.stats.balance), "Resultat"],
  ] as const;
}

export function EventDetailView({ eventId, workspaceSlug }: Readonly<{ eventId: string; workspaceSlug: string }>) {
  const eventQuery = useQuery({
    queryKey: ["event", workspaceSlug, eventId],
    queryFn: () => getEvent(workspaceSlug, eventId)
  });
  const event = eventQuery.data;
  const detailKpis = eventKpis(event);

  return (
    <div className="grid gap-6">
      <PageHeader
        title={event ? event.title : `Evenement ${eventId}`}
        description="Planning, participants, presences, tickets, finances et rapport."
        actions={
          <>
            <Button asChild variant="outline"><Link href={`/app/${workspaceSlug}/events/${eventId}/attendance`}><QrCode className="size-4" /> Check-in</Link></Button>
            <Button asChild><Link href={`/app/${workspaceSlug}/events/${eventId}/report`}><ScrollText className="size-4" /> Rapport</Link></Button>
          </>
        }
      />
      <section className="rounded-card border border-border bg-white p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_280px] md:items-center">
          <div>
            <div className="inline-flex rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{event?.status || "CHARGEMENT"}</div>
            <h1 className="mt-3 text-2xl font-bold tracking-normal">{event?.title || "Chargement de l'evenement"}</h1>
            <p className="mt-1 text-sm text-slate-500">{event ? `${event.code} - ${event.timezone} - ${event.location || "Lieu a confirmer"} - ${event.event_type_label}` : "Connexion aux donnees backend..."}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="flex justify-between text-sm"><span>Taux de presence</span><strong>{event?.stats.attendance_rate || 0}%</strong></div>
            <div className="mt-2 h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-blue-700" style={{ width: `${Math.min(Number(event?.stats.attendance_rate || 0), 100)}%` }} /></div>
          </div>
        </div>
      </section>
      {eventQuery.isError ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">Impossible de charger cet evenement depuis l'API.</p> : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {detailKpis.map(([value, label]) => (
          <Card key={label}><CardContent className="p-5"><div className="text-2xl font-bold tabular-nums">{value}</div><p className="mt-1 text-sm text-slate-500">{label}</p></CardContent></Card>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-4">
        {quickCards.map(([title, body, Icon]) => (
          <Card key={String(title)}><CardContent className="p-4"><Icon className="size-5 text-blue-700" /><strong className="mt-3 block">{title}</strong><p className="text-sm text-slate-500">{body}</p></CardContent></Card>
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
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-900">Budget evenement</CardTitle></CardHeader>
          <CardContent>
            <div className="flex justify-between text-sm"><span>{money(event?.stats.expenses)} / {money(event?.stats.budget)}</span><strong>{event?.stats.budget_consumed_rate || 0}%</strong></div>
            <div className="mt-2 h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-blue-700" style={{ width: `${Math.min(Number(event?.stats.budget_consumed_rate || 0), 100)}%` }} /></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-slate-500">Depenses</p><strong>{money(event?.stats.expenses)}</strong></div>
              <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-slate-500">Recettes</p><strong>{money(event?.stats.revenues)}</strong></div>
              <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-slate-500">Marge</p><strong>{event?.stats.budget_consumed_rate || 0}%</strong></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-900">Presences</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {["Awa Kone - presente", "Yao Kouame - confirme", "Mariam Traore - waitlist"].map((item) => <div className="rounded-md border border-border p-3" key={item}>{item}</div>)}
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        {["08:00 Accueil", "09:00 Ouverture", "10:00 Formation", "12:00 Pause", "14:00 Atelier", "17:00 Cloture"].map((item) => (
          <Card key={item}><CardContent className="p-4"><CheckCircle2 className="size-4 text-blue-700" /><strong className="mt-2 block">{item}</strong><p className="text-sm text-slate-500">Intervenant et salle charges depuis le programme.</p></CardContent></Card>
        ))}
      </section>
    </div>
  );
}
