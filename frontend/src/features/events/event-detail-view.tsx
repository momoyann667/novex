import { Activity, Banknote, CheckSquare, FileText, FolderKanban, ScrollText, Users } from "lucide-react";
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

export function EventDetailView({ eventId }: Readonly<{ eventId: string }>) {
  return (
    <div className="grid gap-6">
      <PageHeader title={`Evenement ${eventId}`} description="Date, lieu, responsable, participants et resultat financier." />
      <section className="rounded-card border border-border bg-white p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_280px] md:items-center">
          <div>
            <div className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">PLANNED</div>
            <h1 className="mt-3 text-2xl font-bold tracking-normal">Nom de l'evenement</h1>
            <p className="mt-1 text-sm text-slate-500">Date, heure, lieu et responsable seront charges depuis l'API.</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="flex justify-between text-sm"><span>Taux de presence</span><strong>0%</strong></div>
            <div className="mt-2 h-3 rounded-full bg-slate-100"><div className="h-3 w-0 rounded-full bg-blue-700" /></div>
          </div>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[["0", "Participants"], ["0", "Confirmes"], ["0", "Presents"], ["0 XOF", "Resultat"]].map(([value, label]) => (
          <Card key={label}><CardContent className="p-5"><div className="text-2xl font-bold tabular-nums">{value}</div><p className="mt-1 text-sm text-slate-500">{label}</p></CardContent></Card>
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
          <CardContent className="text-sm text-slate-500">Aucun participant enregistre.</CardContent>
        </Card>
      </section>
    </div>
  );
}
