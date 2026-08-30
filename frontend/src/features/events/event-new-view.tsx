import { CalendarPlus, CheckCircle2, Megaphone, Ticket, Users, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { EventForm } from "./event-form";

const steps = ["Informations", "Date & lieu", "Participants", "Budget", "Projet", "Communication", "Confirmation"] as const;

export function EventNewView() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Nouvel evenement" description="Assistant evenement avec participants, budget, projet et communication." />
      <section className="grid gap-2 md:grid-cols-7">
        {steps.map((step, index) => <div className="rounded-md border border-border bg-white p-3 text-sm" key={step}><span className="text-xs text-slate-500">Etape {index + 1}</span><strong className="block">{step}</strong></div>)}
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarPlus className="size-4" /> Informations</CardTitle></CardHeader>
          <CardContent><EventForm /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Resume</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="rounded-md border border-border p-3"><Users className="mb-2 size-4 text-blue-700" /> Capacite, inscriptions et waitlist</div>
            <div className="rounded-md border border-border p-3"><Ticket className="mb-2 size-4 text-blue-700" /> Billetterie et QR tickets</div>
            <div className="rounded-md border border-border p-3"><WalletCards className="mb-2 size-4 text-blue-700" /> Budget et transactions Finance</div>
            <div className="rounded-md border border-border p-3"><Megaphone className="mb-2 size-4 text-blue-700" /> Rappels et annonces</div>
            <Button type="button"><CheckCircle2 className="size-4" /> Confirmer</Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

