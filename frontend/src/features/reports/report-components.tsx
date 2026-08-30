import Link from "next/link";
import { ArrowDown, ArrowUp, Download, Minus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TrendIndicator({ direction, value }: Readonly<{ direction: "up" | "down" | "flat"; value: string }>) {
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;
  const tone = direction === "up" ? "text-emerald-700" : direction === "down" ? "text-red-700" : "text-slate-500";
  return <span className={`inline-flex items-center gap-1 text-xs font-semibold ${tone}`}><Icon className="size-3" /> {value}</span>;
}

export function ComparisonBadge({ value }: Readonly<{ value: string }>) {
  return <span className="rounded-md border border-border bg-slate-50 px-2 py-1 text-xs text-slate-600">vs periode precedente {value}</span>;
}

export function KpiCard({ value, label, trend, direction = "flat" }: Readonly<{ value: string; label: string; trend?: string; direction?: "up" | "down" | "flat" }>) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <p className="mt-1 text-sm text-slate-500">{label}</p>
        {trend ? <div className="mt-3"><TrendIndicator direction={direction} value={trend} /></div> : null}
      </CardContent>
    </Card>
  );
}

export function PeriodFilter() {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {["Aujourd'hui", "Cette semaine", "Ce mois", "Trimestre", "Cette annee", "Annee precedente", "Personnalise"].map((period, index) => (
        <button className={`min-h-9 shrink-0 rounded-md px-3 text-sm font-semibold ${index === 2 ? "bg-blue-700 text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`} key={period} type="button">
          {period}
        </button>
      ))}
    </div>
  );
}

export function ReportHeader({ title, description, workspaceSlug }: Readonly<{ title: string; description: string; workspaceSlug: string }>) {
  return (
    <div className="grid gap-4 rounded-card border border-border bg-white p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div>
        <h1 className="text-2xl font-bold tracking-normal">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
        <p className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500"><RefreshCw className="size-3" /> Derniere mise a jour : Aujourd'hui a 09:42</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link href={`/app/${workspaceSlug}/reports/annual`}>Rapport annuel</Link></Button>
        <ExportButton />
      </div>
    </div>
  );
}

export function ExportButton() {
  return <Button type="button"><Download className="size-4" /> Export</Button>;
}

export function MetricChart({ title, values }: Readonly<{ title: string; values: readonly number[] }>) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base text-slate-900">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="flex h-56 items-end gap-2" aria-label={title}>
          {values.map((height, index) => <div className="grid flex-1 content-end gap-2" key={`${title}-${height}-${index}`}><div className="rounded-t bg-blue-700" style={{ height: `${height}%` }} /><span className="text-center text-xs text-slate-500">{index + 1}</span></div>)}
        </div>
      </CardContent>
    </Card>
  );
}

export function AnalyticsTable({ title, rows }: Readonly<{ title: string; rows: readonly (readonly string[])[] }>) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base text-slate-900">{title}</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <tbody>{rows.map((row) => <tr className="border-b border-border last:border-0" key={row.join("-")}>{row.map((cell) => <td className="py-3 pr-4" key={cell}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export function EmptyAnalyticsState() {
  return <div className="rounded-md border border-dashed border-border bg-slate-50 p-8 text-center"><strong>Aucune donnee pour cette periode.</strong><p className="mt-1 text-sm text-slate-500">Commencer a enregistrer une activite.</p></div>;
}
