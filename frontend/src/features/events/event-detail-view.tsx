import Link from "next/link";
import { Activity, Banknote, CalendarClock, CheckCircle2, CheckSquare, FileText, FolderKanban, Megaphone, QrCode, ScrollText, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

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

const detailKpis = [["320", "Participants"], ["280", "Confirmes"], ["226", "Presents"], ["81%", "Presence"], ["400", "Capacite"], ["80%", "Remplissage"], ["4 450 000 XOF", "Recettes"], ["1 250 000 XOF", "Resultat"]] as const;

const quickCards = [["QR event", "NOVEX EVENT EVT-2026-001", QrCode], ["Billetterie", "3 types de tickets", Ticket], ["Programme", "8 sessions planifiees", CalendarClock], ["Communication", "Rappel J-7 pret", Megaphone]] as const;

export function EventDetailView({ eventId, workspaceSlug }: Readonly<{ eventId: string; workspaceSlug: string }>) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Evenement ${eventId}`}
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
            <div className="inline-flex rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">REGISTRATION_OPEN</div>
            <h1 className="mt-3 text-2xl font-bold tracking-normal">Nom de l'evenement</h1>
            <p className="mt-1 text-sm text-slate-500">EVT-2026-001 - Africa/Abidjan - Hotel Ivoire - responsable Awa Kone</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="flex justify-between text-sm"><span>Taux de presence</span><strong>0%</strong></div>
            <div className="mt-2 h-3 rounded-full bg-slate-100"><div className="h-3 w-0 rounded-full bg-blue-700" /></div>
          </div>
        </div>
      </section>
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
            <div className="flex justify-between text-sm"><span>0 / 0 XOF</span><strong>0%</strong></div>
            <div className="mt-2 h-3 rounded-full bg-slate-100"><div className="h-3 w-0 rounded-full bg-blue-700" /></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-slate-500">Depenses</p><strong>0 XOF</strong></div>
              <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-slate-500">Recettes</p><strong>0 XOF</strong></div>
              <div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-slate-500">Marge</p><strong>0%</strong></div>
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
