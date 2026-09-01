"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Archive, CheckCircle2, FileText, HardDrive, Lock, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { getDocumentAnalytics } from "./api";
import { DOCUMENT_CATEGORIES } from "./document-status";

const alerts = [["80%", "Surveillance active"], ["90%", "Alerte tresorerie"], ["95%", "Blocage futur configurable"]] as const;

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function categoryLabel(category: string) {
  return DOCUMENT_CATEGORIES.find((item) => item.value === category)?.label || "Autres";
}

export function DocumentDashboardView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const analyticsQuery = useQuery({
    queryKey: ["document-analytics", workspaceSlug],
    queryFn: () => getDocumentAnalytics(workspaceSlug)
  });
  const analytics = analyticsQuery.data;
  const dashboardKpis = [
    [String(analytics?.total_documents ?? 0), "Documents", FileText],
    [formatBytes(analytics?.storage_usage.used ?? 0), "Utilise", HardDrive],
    [`${analytics?.storage_usage.percentage ?? 0}%`, "Occupation", HardDrive],
    [String(analytics?.pending_documents ?? 0), "A valider", CheckCircle2],
    [String(analytics?.sensitive_documents ?? 0), "Sensibles", Lock],
    [String(analytics?.archived_documents ?? 0), "Archives", Archive],
  ] as const;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Dashboard documents"
        description="Stockage, activite, categories, documents sensibles et validations."
        actions={<Button asChild><Link href={`/app/${workspaceSlug}/documents/upload`}><Upload className="size-4" /> Upload</Link></Button>}
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {dashboardKpis.map(([value, label, Icon]) => (
          <Card key={String(label)}><CardContent className="p-5"><Icon className="size-5 text-blue-700" /><div className="mt-3 text-2xl font-bold tabular-nums">{value}</div><p className="text-sm text-slate-500">{label}</p></CardContent></Card>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-900">Activite</CardTitle></CardHeader>
          <CardContent>
            <div className="flex h-64 items-end gap-3">{[22, 36, 48, 58, 43, 64, 71, 59, 82, 74, 92, 80].map((height, index) => <div className="grid flex-1 content-end gap-2" key={`${height}-${index}`}><div className="rounded-t bg-blue-700" style={{ height: `${height * 2}px` }} /><span className="text-center text-xs text-slate-500">{index + 1}</span></div>)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><AlertTriangle className="size-4" /> Alertes stockage</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {alerts.map(([threshold, label]) => <div className="rounded-md border border-border p-3" key={threshold}><strong>{threshold}</strong><p className="text-sm text-slate-500">{label}</p></div>)}
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-900">Consommation par categorie</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {analytics?.documents_by_category.map(({ category, count, size }) => (
              <div className="grid gap-2" key={category}>
                <div className="flex justify-between text-sm"><strong>{categoryLabel(category)}</strong><span>{formatBytes(size || 0)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-700" style={{ width: `${Math.min(count * 10, 100)}%` }} /></div>
              </div>
            )) || <div className="text-sm text-slate-500">{analyticsQuery.isLoading ? "Chargement..." : "Aucune donnee de stockage."}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-900">Documents a valider</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {analytics?.recent_items.filter((item) => item.status === "pending").map((item) => <div className="flex items-center justify-between rounded-md border border-border p-3" key={item.id}><span>{item.name}</span><Button asChild type="button" variant="outline"><Link href={`/app/${workspaceSlug}/documents/${item.id}`}><CheckCircle2 className="size-4" /> Valider</Link></Button></div>)}
            {!analytics?.recent_items.filter((item) => item.status === "pending").length ? <div className="rounded-md border border-border p-3 text-slate-500">Aucun document en attente.</div> : null}
            <Button type="button" variant="outline"><Plus className="size-4" /> Ajouter une demande</Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
