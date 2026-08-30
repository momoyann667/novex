import Link from "next/link";
import { Archive, Clock3, Download, Eye, FileText, Folder, GitBranch, Lock, RotateCcw, Share2, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const versions = [["3", "30 Aout 2026", "Awa Kone", "Correction finale", "2.8 MB"], ["2", "29 Aout 2026", "Awa Kone", "Ajout annexes", "2.6 MB"], ["1", "28 Aout 2026", "Yao Kouame", "Version initiale", "2.1 MB"]] as const;

export function DocumentDetailView({ documentId, workspaceSlug }: Readonly<{ documentId: string; workspaceSlug: string }>) {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="PV assemblee generale 2026.pdf"
        description={`Document ${documentId} - Administration / PV - version 3`}
        actions={
          <>
            <Button type="button" variant="outline"><Share2 className="size-4" /> Partager</Button>
            <Button type="button"><Download className="size-4" /> Telecharger</Button>
          </>
        }
      />
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><Eye className="size-4" /> Apercu securise</CardTitle></CardHeader>
          <CardContent>
            <div className="grid min-h-[520px] place-items-center rounded-md border border-dashed border-border bg-slate-50 text-center">
              <div>
                <FileText className="mx-auto size-14 text-blue-700" />
                <strong className="mt-4 block">Apercu PDF / image / TXT</strong>
                <p className="mt-2 max-w-md text-sm text-slate-500">Le fichier prive reste accessible uniquement apres controle du workspace, de la visibilite et des permissions.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base text-slate-900">Metadonnees</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              {[
                ["Type", "PDF"],
                ["Taille", "2.8 MB"],
                ["Auteur", "Awa Kone"],
                ["Date", "30 Aout 2026"],
                ["Dossier", "Administration / PV"],
                ["Statut", "A valider"],
                ["Visibilite", "Workspace"],
              ].map(([label, value]) => <div className="flex justify-between gap-4" key={label}><span className="text-slate-500">{label}</span><strong className="text-right">{value}</strong></div>)}
              <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800"><Lock className="size-4" /> Niveau SENSITIVE disponible pour documents restreints</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base text-slate-900">Relations</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <Link className="rounded-md border border-border p-3 hover:bg-slate-50" href={`/app/${workspaceSlug}/projects/PRJ-2026-001`}>Projet associe: Centre communautaire</Link>
              <Link className="rounded-md border border-border p-3 hover:bg-slate-50" href={`/app/${workspaceSlug}/finance/transactions/EXP-001`}>Transaction associee: Depense 350 000 XOF</Link>
            </CardContent>
          </Card>
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><GitBranch className="size-4" /> Versions</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {versions.map(([version, date, author, note, size]) => (
              <div className="grid gap-3 rounded-md border border-border p-3 text-sm md:grid-cols-[80px_1fr_120px_100px] md:items-center" key={version}>
                <strong>Version {version}</strong><span>{note}<span className="block text-xs text-slate-500">{author} - {date}</span></span><span>{size}</span><Button type="button" variant="outline"><RotateCcw className="size-4" /> Restaurer</Button>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-slate-900"><Clock3 className="size-4" /> Historique</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {["document.created", "document.version_created", "document.shared", "document.downloaded", "document.approved"].map((item) => <div className="rounded-md border border-border p-3" key={item}>{item}</div>)}
          </CardContent>
        </Card>
      </section>
      <section className="flex flex-wrap gap-2">
        <Button type="button" variant="outline"><Folder className="size-4" /> Deplacer</Button>
        <Button type="button" variant="outline"><ShieldCheck className="size-4" /> Approuver</Button>
        <Button type="button" variant="outline"><Archive className="size-4" /> Archiver</Button>
        <Button type="button" variant="outline"><Trash2 className="size-4" /> Corbeille</Button>
      </section>
    </div>
  );
}
