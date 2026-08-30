import { CheckCircle2, FolderKanban, ListChecks, Users, WalletCards } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ProjectForm } from "./project-form";

const steps = ["Informations", "Planning", "Budget", "Equipe", "Objectifs", "Confirmation"];

export function ProjectNewView() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Nouveau projet" description="Assistant de creation avec planning, budget, equipe et objectifs." />
      <section className="grid gap-2 md:grid-cols-6">
        {steps.map((step, index) => <div className="rounded-md border border-border bg-white p-3 text-sm" key={step}><span className="text-xs text-slate-500">Etape {index + 1}</span><div className="font-semibold">{step}</div></div>)}
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FolderKanban className="size-4" /> Informations projet</CardTitle></CardHeader>
          <CardContent><ProjectForm /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Resume</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="rounded-md border border-border p-3"><WalletCards className="mb-2 size-4 text-blue-700" /> Budget prevu: 0 XOF</div>
            <div className="rounded-md border border-border p-3"><Users className="mb-2 size-4 text-blue-700" /> Equipe: responsable + membres</div>
            <div className="rounded-md border border-border p-3"><ListChecks className="mb-2 size-4 text-blue-700" /> Objectifs et KPI mesurables</div>
            <Button type="button"><CheckCircle2 className="size-4" /> Confirmer</Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

