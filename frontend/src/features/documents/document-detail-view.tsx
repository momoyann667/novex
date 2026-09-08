"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowLeft, Clock3, Download, Eye, FileText, Folder, GitBranch, Lock, RotateCcw, Share2, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { workspacePath } from "@/lib/workspace/routing";
import { archiveDocument, downloadDocument, getDocument, getDocumentActivity, getDocumentVersions, previewDocument, restoreDocument, restoreDocumentVersion, trashDocument } from "./api";
import { DOCUMENT_CATEGORIES, statusTone } from "./document-status";

const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  pending: "A valider",
  active: "Actif",
  approved: "Approuve",
  rejected: "Rejete",
  archived: "Archive",
  trash: "Corbeille",
};

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function categoryLabel(category?: string) {
  return DOCUMENT_CATEGORIES.find((item) => item.value === category)?.label || "Autres";
}

export function DocumentDetailView({ documentId, workspaceSlug }: Readonly<{ documentId: string; workspaceSlug: string }>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<{ url: string; contentType: string } | null>(null);
  const [previewError, setPreviewError] = useState("");
  const documentQuery = useQuery({
    queryKey: ["document", workspaceSlug, documentId],
    queryFn: () => getDocument(workspaceSlug, documentId)
  });
  const versionsQuery = useQuery({
    queryKey: ["document-versions", workspaceSlug, documentId],
    queryFn: () => getDocumentVersions(workspaceSlug, documentId)
  });
  const activityQuery = useQuery({
    queryKey: ["document-activity", workspaceSlug, documentId],
    queryFn: () => getDocumentActivity(workspaceSlug, documentId)
  });

  const document = documentQuery.data;
  const versions = versionsQuery.data || [];

  useEffect(() => {
    let objectUrl = "";
    setPreview(null);
    setPreviewError("");

    if (!document) {
      return undefined;
    }

    previewDocument(workspaceSlug, documentId)
      .then((result) => {
        objectUrl = result.url;
        setPreview(result);
      })
      .catch((error) => {
        setPreviewError(error instanceof Error ? error.message : "Apercu impossible.");
      });

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [document, documentId, workspaceSlug]);

  async function refreshDocument() {
    await queryClient.invalidateQueries({ queryKey: ["document", workspaceSlug, documentId] });
    await queryClient.invalidateQueries({ queryKey: ["document-versions", workspaceSlug, documentId] });
    await queryClient.invalidateQueries({ queryKey: ["document-activity", workspaceSlug, documentId] });
    await queryClient.invalidateQueries({ queryKey: ["documents", workspaceSlug] });
  }

  async function handleDownload() {
    if (document) await downloadDocument(workspaceSlug, documentId, document.original_filename || document.name);
  }

  async function handleArchive() {
    await archiveDocument(workspaceSlug, documentId);
    await refreshDocument();
  }

  async function handleTrash() {
    if (document?.status === "trash") {
      await restoreDocument(workspaceSlug, documentId);
    } else {
      await trashDocument(workspaceSlug, documentId);
    }
    await refreshDocument();
  }

  async function handleRestoreVersion(versionId: number) {
    await restoreDocumentVersion(workspaceSlug, documentId, versionId);
    await refreshDocument();
  }

  return (
    <main className="grid min-h-screen w-full max-w-full gap-4 overflow-x-hidden bg-[#f5f7f8] px-3 pb-32 pt-4 text-slate-950 md:rounded-[28px] md:px-6">
      <button className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md bg-white px-3 text-sm font-black text-slate-700 shadow-sm" type="button" onClick={() => router.back()}>
        <ArrowLeft className="size-4" />
        Retour
      </button>
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-blue-700">{document?.folder_name || "Racine Documents"}</p>
          <h1 className="mt-2 break-words text-2xl font-black tracking-normal text-slate-950">{document?.name || "Document"}</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">Document {documentId} - version {document?.current_version || 0}</p>
        </div>
        <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <Button className="min-w-0 min-h-12 rounded-xl bg-blue-700 text-sm text-white hover:bg-blue-800" type="button" onClick={handleDownload} disabled={!document}>
            <Download className="size-4 shrink-0" />
            <span className="truncate">Telecharger</span>
          </Button>
          <Button className="min-w-0 min-h-12 rounded-xl text-sm" type="button" variant="outline">
            <Share2 className="size-4 shrink-0" />
            <span className="truncate">Partager</span>
          </Button>
        </div>
      </section>
      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="min-w-0 overflow-hidden rounded-2xl border-slate-200 shadow-sm">
          <CardHeader className="p-4"><CardTitle className="flex items-center gap-2 text-base text-slate-900"><Eye className="size-4" /> Apercu securise</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid min-h-[430px] w-full max-w-full place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-slate-50 text-center md:min-h-[520px]">
              {preview?.contentType.startsWith("image/") ? (
                <img alt={document?.name || "Document"} className="max-h-[420px] w-full max-w-full rounded-md object-contain md:max-h-[520px]" src={preview.url} />
              ) : preview?.contentType.includes("pdf") || preview?.contentType.startsWith("text/") ? (
                <iframe className="block h-[430px] w-full max-w-full overflow-hidden rounded-md border-0 bg-white md:h-[520px]" src={preview.url} title={document?.name || "Apercu document"} />
              ) : (
              <div>
                <FileText className="mx-auto size-14 text-blue-700" />
                <strong className="mt-4 block">{previewError || "Apercu PDF / image / TXT"}</strong>
                <p className="mt-2 max-w-md text-sm text-slate-500">{documentQuery.isLoading ? "Chargement du document..." : "Le fichier prive reste accessible uniquement apres controle du workspace, de la visibilite et des permissions."}</p>
              </div>
              )}
            </div>
          </CardContent>
        </Card>
        <div className="grid min-w-0 gap-4">
          <Card className="min-w-0 rounded-2xl border-slate-200 shadow-sm">
            <CardHeader><CardTitle className="text-base text-slate-900">Metadonnees</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {[
                ["Type", document?.file_type.toUpperCase() || "-"],
                ["Taille", formatBytes(document?.size || 0)],
                ["Auteur", document?.uploaded_by ? `#${document.uploaded_by}` : "NOVEX"],
                ["Date", formatDate(document?.updated_at)],
                ["Dossier", document?.folder_name || "Racine Documents"],
                ["Statut", document ? statusLabels[document.status] : "-"],
                ["Visibilite", document?.visibility || "-"],
              ].map(([label, value]) => <div className="flex min-w-0 justify-between gap-4" key={label}><span className="text-slate-500">{label}</span><strong className="min-w-0 break-words text-right">{value}</strong></div>)}
              {document?.sensitivity === "sensitive" ? <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800"><Lock className="size-4" /> Document sensible</div> : null}
            </CardContent>
          </Card>
          <Card className="min-w-0 rounded-2xl border-slate-200 shadow-sm">
            <CardHeader><CardTitle className="text-base text-slate-900">Relations</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {document?.project ? <Link className="min-w-0 break-words rounded-md border border-border p-3 hover:bg-slate-50" href={workspacePath(workspaceSlug, `projects/${document.project}`)}>Projet associe: {document.project_name || document.project}</Link> : null}
              {document?.event ? <Link className="min-w-0 break-words rounded-md border border-border p-3 hover:bg-slate-50" href={workspacePath(workspaceSlug, `events/${document.event}`)}>Evenement associe: {document.event_name || document.event}</Link> : null}
              {document?.financial_transaction ? <Link className="min-w-0 break-words rounded-md border border-border p-3 hover:bg-slate-50" href={workspacePath(workspaceSlug, "finance")}>Transaction associee: #{document.financial_transaction}</Link> : null}
              {document?.member ? <Link className="min-w-0 break-words rounded-md border border-border p-3 hover:bg-slate-50" href={workspacePath(workspaceSlug, `members/${document.member}`)}>Membre associe: {document.member_name || document.member}</Link> : null}
              {!document?.project && !document?.event && !document?.financial_transaction && !document?.member ? <div className="rounded-md border border-border p-3 text-slate-500">Aucune relation associee.</div> : null}
            </CardContent>
          </Card>
        </div>
      </section>
      <section className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Card className="min-w-0 rounded-2xl border-slate-200 shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><GitBranch className="size-4" /> Versions</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {versions.map((version) => (
              <div className="grid min-w-0 gap-3 rounded-md border border-border p-3 text-sm md:grid-cols-[80px_1fr_120px_100px] md:items-center" key={version.id}>
                <strong>Version {version.version_number}</strong><span>{version.change_note || "Version document"}<span className="block text-xs text-slate-500">#{version.uploaded_by || "NOVEX"} - {formatDate(version.created_at)}</span></span><span>{formatBytes(version.size)}</span><Button type="button" variant="outline" onClick={() => handleRestoreVersion(version.id)}><RotateCcw className="size-4" /> Restaurer</Button>
              </div>
            ))}
            {!versions.length ? <div className="rounded-md border border-border p-3 text-sm text-slate-500">Aucune version disponible.</div> : null}
          </CardContent>
        </Card>
        <Card className="min-w-0 rounded-2xl border-slate-200 shadow-sm">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><Clock3 className="size-4" /> Historique</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {activityQuery.data?.map((item) => <div className="rounded-md border border-border p-3" key={item.id}>{item.action}<span className="block text-xs text-slate-500">{formatDate(item.created_at)}</span></div>)}
            {!activityQuery.data?.length ? <div className="rounded-md border border-border p-3 text-slate-500">Aucune activite.</div> : null}
          </CardContent>
        </Card>
      </section>
      <section className="flex flex-wrap gap-2 pb-2">
        <Button type="button" variant="outline"><Folder className="size-4" /> Deplacer</Button>
        <Button type="button" variant="outline"><ShieldCheck className="size-4" /> Approuver</Button>
        <Button type="button" variant="outline" onClick={handleArchive}><Archive className="size-4" /> Archiver</Button>
        <Button type="button" variant="outline" onClick={handleTrash}><Trash2 className="size-4" /> {document?.status === "trash" ? "Restaurer" : "Corbeille"}</Button>
      </section>
    </main>
  );
}
