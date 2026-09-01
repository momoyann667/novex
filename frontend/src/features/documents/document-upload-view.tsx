"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, CheckCircle2, FileUp, Image, RotateCcw, ShieldCheck, UploadCloud, XCircle } from "lucide-react";
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
    <main className="min-h-screen bg-[#f5f7f8] px-4 pb-24 pt-5 text-slate-950">
      <PageHeader
        title="Ajouter un document"
        description="Importez vos fichiers, choisissez leur dossier et leur niveau d'acces."
        actions={
          <>
            <Button asChild className="rounded-xl" type="button" variant="outline">
              <Link href={`/app/${workspaceSlug}/documents`}><ArrowLeft className="size-4" /> Retour</Link>
            </Button>
            <Button className="rounded-xl bg-blue-700 px-5 text-white hover:bg-blue-800" type="button" disabled={!pendingItems.length || mutation.isPending} onClick={sendQueue}><UploadCloud className="size-4" /> Envoyer</Button>
          </>
        }
      />
      <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <label
              className="grid min-h-80 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-blue-200 bg-gradient-to-b from-blue-50 to-white px-5 text-center transition hover:border-blue-500"
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <input ref={inputRef} className="sr-only" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.jpg,.jpeg,.png,.webp,image/*" onChange={handleFileChange} />
              <span>
                <span className="mx-auto grid size-20 place-items-center rounded-full bg-blue-700 text-white shadow-lg shadow-blue-700/20">
                  <UploadCloud className="size-9" />
                </span>
                <strong className="mt-5 block text-xl font-black tracking-normal">Choisir des fichiers</strong>
                <span className="mx-auto mt-2 block max-w-sm text-sm font-medium leading-6 text-slate-500">PDF, Office, CSV, TXT, JPG, PNG, WEBP. Les limites sont validees par l'API NOVEX.</span>
                <span className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-black px-5 text-sm font-black text-white">Parcourir</span>
              </span>
            </label>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Button className="min-h-12 rounded-xl" type="button" variant="outline" onClick={() => inputRef.current?.click()}><Camera className="size-4" /> Photo</Button>
              <Button className="min-h-12 rounded-xl" type="button" variant="outline" onClick={() => inputRef.current?.click()}><Image className="size-4" /> Galerie</Button>
              <Button className="min-h-12 rounded-xl" type="button" variant="outline" onClick={() => inputRef.current?.click()}><FileUp className="size-4" /> Fichier</Button>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <CardHeader><CardTitle className="text-lg font-black tracking-normal text-slate-900">Parametres</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <label className="grid gap-2 text-sm font-bold">Categorie<select className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 font-semibold outline-none" value={category} onChange={(event) => setCategory(event.target.value)}>{DOCUMENT_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-bold">Dossier<select className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 font-semibold outline-none" value={folder} onChange={(event) => setFolder(event.target.value)}><option value="">Racine Documents</option>{foldersQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.breadcrumb.map((crumb) => crumb.name).join(" / ")}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-bold">Visibilite<select className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 font-semibold outline-none" value={visibility} onChange={(event) => setVisibility(event.target.value)}>{visibilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold">
              <span className="flex items-center gap-3"><ShieldCheck className="size-5 text-blue-700" /> Document sensible</span>
              <input type="checkbox" checked={sensitive} onChange={(event) => setSensitive(event.target.checked)} />
            </label>
          </CardContent>
        </Card>
      </section>
      <Card className="mt-4 rounded-2xl border-slate-200 shadow-sm">
        <CardHeader><CardTitle className="text-lg font-black tracking-normal text-slate-900">File d'attente</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {queue.length ? queue.map((item, index) => (
            <div className="rounded-xl border border-slate-200 bg-white p-4" key={item.id}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <strong className="min-w-0 truncate">{item.file.name}</strong>
                {item.state === "done" ? <CheckCircle2 className="size-5 shrink-0 text-emerald-600" /> : item.state === "failed" ? <Button className="rounded-xl" type="button" variant="outline" onClick={() => mutation.mutate([item])}><RotateCcw className="size-4" /> Reessayer</Button> : <span className="shrink-0">{index + 1} / {queue.length}</span>}
              </div>
              {item.state === "failed" ? <p className="mt-2 flex items-center gap-2 text-sm text-red-600"><XCircle className="size-4" /> {item.error || "Upload impossible"}</p> : <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-700" style={{ width: `${item.progress}%` }} /></div>}
            </div>
          )) : <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-500">Aucun fichier selectionne.</div>}
        </CardContent>
      </Card>
    </main>
  );
}
