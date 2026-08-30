"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, BarChart3, CheckCircle2, Clock3, Download, Eye, File, FileImage, FileSpreadsheet, FileText, Filter, Folder, Grid2X2, HardDrive, History, List, Lock, Plus, Search, Share2, Star, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUSES, DOCUMENT_VIEWS, statusTone } from "./document-status";

const kpis = [
  ["1 284", "Documents totaux", FileText],
  ["46", "Recents", Clock3],
  ["128", "Partages", Share2],
  ["312", "Archives", Archive],
  ["18", "A valider", CheckCircle2],
  ["76", "Favoris", Star],
  ["2.4 GB", "Espace utilise", HardDrive],
  ["7.6 GB", "Disponible", HardDrive],
] as const;

const categoryStats = [
  ["Administratif", "286", "480 MB", "bg-blue-700"],
  ["Financier", "342", "860 MB", "bg-emerald-600"],
  ["Projets", "208", "420 MB", "bg-indigo-600"],
  ["Evenements", "166", "380 MB", "bg-cyan-600"],
  ["Juridique", "74", "190 MB", "bg-amber-500"],
  ["Membres", "118", "260 MB", "bg-rose-600"],
  ["Rapports", "52", "110 MB", "bg-violet-600"],
  ["Autres", "38", "90 MB", "bg-slate-600"],
] as const;

const folders = ["Administration", "Finances", "Membres", "Cotisations", "Projets", "Evenements", "Rapports", "Juridique", "Communication", "Archives"];

const rows = [
  { id: "doc-2026-001", name: "PV assemblee generale 2026.pdf", type: "PDF", size: "2.8 MB", author: "Awa Kone", date: "30 Aout 2026", status: "A valider", category: "Administratif", icon: FileText, sensitive: false },
  { id: "doc-2026-002", name: "Facture ciment centre communautaire.pdf", type: "PDF", size: "640 KB", author: "Yao Kouame", date: "29 Aout 2026", status: "Actif", category: "Financier", icon: FileText, sensitive: true },
  { id: "doc-2026-003", name: "Budget gala annuel.xlsx", type: "XLSX", size: "1.2 MB", author: "Mariam Traore", date: "28 Aout 2026", status: "Approuve", category: "Evenements", icon: FileSpreadsheet, sensitive: false },
  { id: "doc-2026-004", name: "Affiche formation tresorerie.png", type: "PNG", size: "4.6 MB", author: "Ibrahima Diallo", date: "27 Aout 2026", status: "Actif", category: "Communication", icon: FileImage, sensitive: false },
] as const;

export function DocumentsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const [view, setView] = useState<(typeof DOCUMENT_VIEWS)[number]>("Vue d'ensemble");
  const [visualMode, setVisualMode] = useState<"list" | "grid">("list");

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Documents"
        description="GED associative, dossiers, versions, partages, archives et justificatifs."
        actions={
          <>
            <Button asChild variant="outline"><Link href={`/app/${workspaceSlug}/documents/dashboard`}><BarChart3 className="size-4" /> Analytics</Link></Button>
            <Button asChild><Link href={`/app/${workspaceSlug}/documents/upload`}><Upload className="size-4" /> Upload</Link></Button>
          </>
        }
      />
      <section className="flex gap-2 overflow-x-auto border-b border-border pb-2">
        {DOCUMENT_VIEWS.map((item) => (
          <button className={`min-h-10 shrink-0 rounded-md px-3 text-sm font-semibold ${view === item ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-100"}`} key={item} onClick={() => setView(item)} type="button">
            {item}
          </button>
        ))}
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        {kpis.map(([value, label, Icon]) => (
          <Card key={label}><CardContent className="p-5"><Icon className="size-5 text-blue-700" /><div className="mt-3 text-2xl font-bold tabular-nums">{value}</div><p className="text-sm text-slate-500">{label}</p></CardContent></Card>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><Folder className="size-4" /> Dossiers</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {folders.map((folder) => (
              <button className="flex min-h-10 items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-slate-100" key={folder} type="button">
                <Folder className="size-4 text-blue-700" />
                <span className="font-medium">{folder}</span>
              </button>
            ))}
          </CardContent>
        </Card>
        <section className="grid gap-4">
          <div className="rounded-card border border-border bg-white p-4">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_150px_150px_150px_120px]">
              <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-slate-500">
                <Search className="size-4" />
                <input className="w-full bg-transparent outline-none" placeholder="Rechercher nom, description, type, auteur, dossier..." />
              </label>
              <select className="min-h-10 rounded-md border border-border px-3 text-sm"><option>Categorie</option>{DOCUMENT_CATEGORIES.map((category) => <option key={category.value}>{category.label}</option>)}</select>
              <select className="min-h-10 rounded-md border border-border px-3 text-sm"><option>Statut</option>{DOCUMENT_STATUSES.map((item) => <option key={item.value}>{item.label}</option>)}</select>
              <select className="min-h-10 rounded-md border border-border px-3 text-sm"><option>Visibilite</option><option>Prive</option><option>Membres</option><option>Workspace</option><option>Partage</option></select>
              <Button type="button" variant="outline"><Filter className="size-4" /> Filtres</Button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-card border border-border bg-white p-3">
            <div className="flex items-center gap-2 text-sm text-slate-500"><span>Documents / Finances / 2026 / Factures</span></div>
            <Button type="button" variant="outline" onClick={() => setVisualMode(visualMode === "list" ? "grid" : "list")}>{visualMode === "list" ? <Grid2X2 className="size-4" /> : <List className="size-4" />} Vue</Button>
          </div>
          {visualMode === "list" ? (
            <div className="rounded-card border border-border bg-white p-4">
              <div className="hidden grid-cols-[minmax(240px,1fr)_90px_100px_130px_130px_120px_170px] gap-3 border-b border-border px-3 py-3 text-xs font-semibold uppercase text-slate-500 lg:grid">
                <span>Document</span><span>Type</span><span>Taille</span><span>Auteur</span><span>Modifie</span><span>Statut</span><span>Actions</span>
              </div>
              <div className="grid gap-2 pt-3">
                {rows.map(({ id, name, type, size, author, date, status, category, icon: Icon, sensitive }) => (
                  <Link className="grid gap-3 rounded-md border border-border p-3 text-sm hover:border-blue-200 hover:bg-slate-50 lg:grid-cols-[minmax(240px,1fr)_90px_100px_130px_130px_120px_170px]" href={`/app/${workspaceSlug}/documents/${id}`} key={id}>
                    <span className="flex items-center gap-3"><Icon className="size-5 text-blue-700" /><span><strong>{name}</strong><span className="block text-xs text-slate-500">{category} {sensitive ? "- sensible" : ""}</span></span></span>
                    <span>{type}</span><span>{size}</span><span>{author}</span><span>{date}</span>
                    <span><span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusTone(status)}`}>{status}</span></span>
                    <span className="flex gap-1"><Eye className="size-4" /><Download className="size-4" /><Share2 className="size-4" /><Archive className="size-4" /><Trash2 className="size-4" /></span>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {rows.map(({ id, name, type, size, date, icon: Icon, sensitive }) => (
                <Link href={`/app/${workspaceSlug}/documents/${id}`} key={id}>
                  <Card className="h-full transition hover:border-blue-200 hover:shadow-md">
                    <CardContent className="p-5"><Icon className="size-8 text-blue-700" /><strong className="mt-4 block break-words">{name}</strong><p className="mt-2 text-sm text-slate-500">{type} - {size} - {date}</p>{sensitive ? <span className="mt-3 inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700"><Lock className="size-3" /> Sensible</span> : null}</CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-900">Stockage par categorie</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {categoryStats.map(([label, count, size, color]) => (
              <div className="grid gap-2" key={label}>
                <div className="flex items-center justify-between text-sm"><strong>{label}</strong><span className="text-slate-500">{count} docs - {size}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${color}`} style={{ width: `${Math.min(Number(count) / 4, 100)}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><History className="size-4" /> Activite documentaire</CardTitle></CardHeader>
          <CardContent><div className="flex h-44 items-end gap-2">{[24, 38, 52, 44, 68, 72, 59, 84, 62, 76, 91, 70].map((height, index) => <div className="flex-1 rounded-t bg-blue-700" key={`${height}-${index}`} style={{ height: `${height}%` }} />)}</div></CardContent>
        </Card>
      </section>
    </div>
  );
}
