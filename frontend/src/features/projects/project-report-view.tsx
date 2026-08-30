import Link from "next/link";
import { ArrowLeft, FileDown, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

export function ProjectReportView({ workspaceSlug, projectId }: Readonly<{ workspaceSlug: string; projectId: string }>) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Rapport projet"
        description="Resume professionnel pour assemblee, partenaire, bailleur ou direction."
        actions={
          <>
            <Button asChild variant="outline"><Link href={`/app/${workspaceSlug}/projects/${projectId}`}><ArrowLeft className="size-4" /> Projet</Link></Button>
            <Button type="button"><FileDown className="size-4" /> Export PDF</Button>
          </>
        }
      />
      <section className="grid gap-4 lg:grid-cols-2">
        {["Presentation", "Objectifs", "Resultats", "Avancement", "Budget", "Depenses", "Equipe", "Activites", "Documents"].map((section) => (
          <Card key={section}>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ScrollText className="size-4" /> {section}</CardTitle></CardHeader>
            <CardContent className="text-sm text-slate-600">Donnees consolidees par le service de rapport projet, avec exports PDF et Excel prepares cote backend.</CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
