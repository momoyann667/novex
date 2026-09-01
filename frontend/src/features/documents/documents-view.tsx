"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, Folder, FolderArchive, FolderLock, MoreVertical, Plus, Search, SlidersHorizontal, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createFolder, getDocumentAnalytics, listDocuments, listFolders } from "./api";
import type { DocumentResource } from "./api";

const chips = [
  { label: "Tous", category: "", status: "" },
  { label: "Urgent", category: "", status: "pending" },
  { label: "Legal", category: "legal", status: "" },
  { label: "Finance", category: "financial", status: "" },
  { label: "Reunions", category: "administrative", status: "" },
] as const;

function fileIcon(type: string): LucideIcon {
  if (["xls", "xlsx", "csv"].includes(type.toLowerCase())) return FileSpreadsheet;
  return FileText;
}

function folderIcon(index: number) {
  return [Folder, FolderArchive, FolderLock][index % 3];
}

function sourceLabel(document: DocumentResource) {
  if (document.folder_name) return document.folder_name;
  if (document.project_name) return document.project_name;
  if (document.event_name) return document.event_name;
  return "NOVEX";
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(value));
}

export function DocumentsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const [search, setSearch] = useState("");
  const [activeChip, setActiveChip] = useState<(typeof chips)[number]>(chips[0]);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [folderName, setFolderName] = useState("");
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
    queryKey: ["documents", workspaceSlug, search, activeChip.label],
    queryFn: () =>
      listDocuments(workspaceSlug, {
        search,
        category: activeChip.category,
        status: activeChip.status
      })
  });

  const folders = foldersQuery.data || [];
  const documents = documentsQuery.data || [];
  const featured = documents[0];
  const recentDocuments = featured ? documents.slice(1, 6) : documents.slice(0, 6);
  const createFolderMutation = useMutation({
    mutationFn: () => createFolder(workspaceSlug, folderName.trim()),
    onSuccess: async () => {
      setFolderName("");
      setShowFolderForm(false);
      await queryClient.invalidateQueries({ queryKey: ["document-folders", workspaceSlug] });
    }
  });

  function submitFolder() {
    if (folderName.trim().length > 1) {
      createFolderMutation.mutate();
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-4 pb-24 pt-5 text-slate-950">
      <header className="mb-5">
        <h1 className="text-3xl font-black tracking-normal">Documents</h1>
      </header>

      <section className="mb-4">
        <label className="flex min-h-12 items-center gap-2 rounded-xl bg-white px-4 text-sm text-slate-400 shadow-sm ring-1 ring-slate-200">
          <Search className="size-5 shrink-0" />
          <input
            className="min-w-0 flex-1 bg-transparent font-medium outline-none"
            placeholder="Rechercher dans Drive ou Notion..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <SlidersHorizontal className="size-5 shrink-0 text-slate-600" />
        </label>
      </section>

      <section className="mb-7 flex gap-2 overflow-x-auto pb-1">
        {chips.map((chip) => (
          <button
            className={`min-h-9 shrink-0 rounded-full px-4 text-sm font-black shadow-sm ${activeChip.label === chip.label ? "bg-black text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
            key={chip.label}
            type="button"
            onClick={() => setActiveChip(chip)}
          >
            {chip.label}
          </button>
        ))}
      </section>

      <section className="mb-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-black tracking-normal">Dossiers</h2>
          <div className="flex items-center gap-3">
            <button className="text-sm font-black text-blue-700" type="button" onClick={() => setShowFolderForm((current) => !current)}>
              Creer un dossier
            </button>
            <Link className="text-sm font-black text-blue-700" href={`/app/${workspaceSlug}/documents/dashboard`}>
              Voir tout
            </Link>
          </div>
        </div>
        {showFolderForm ? (
          <div className="mb-3 grid gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <input
              className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none"
              placeholder="Nom du dossier"
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
            />
            <button className="min-h-11 rounded-lg bg-black px-4 text-sm font-black text-white disabled:opacity-50" disabled={createFolderMutation.isPending || folderName.trim().length < 2} type="button" onClick={submitFolder}>
              Creer
            </button>
            {createFolderMutation.isError ? <p className="text-xs font-semibold text-red-600">{createFolderMutation.error instanceof Error ? createFolderMutation.error.message : "Impossible de creer le dossier."}</p> : null}
          </div>
        ) : null}
        <div className="flex gap-3 overflow-x-auto pb-1">
          {folders.slice(0, 6).map((folder, index) => {
            const Icon = folderIcon(index);
            return (
              <button className="grid h-32 w-32 shrink-0 content-between rounded-lg bg-white p-4 text-left shadow-sm ring-1 ring-slate-200" key={folder.id} type="button">
                <span className="grid size-9 place-items-center rounded-md bg-slate-100">
                  <Icon className="size-5 text-black" />
                </span>
                <span>
                  <strong className="block truncate text-sm">{folder.name}</strong>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">{analyticsQuery.data?.documents_by_category.find((item) => item.category === "administrative")?.count || 0} fichiers</span>
                </span>
              </button>
            );
          })}
          {!folders.length ? <div className="w-full rounded-lg bg-white p-4 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">{foldersQuery.isLoading ? "Chargement des dossiers..." : "Aucun dossier."}</div> : null}
        </div>
        <Link className="mt-4 flex min-h-14 items-center justify-center gap-3 rounded-xl bg-blue-700 px-4 text-sm font-black text-white shadow-lg shadow-blue-700/20" href={`/app/${workspaceSlug}/documents/upload`}>
          <span className="grid size-8 place-items-center rounded-full bg-white/15">
            <Plus className="size-5" />
          </span>
          Ajouter des documents
        </Link>
      </section>

      <section className="mb-7">
        <h2 className="mb-3 text-xl font-black tracking-normal">En evidence</h2>
        {featured ? (
          <Link className="relative block overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200" href={`/app/${workspaceSlug}/documents/${featured.id}`}>
            <div className="grid h-36 place-items-center bg-slate-200">
              <div className="h-28 w-28 rounded-sm bg-white/70 p-3 text-[7px] leading-3 text-slate-400">
                {featured.name}
                <div className="mt-2 h-1 w-20 bg-slate-300" />
                <div className="mt-1 h-1 w-16 bg-slate-300" />
                <div className="mt-1 h-1 w-24 bg-slate-300" />
              </div>
              <span className="absolute right-4 top-4 rounded-md bg-white px-2 py-1 text-xs font-black text-red-600">PDF</span>
            </div>
            <div className="flex items-center justify-between p-4">
              <span className="min-w-0">
                <strong className="block truncate text-sm">{featured.name}</strong>
                <span className="mt-1 block text-xs font-semibold text-slate-500">Modifie il y a 2 jours - {sourceLabel(featured)}</span>
              </span>
              <Star className="size-5 shrink-0 fill-black text-black" />
            </div>
          </Link>
        ) : (
          <div className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">{documentsQuery.isLoading ? "Chargement des documents..." : "Aucun document en evidence."}</div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-black tracking-normal">Recents</h2>
        <div className="grid gap-3">
          {recentDocuments.map((document) => {
            const Icon = fileIcon(document.file_type);
            return (
              <Link className="flex min-h-16 items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200" href={`/app/${workspaceSlug}/documents/${document.id}`} key={document.id}>
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{document.name}</strong>
                  <span className="mt-1 block truncate text-xs font-semibold text-slate-500">Hier, {shortDate(document.updated_at)} - {sourceLabel(document)}</span>
                </span>
                <MoreVertical className="size-5 shrink-0 text-slate-500" />
              </Link>
            );
          })}
          {!recentDocuments.length ? <div className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Aucun document recent.</div> : null}
        </div>
      </section>
    </main>
  );
}
