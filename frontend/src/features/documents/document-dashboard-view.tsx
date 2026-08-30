import Link from "next/link";
import { AlertTriangle, Archive, CheckCircle2, FileText, HardDrive, Lock, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const storage = [["Finances", 36, "860 MB"], ["Projets", 18, "420 MB"], ["Evenements", 16, "380 MB"], ["Administration", 20, "480 MB"], ["Autres", 10, "240 MB"]] as const;
const alerts = [["80%", "Surveillance active"], ["90%", "Alerte tresorerie"], ["95%", "Blocage futur configurable"]] as const;
const dashboardKpis = [
  ["1 284", "Documents", FileText],
  ["2.4 GB", "Utilise", HardDrive],
  ["24%", "Occupation", HardDrive],
  ["18", "A valider", CheckCircle2],
  ["9", "Sensibles", Lock],
  ["312", "Archives", Archive],
] as const;

export function DocumentDashboardView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
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
            {storage.map(([label, value, size]) => (
              <div className="grid gap-2" key={label}>
                <div className="flex justify-between text-sm"><strong>{label}</strong><span>{size}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-700" style={{ width: `${value}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-900">Documents a valider</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {["PV assemblee generale 2026", "Convention bailleur centre communautaire", "Rapport financier T3"].map((item) => <div className="flex items-center justify-between rounded-md border border-border p-3" key={item}><span>{item}</span><Button type="button" variant="outline"><CheckCircle2 className="size-4" /> Valider</Button></div>)}
            <Button type="button" variant="outline"><Plus className="size-4" /> Ajouter une demande</Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
