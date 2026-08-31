"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Bot, ChevronRight, CircleAlert, Grid2X2, Plus, Search, ShieldCheck, Users, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadWorkspaceProfile, WorkspaceProfile, WorkspaceProfileSetup } from "@/features/workspace/workspace-profile";
import type { DashboardOverview } from "./types";
import { emptyDashboardOverview } from "./data";

function Logo({ profile }: Readonly<{ profile: WorkspaceProfile | null }>) {
  if (profile?.logoDataUrl) {
    return <img alt="" className="size-full rounded-full object-cover" src={profile.logoDataUrl} />;
  }

  return <span className="text-sm font-black text-white">N</span>;
}

export function DashboardView({
  initialData = emptyDashboardOverview,
  workspaceSlug
}: Readonly<{ initialData?: DashboardOverview; workspaceSlug: string }>) {
  const [profile, setProfile] = useState<WorkspaceProfile | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setProfile(loadWorkspaceProfile(workspaceSlug));
    setIsReady(true);
  }, [workspaceSlug]);

  const handleComplete = useCallback((nextProfile: WorkspaceProfile) => {
    setProfile(nextProfile);
    setIsReady(true);
  }, []);

  if (!isReady) {
    return <div className="min-h-screen bg-white" />;
  }

  if (!profile) {
    return <WorkspaceProfileSetup workspaceSlug={workspaceSlug} onComplete={handleComplete} />;
  }

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-4 pb-24 pt-4 text-slate-950 md:rounded-[28px]">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Grid2X2 className="size-5" />
          <strong className="text-xs">NOVEX</strong>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative grid size-8 place-items-center rounded-full bg-white shadow-sm" type="button" aria-label="Notifications">
            <Bell className="size-4" />
            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-red-600" />
          </button>
          <div className="grid size-10 place-items-center rounded-full" style={{ backgroundColor: profile.color }}>
            <Logo profile={profile} />
          </div>
        </div>
      </header>

      <section>
        <h1 className="text-2xl font-black tracking-normal">Bonjour, President</h1>
        <p className="mt-1 text-xs font-medium text-slate-500">{profile.associationName || initialData.workspace.name}</p>
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Tout est a jour
        </div>
      </section>

      <div className="mt-5 flex gap-2">
        {["Ce mois", "Trimestre", "Annee"].map((period, index) => (
          <button className={`min-h-8 rounded-full px-4 text-xs font-bold ${index === 0 ? "bg-black text-white" : "bg-white text-slate-700 shadow-sm"}`} key={period} type="button">
            {period}
          </button>
        ))}
      </div>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="flex items-center gap-2">
            <WalletCards className="size-4" />
            Solde Total
          </span>
          <ChevronRight className="size-4 text-blue-700" />
        </div>
        <div className="mt-5 text-3xl font-black tracking-normal">12.5M {profile.currency}</div>
        <p className="mt-1 text-xs font-bold text-emerald-600">+8.2% vs le mois dernier</p>
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <Users className="size-4" />
            Membres
          </div>
          <div className="mt-3 text-xl font-black">1258</div>
          <p className="text-[11px] font-bold text-emerald-600">+12 Nouveaux</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <WalletCards className="size-4" />
            Depenses
          </div>
          <div className="mt-3 text-xl font-black">3.2M</div>
          <p className="text-[11px] font-bold text-red-600">Eleve ce mois</p>
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black tracking-normal">Etat des Cotisations</h2>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">8.7M {profile.currency} Total</span>
        </div>
        <div className="mt-4 grid grid-cols-[88px_minmax(0,1fr)] items-center gap-5">
          <div className="relative grid size-24 place-items-center rounded-[24px] bg-[conic-gradient(#0b63ce_0_65%,#c81e1e_65%_82%,#e5e7eb_82%_100%)]">
            <div className="grid size-16 place-items-center rounded-full bg-white text-center shadow-sm">
              <span className="text-xl font-black leading-none">65%</span>
              <span className="text-[9px] font-bold text-slate-500">Paye</span>
            </div>
          </div>
          <div className="grid gap-3 text-xs font-bold">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-blue-700" />Payees</span>
              <span>6.2M</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-red-600" />En retard</span>
              <span>1.5M</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-slate-300" />A venir</span>
              <span>1.0M</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-red-100 bg-red-50 p-4">
        <h2 className="flex items-center gap-2 text-base font-black text-red-700">
          <CircleAlert className="size-5 fill-red-600 text-white" />
          Attention requise
        </h2>
        <div className="mt-3 flex items-center gap-3 rounded-md border border-red-100 bg-white p-3">
          <div className="grid size-11 place-items-center rounded-full bg-red-50 text-red-600">
            <ShieldCheck className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <strong className="block text-xs">45 membres impayes</strong>
            <span className="text-[11px] font-medium text-slate-500">Delai depasse de 15 jours</span>
          </div>
          <Button className="min-h-8 px-3 text-[10px]" type="button" variant="outline">Relancer</Button>
        </div>
      </section>

      <section className="mt-5 rounded-lg bg-[#0f2347] p-4 text-white shadow-lg shadow-slate-900/15">
        <div className="flex items-start gap-3">
          <div className="grid size-11 place-items-center rounded-full bg-white/15">
            <Bot className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black tracking-normal">Assistant IA</h2>
            <p className="mt-1 text-xs font-medium text-white/80">Comment puis-je vous aider aujourd'hui ?</p>
            <div className="mt-4 flex min-h-10 items-center gap-2 rounded-md bg-black/20 px-3 text-xs text-white/50">
              <Search className="size-4" />
              Ex: Resume financier...
            </div>
          </div>
          <button className="grid size-12 place-items-center rounded-full bg-blue-600 shadow-lg" type="button" aria-label="Nouvelle action">
            <Plus className="size-6" />
          </button>
        </div>
      </section>
    </main>
  );
}
