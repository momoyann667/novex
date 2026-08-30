"use client";

import { Camera, CheckCircle2, FileUp, Image, RotateCcw, UploadCloud, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { DOCUMENT_CATEGORIES } from "./document-status";

const queue = [
  ["document1.pdf", "65%", "upload"],
  ["document2.xlsx", "100%", "done"],
  ["document3.exe", "Echec", "failed"],
] as const;

export function DocumentUploadView() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Upload documents" description="Depot multiple, categorisation, dossier cible et file d'attente." actions={<Button type="button"><UploadCloud className="size-4" /> Envoyer</Button>} />
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardContent className="p-6">
            <label className="grid min-h-72 cursor-pointer place-items-center rounded-md border-2 border-dashed border-blue-200 bg-blue-50 text-center transition hover:border-blue-500">
              <input className="sr-only" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.jpg,.jpeg,.png,.webp,image/*" />
              <span>
                <UploadCloud className="mx-auto size-12 text-blue-700" />
                <strong className="mt-4 block text-lg">Glisser-deposer ou choisir des fichiers</strong>
                <span className="mt-2 block text-sm text-slate-500">PDF, Office, CSV, TXT, JPG, PNG, WEBP. Taille maximale configuree par l'API.</span>
              </span>
            </label>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Button type="button" variant="outline"><Camera className="size-4" /> Photo</Button>
              <Button type="button" variant="outline"><Image className="size-4" /> Galerie</Button>
              <Button type="button" variant="outline"><FileUp className="size-4" /> Fichier</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-900">Parametres</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <label className="grid gap-1 text-sm font-semibold">Categorie<select className="min-h-10 rounded-md border border-border px-3 font-normal">{DOCUMENT_CATEGORIES.map((item) => <option key={item.value}>{item.label}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Dossier<select className="min-h-10 rounded-md border border-border px-3 font-normal"><option>Finances / Factures</option><option>Administration / PV</option><option>Projets</option><option>Evenements</option></select></label>
            <label className="grid gap-1 text-sm font-semibold">Visibilite<select className="min-h-10 rounded-md border border-border px-3 font-normal"><option>Prive</option><option>Membres</option><option>Workspace</option><option>Partage</option></select></label>
            <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm"><input type="checkbox" /> Document sensible</label>
          </CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader><CardTitle className="text-base text-slate-900">File d'attente</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {queue.map(([name, progress, state], index) => (
            <div className="rounded-md border border-border p-3" key={name}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <strong>{name}</strong>
                {state === "done" ? <CheckCircle2 className="size-5 text-emerald-600" /> : state === "failed" ? <Button type="button" variant="outline"><RotateCcw className="size-4" /> Reessayer</Button> : <span>{index + 1} / 3 fichiers</span>}
              </div>
              {state === "failed" ? <p className="mt-2 flex items-center gap-2 text-sm text-red-600"><XCircle className="size-4" /> Extension interdite</p> : <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-700" style={{ width: progress }} /></div>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
