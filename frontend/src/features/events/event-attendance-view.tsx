import Link from "next/link";
import { ArrowLeft, CheckCircle2, QrCode, Search, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const participants = ["Awa Kone - Ticket NVX-TKT-8F3K2A", "Yao Kouame - Confirme", "Mariam Traore - Waitlist"] as const;

export function EventAttendanceView({ workspaceSlug, eventId }: Readonly<{ workspaceSlug: string; eventId: string }>) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Check-in evenement"
        description="Scanner, rechercher, valider presence et bloquer la double utilisation ticket."
        actions={<Button asChild variant="outline"><Link href={`/app/${workspaceSlug}/events/${eventId}`}><ArrowLeft className="size-4" /> Evenement</Link></Button>}
      />
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><QrCode className="size-4" /> Scanner QR</CardTitle></CardHeader>
          <CardContent>
            <div className="grid min-h-80 place-items-center rounded-md border border-dashed border-border bg-slate-50 text-center">
              <div><QrCode className="mx-auto size-16 text-blue-700" /><strong className="mt-4 block">Mode scan rapide</strong><p className="text-sm text-slate-500">Resultat immediat: nom, ticket, statut, heure.</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Search className="size-4" /> Recherche</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <input className="min-h-11 rounded-md border border-border px-3 text-sm" placeholder="Nom, telephone, ticket..." />
            {participants.map((item) => <div className="rounded-md border border-border p-3 text-sm" key={item}><UserCheck className="mb-2 size-4 text-blue-700" /> {item}<Button className="mt-3 w-full" type="button"><CheckCircle2 className="size-4" /> Present</Button></div>)}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

