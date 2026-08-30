import Link from "next/link";
import { ArrowLeft, FileDown, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const sections = ["Resume", "Objectifs", "Participants", "Presence", "Programme", "Budget", "Recettes", "Depenses", "Resultat", "Photos/documents", "Observations"] as const;

export function EventReportView({ workspaceSlug, eventId }: Readonly<{ workspaceSlug: string; eventId: string }>) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Rapport evenement"
        description="Synthese post-evenement avec finance, presence, satisfaction et documents."
        actions={
          <>
            <Button asChild variant="outline"><Link href={`/app/${workspaceSlug}/events/${eventId}`}><ArrowLeft className="size-4" /> Evenement</Link></Button>
            <Button type="button"><FileDown className="size-4" /> Export PDF</Button>
          </>
        }
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[["320", "Participants"], ["81%", "Presence"], ["3 200 000 XOF", "Budget realise"], ["10 000 XOF", "Cout moyen"]].map(([value, label]) => <Card key={label}><CardContent className="p-4"><div className="text-xl font-bold tabular-nums">{value}</div><p className="text-xs text-slate-500">{label}</p></CardContent></Card>)}
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => <Card key={section}><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ScrollText className="size-4" /> {section}</CardTitle></CardHeader><CardContent className="text-sm text-slate-600">Donnees consolidees par le service de rapport evenement.</CardContent></Card>)}
      </section>
    </div>
  );
}

