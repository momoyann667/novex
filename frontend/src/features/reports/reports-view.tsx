import Link from "next/link";
import { AlertTriangle, BarChart3, CalendarDays, CreditCard, FileText, FolderKanban, Landmark, LineChart, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsTable, KpiCard, MetricChart, PeriodFilter, ReportHeader } from "./report-components";

const reportTabs = [
  ["Vue d'ensemble", "reports", BarChart3],
  ["Finances", "reports/finance", Wallet],
  ["Membres", "reports/members", Users],
  ["Cotisations", "reports/contributions", CreditCard],
  ["Projets", "reports/projects", FolderKanban],
  ["Evenements", "reports/events", CalendarDays],
  ["Performance", "reports/performance", LineChart],
  ["Annuel", "reports/annual", FileText],
] as const;

export function ReportsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  return (
    <div className="grid gap-6">
      <ReportHeader title="Rapports & Analytics" description="Pilotage data-driven consolidant finance, membres, cotisations, projets, evenements et documents." workspaceSlug={workspaceSlug} />
      <PeriodFilter />
      <section className="flex gap-2 overflow-x-auto border-b border-border pb-2">
        {reportTabs.map(([label, path, Icon]) => <Link className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100" href={`/app/${workspaceSlug}/${path}`} key={path}><Icon className="size-4" /> {label}</Link>)}
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard value="4 250 000 FCFA" label="Recettes" trend="+18.4%" direction="up" />
        <KpiCard value="2 700 000 FCFA" label="Depenses" trend="+7.2%" direction="up" />
        <KpiCard value="80%" label="Taux de recouvrement" trend="+12.8%" direction="up" />
        <KpiCard value="126" label="Membres actifs" trend="+4" direction="up" />
        <KpiCard value="8 500 000 FCFA" label="Budget total" />
        <KpiCard value="36.7%" label="Budget consomme" />
        <KpiCard value="12" label="Projets actifs" />
        <KpiCard value="7" label="Evenements a venir" />
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <MetricChart title="Cash flow mensuel" values={[42, 58, 46, 72, 64, 88, 75, 92, 81, 76, 96, 84]} />
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><AlertTriangle className="size-4" /> Alertes</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {["Taux de recouvrement sous objectif", "Budget gala a 85%", "2 projets en retard", "Participation evenementielle a surveiller"].map((item) => <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800" key={item}>{item}</div>)}
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <AnalyticsTable title="Budget par categorie" rows={[["Categorie", "Budget", "Depense", "Restant", "Utilisation"], ["Communication", "500 000", "350 000", "150 000", "70%"], ["Transport", "1 000 000", "610 000", "390 000", "61%"], ["Evenements", "2 000 000", "1 200 000", "800 000", "60%"]]} />
        <AnalyticsTable title="Rapports enregistres" rows={[["Nom", "Type", "Partage", "Derniere execution"], ["Bilan mensuel", "Finance", "Tresorier", "30 Aout"], ["Suivi cotisations", "Cotisations", "Bureau", "29 Aout"], ["Rapport projets", "Projets", "Responsables", "28 Aout"]]} />
      </section>
      <section className="grid gap-4 md:grid-cols-4">
        {["Sante financiere 82%", "Sante membres 74%", "Sante projets 81%", "Engagement 76%"].map((item) => <Card key={item}><CardContent className="p-5"><Landmark className="size-5 text-blue-700" /><strong className="mt-3 block">{item}</strong><div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 w-4/5 rounded-full bg-blue-700" /></div></CardContent></Card>)}
      </section>
    </div>
  );
}

export function ReportSectionView({ workspaceSlug, kind }: Readonly<{ workspaceSlug: string; kind: string }>) {
  const title = kind === "finance" ? "Rapport finances" : kind === "contributions" ? "Rapport cotisations" : kind === "members" ? "Rapport membres" : kind === "projects" ? "Rapport projets" : kind === "events" ? "Rapport evenements" : kind === "performance" ? "Performance associative" : "Rapport annuel";
  return (
    <div className="grid gap-6">
      <ReportHeader title={title} description="KPI, tendances, graphiques, tableaux accessibles et export." workspaceSlug={workspaceSlug} />
      <PeriodFilter />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard value="10 000 000 FCFA" label="Indicateur principal" trend="+12.4%" direction="up" />
        <KpiCard value="6 000 000 FCFA" label="Indicateur secondaire" trend="+7.2%" direction="up" />
        <KpiCard value="4 000 000 FCFA" label="Resultat" trend="+18.4%" direction="up" />
        <KpiCard value="80%" label="Taux" trend="+5.1%" direction="up" />
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <MetricChart title={`${title} - evolution`} values={[34, 52, 48, 69, 76, 64, 88, 72, 91, 79, 86, 94]} />
        <AnalyticsTable title={`${title} - details`} rows={[["Dimension", "Valeur", "Variation"], ["Periode actuelle", "10 000 000", "+12.4%"], ["Periode precedente", "8 900 000", "-"], ["Ecart", "1 100 000", "Favorable"]]} />
      </section>
    </div>
  );
}
