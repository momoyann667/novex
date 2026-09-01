"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, BarChart3, CheckCircle2, Clock3, Download, Eye, File, FileImage, FileSpreadsheet, FileText, Filter, Folder, Grid2X2, HardDrive, History, List, Lock, Plus, Search, Share2, Star, Trash2, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { archiveDocument, downloadDocument, exportDocuments, getDocumentAnalytics, listDocuments, listFolders, restoreDocument, trashDocument } from "./api";
import type { DocumentCategory, DocumentResource, DocumentStatus } from "./api";
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUSES, DOCUMENT_VIEWS, statusTone } from "./document-status";

const categoryColors: Record<DocumentCategory, string> = {
  administrative: "bg-blue-700",
  financial: "bg-emerald-600",
  members: "bg-rose-600",
  contributions: "bg-sky-600",
  project: "bg-indigo-600",
  event: "bg-cyan-600",
  legal: "bg-amber-500",
  report: "bg-violet-600",
  communication: "bg-teal-600",
  other: "bg-slate-600",
};

const statusLabels: Record<DocumentStatus, string> = {
  draft: "Brouillon",
  pending: "A valider",
  active: "Actif",
  approved: "Approuve",
  rejected: "Rejete",
  archived: "Archive",
  trash: "Corbeille",
};

function categoryLabel(category: string) {
  return DOCUMENT_CATEGORIES.find((item) => item.value === category)?.label || "Autres";
}

function fileIcon(type: string): LucideIcon {
  if (["jpg", "jpeg", "png", "webp"].includes(type.toLowerCase())) return FileImage;
  if (["xls", "xlsx", "csv"].includes(type.toLowerCase())) return FileSpreadsheet;
  if (["pdf", "doc", "docx", "txt"].includes(type.toLowerCase())) return FileText;
  return File;
}

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function viewToApi(view: (typeof DOCUMENT_VIEWS)[number]) {
  if (view === "Archives") return "archives";
  if (view === "Corbeille") return "trash";
  if (view === "Favoris") return "favorites";
  return undefined;
}

export function DocumentsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const [view, setView] = useState<(typeof DOCUMENT_VIEWS)[number]>("Vue d'ensemble");
  const [visualMode, setVisualMode] = useState<"list" | "grid">("list");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [visibility, setVisibility] = useState("");
  const [folder, setFolder] = useState("");
  const queryClient = useQueryClient();

  const analyticsQuery = useQuery({
    queryKey: ["document-analytics", workspaceSlug],
    queryFn: () => getDocumentAnalytics(workspaceSlug)
  });
  const foldersQuery = useQuery({
    queryKey: ["document-folders", workspaceSlug],
    queryFn: () => listFolders(workspaceSlug)
  });
  const documentsQuery = useQuery({
    queryKey: ["documents", workspaceSlug, view, search, category, status, visibility, folder],
    queryFn: () =>
      listDocuments(workspaceSlug, {
        search,
        category,
        status,
        visibility,
        folder,
        view: viewToApi(view)
      })
  });

  const analytics = analyticsQuery.data;
  const documents = documentsQuery.data || [];
  const kpis = [
    [String(analytics?.total_documents ?? 0), "Documents totaux", FileText],
    [String(analytics?.recent_documents ?? 0), "Recents", Clock3],
    [String(analytics?.shared_documents ?? 0), "Partages", Share2],
    [String(analytics?.archived_documents ?? 0), "Archives", Archive],
    [String(analytics?.pending_documents ?? 0), "A valider", CheckCircle2],
    [String(analytics?.favorite_documents ?? 0), "Favoris", Star],
    [formatBytes(analytics?.storage_usage.used ?? 0), "Espace utilise", HardDrive],
    [formatBytes(analytics?.storage_usage.available ?? 0), "Disponible", HardDrive],
  ] as const;

  async function refreshDocuments() {
    await queryClient.invalidateQueries({ queryKey: ["documents", workspaceSlug] });
    await queryClient.invalidateQueries({ queryKey: ["document-analytics", workspaceSlug] });
  }

  async function handleDownload(document: DocumentResource) {
    await downloadDocument(workspaceSlug, String(document.id), document.original_filename || document.name);
  }

  async function handleArchive(document: DocumentResource) {
    await archiveDocument(workspaceSlug, String(document.id));
    await refreshDocuments();
  }

  async function handleTrash(document: DocumentResource) {
    if (document.status === "trash") {
      await restoreDocument(workspaceSlug, String(document.id));
    } else {
      await trashDocument(workspaceSlug, String(document.id));
    }
    await refreshDocuments();
  }

  async function handleExport() {
    await exportDocuments(workspaceSlug);
  }

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
            <button className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-slate-100 ${folder === "" ? "bg-slate-100" : ""}`} type="button" onClick={() => setFolder("")}>
              <Folder className="size-4 text-blue-700" />
              <span className="font-medium">Racine Documents</span>
            </button>
            {foldersQuery.data?.map((item) => (
              <button className={`flex min-h-10 items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-slate-100 ${folder === String(item.id) ? "bg-slate-100" : ""}`} key={item.id} type="button" onClick={() => setFolder(String(item.id))}>
                <Folder className="size-4 text-blue-700" />
                <span className="font-medium">{item.name}</span>
              </button>
            ))}
          </CardContent>
        </Card>
        <section className="grid gap-4">
          <div className="rounded-card border border-border bg-white p-4">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_150px_150px_150px_120px]">
              <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm text-slate-500">
                <Search className="size-4" />
                <input className="w-full bg-transparent outline-none" placeholder="Rechercher nom, description, type, auteur, dossier..." value={search} onChange={(event) => setSearch(event.target.value)} />
              </label>
              <select className="min-h-10 rounded-md border border-border px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Categorie</option>{DOCUMENT_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              <select className="min-h-10 rounded-md border border-border px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Statut</option>{DOCUMENT_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              <select className="min-h-10 rounded-md border border-border px-3 text-sm" value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="">Visibilite</option><option value="private">Prive</option><option value="members">Membres</option><option value="workspace">Workspace</option><option value="shared">Partage</option></select>
              <Button type="button" variant="outline" onClick={() => { setSearch(""); setCategory(""); setStatus(""); setVisibility(""); setFolder(""); }}><Filter className="size-4" /> Filtres</Button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-card border border-border bg-white p-3">
            <div className="flex items-center gap-2 text-sm text-slate-500"><span>Documents{folder ? ` / ${foldersQuery.data?.find((item) => String(item.id) === folder)?.breadcrumb.map((crumb) => crumb.name).join(" / ") || ""}` : ""}</span></div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" /> Export</Button>
              <Button type="button" variant="outline" onClick={() => setVisualMode(visualMode === "list" ? "grid" : "list")}>{visualMode === "list" ? <Grid2X2 className="size-4" /> : <List className="size-4" />} Vue</Button>
            </div>
          </div>
          {visualMode === "list" ? (
            <div className="rounded-card border border-border bg-white p-4">
              <div className="hidden grid-cols-[minmax(240px,1fr)_90px_100px_130px_130px_120px_170px] gap-3 border-b border-border px-3 py-3 text-xs font-semibold uppercase text-slate-500 lg:grid">
                <span>Document</span><span>Type</span><span>Taille</span><span>Auteur</span><span>Modifie</span><span>Statut</span><span>Actions</span>
              </div>
              <div className="grid gap-2 pt-3">
                {documents.map((document) => {
                  const Icon = fileIcon(document.file_type);
                  return (
                  <Link className="grid gap-3 rounded-md border border-border p-3 text-sm hover:border-blue-200 hover:bg-slate-50 lg:grid-cols-[minmax(240px,1fr)_90px_100px_130px_130px_120px_170px]" href={`/app/${workspaceSlug}/documents/${document.id}`} key={document.id}>
                    <span className="flex items-center gap-3"><Icon className="size-5 text-blue-700" /><span><strong>{document.name}</strong><span className="block text-xs text-slate-500">{categoryLabel(document.category)} {document.sensitivity === "sensitive" ? "- sensible" : ""}</span></span></span>
                    <span>{document.file_type.toUpperCase()}</span><span>{formatBytes(document.size)}</span><span>{document.uploaded_by ? `#${document.uploaded_by}` : "NOVEX"}</span><span>{formatDate(document.updated_at)}</span>
                    <span><span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusTone(document.status)}`}>{statusLabels[document.status]}</span></span>
                    <span className="flex gap-1" onClick={(event) => event.preventDefault()}><Eye className="size-4" /><button type="button" onClick={() => handleDownload(document)}><Download className="size-4" /></button><Share2 className="size-4" /><button type="button" onClick={() => handleArchive(document)}><Archive className="size-4" /></button><button type="button" onClick={() => handleTrash(document)}><Trash2 className="size-4" /></button></span>
                  </Link>
                  );
                })}
                {!documents.length ? <div className="rounded-md border border-border p-4 text-sm text-slate-500">{documentsQuery.isLoading ? "Chargement des documents..." : "Aucun document trouve."}</div> : null}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {documents.map((document) => {
                const Icon = fileIcon(document.file_type);
                return (
                <Link href={`/app/${workspaceSlug}/documents/${document.id}`} key={document.id}>
                  <Card className="h-full transition hover:border-blue-200 hover:shadow-md">
                    <CardContent className="p-5"><Icon className="size-8 text-blue-700" /><strong className="mt-4 block break-words">{document.name}</strong><p className="mt-2 text-sm text-slate-500">{document.file_type.toUpperCase()} - {formatBytes(document.size)} - {formatDate(document.updated_at)}</p>{document.sensitivity === "sensitive" ? <span className="mt-3 inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700"><Lock className="size-3" /> Sensible</span> : null}</CardContent>
                  </Card>
                </Link>
                );
              })}
              {!documents.length ? <div className="rounded-md border border-border bg-white p-4 text-sm text-slate-500">{documentsQuery.isLoading ? "Chargement des documents..." : "Aucun document trouve."}</div> : null}
            </div>
          )}
        </section>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-900">Stockage par categorie</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {analytics?.documents_by_category.map(({ category: categoryValue, count, size }) => (
              <div className="grid gap-2" key={categoryValue}>
                <div className="flex items-center justify-between text-sm"><strong>{categoryLabel(categoryValue)}</strong><span className="text-slate-500">{count} docs - {formatBytes(size || 0)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${categoryColors[categoryValue]}`} style={{ width: `${Math.min(count * 8, 100)}%` }} /></div>
              </div>
            )) || <div className="text-sm text-slate-500">Aucune categorie.</div>}
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
