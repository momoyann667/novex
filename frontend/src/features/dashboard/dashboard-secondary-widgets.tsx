import { AlertTriangle, CalendarDays, FileText, FolderKanban, Lightbulb, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardOverview } from "./types";

export function DashboardSecondaryWidgets({ data }: Readonly<{ data: DashboardOverview }>) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-slate-900"><FolderKanban className="size-4" /> Projets</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          <div className="text-3xl font-bold text-slate-950">{data.kpis.projects.total}</div>
          <p>{data.kpis.projects.active} en cours, {data.kpis.projects.at_risk} a surveiller, {data.kpis.projects.late} en retard.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-slate-900"><CalendarDays className="size-4" /> Prochains evenements</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          <div className="text-3xl font-bold text-slate-950">{data.kpis.events.upcoming}</div>
          <p>Aucun evenement planifie dans les donnees actuelles.</p>
          <Button className="mt-4" type="button" variant="outline">Voir le calendrier</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-slate-900"><AlertTriangle className="size-4" /> A surveiller</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          {data.alerts.length ? data.alerts.map((alert) => <p key={alert.title}>{alert.title}</p>) : "Aucune alerte importante."}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-slate-900"><ListChecks className="size-4" /> Activite recente</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          {data.activity.length ? data.activity.map((item) => <p key={item.title}>{item.title}</p>) : "Aucune activite recente."}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-slate-900"><FileText className="size-4" /> Documents recents</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          {data.kpis.documents.recent} document recent dans les donnees actuelles.
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-slate-900"><Lightbulb className="size-4" /> Insights NOVEX</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          {data.insights.length ? data.insights.map((item) => <p key={item.title}>{item.title}</p>) : "Les insights apparaitront lorsque NOVEX disposera de donnees suffisantes."}
        </CardContent>
      </Card>
    </>
  );
}
