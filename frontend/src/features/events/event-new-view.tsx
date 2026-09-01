import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EventForm } from "./event-form";

export function EventNewView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  return (
    <main className="min-h-screen bg-[#f5f7f8] px-4 pb-28 pt-5 text-slate-950 md:rounded-[28px] md:px-6">
      <header className="mb-5 flex items-center gap-3">
        <Link className="grid size-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white shadow-sm" href={`/app/${workspaceSlug}/events`} aria-label="Retour aux evenements">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black tracking-normal">Créer un événement</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">Renseignez les informations principales.</p>
        </div>
      </header>

      <EventForm workspaceSlug={workspaceSlug} />
    </main>
  );
}
