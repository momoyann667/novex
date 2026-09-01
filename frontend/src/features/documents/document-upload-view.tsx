"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, FileUp, Image, RotateCcw, UploadCloud, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { listFolders, uploadDocument } from "./api";
import { DOCUMENT_CATEGORIES } from "./document-status";

type QueueItem = {
  id: string;
  file: File;
  progress: number;
  state: "ready" | "upload" | "done" | "failed";
  error?: string;
};

const visibilityOptions = [
  ["private", "Prive"],
  ["members", "Membres"],
  ["workspace", "Workspace"],
  ["shared", "Partage"],
] as const;

export function DocumentUploadView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [category, setCategory] = useState("administrative");
  const [folder, setFolder] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [sensitive, setSensitive] = useState(false);

  const foldersQuery = useQuery({
    queryKey: ["document-folders", workspaceSlug],
    queryFn: () => listFolders(workspaceSlug)
  });

  const mutation = useMutation({
    mutationFn: async (items: QueueItem[]) => {
      for (const item of items) {
        setQueue((current) => current.map((entry) => (entry.id === item.id ? { ...entry, state: "upload", progress: 45, error: undefined } : entry)));
        try {
          await uploadDocument(workspaceSlug, {
            file: item.file,
            category,
            folder,
            visibility,
            sensitivity: sensitive ? "sensitive" : "normal"
          });
          setQueue((current) => current.map((entry) => (entry.id === item.id ? { ...entry, state: "done", progress: 100 } : entry)));
        } catch (error) {
          setQueue((current) =>
            current.map((entry) => (entry.id === item.id ? { ...entry, state: "failed", progress: 0, error: error instanceof Error ? error.message : "Upload impossible" } : entry))
          );
        }
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents", workspaceSlug] });
      await queryClient.invalidateQueries({ queryKey: ["document-analytics", workspaceSlug] });
    }
  });

  const pendingItems = useMemo(() => queue.filter((item) => item.state === "ready" || item.state === "failed"), [queue]);

  function addFiles(files: FileList | File[]) {
    const nextItems = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      progress: 0,
      state: "ready" as const
    }));
    setQueue((current) => [...current, ...nextItems]);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      addFiles(event.target.files);
    }
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  }

  function sendQueue() {
    if (pendingItems.length) {
      mutation.mutate(pendingItems);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Upload documents"
        description="Depot multiple, categorisation, dossier cible et file d'attente."
        actions={<Button type="button" disabled={!pendingItems.length || mutation.isPending} onClick={sendQueue}><UploadCloud className="size-4" /> Envoyer</Button>}
      />
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardContent className="p-6">
            <label
              className="grid min-h-72 cursor-pointer place-items-center rounded-md border-2 border-dashed border-blue-200 bg-blue-50 text-center transition hover:border-blue-500"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <input ref={inputRef} className="sr-only" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.jpg,.jpeg,.png,.webp,image/*" onChange={handleFileChange} />
              <span>
                <UploadCloud className="mx-auto size-12 text-blue-700" />
                <strong className="mt-4 block text-lg">Glisser-deposer ou choisir des fichiers</strong>
                <span className="mt-2 block text-sm text-slate-500">PDF, Office, CSV, TXT, JPG, PNG, WEBP. Taille maximale configuree par l'API.</span>
              </span>
            </label>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}><Camera className="size-4" /> Photo</Button>
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}><Image className="size-4" /> Galerie</Button>
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}><FileUp className="size-4" /> Fichier</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base text-slate-900">Parametres</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <label className="grid gap-1 text-sm font-semibold">Categorie<select className="min-h-10 rounded-md border border-border px-3 font-normal" value={category} onChange={(event) => setCategory(event.target.value)}>{DOCUMENT_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Dossier<select className="min-h-10 rounded-md border border-border px-3 font-normal" value={folder} onChange={(event) => setFolder(event.target.value)}><option value="">Racine Documents</option>{foldersQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.breadcrumb.map((crumb) => crumb.name).join(" / ")}</option>)}</select></label>
            <label className="grid gap-1 text-sm font-semibold">Visibilite<select className="min-h-10 rounded-md border border-border px-3 font-normal" value={visibility} onChange={(event) => setVisibility(event.target.value)}>{visibilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm"><input type="checkbox" checked={sensitive} onChange={(event) => setSensitive(event.target.checked)} /> Document sensible</label>
          </CardContent>
        </Card>
      </section>
      <Card>
        <CardHeader><CardTitle className="text-base text-slate-900">File d'attente</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {queue.length ? queue.map((item, index) => (
            <div className="rounded-md border border-border p-3" key={item.id}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <strong>{item.file.name}</strong>
                {item.state === "done" ? <CheckCircle2 className="size-5 text-emerald-600" /> : item.state === "failed" ? <Button type="button" variant="outline" onClick={() => mutation.mutate([item])}><RotateCcw className="size-4" /> Reessayer</Button> : <span>{index + 1} / {queue.length} fichiers</span>}
              </div>
              {item.state === "failed" ? <p className="mt-2 flex items-center gap-2 text-sm text-red-600"><XCircle className="size-4" /> {item.error || "Upload impossible"}</p> : <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-700" style={{ width: `${item.progress}%` }} /></div>}
            </div>
          )) : <div className="rounded-md border border-border p-3 text-sm text-slate-500">Aucun fichier selectionne.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
