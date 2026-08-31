"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  CreditCard,
  FileText,
  Grid2X2,
  Landmark,
  PieChart,
  Plus,
  Search,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadWorkspaceProfile, WorkspaceProfile, WorkspaceProfileSetup } from "@/features/workspace/workspace-profile";
import type { DashboardOverview } from "./types";
import { emptyDashboardOverview } from "./data";

type Metric = {
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "green" | "red" | "slate";
};

const metrics: Metric[] = [
  { label: "Membres actifs", value: "1 258", detail: "+12 nouveaux", tone: "green" },
  { label: "Cotisations payees", value: "6.2M", detail: "65% recouvres", tone: "blue" },
  { label: "Depenses", value: "3.2M", detail: "Eleve ce mois", tone: "red" },
  { label: "Projets actifs", value: "18", detail: "4 a risque", tone: "slate" },
  { label: "Evenements", value: "7", detail: "2 cette semaine", tone: "blue" },
  { label: "Documents", value: "342", detail: "18 ajoutes", tone: "green" }
];

const activities = [
  ["Cotisation recue", "Kouame Jean a paye sa cotisation mensuelle.", "Il y a 12 min"],
  ["Nouveau membre", "Awa Traore a rejoint l'association.", "Il y a 1 h"],
  ["Document ajoute", "PV reunion bureau publie dans les archives.", "Hier"],
  ["Projet mis a jour", "Budget centre communautaire revise.", "Hier"]
] as const;

const steeringItems: ReadonlyArray<readonly [string, string, string, LucideIcon]> = [
  ["Budget annuel", "18.4M utilises sur 24M", "77%", Landmark],
  ["Objectifs membres", "1 258 sur 1 500 membres", "84%", Target],
  ["Presence evenements", "412 presences confirmees", "71%", CalendarDays],
  ["Documents valides", "318 archives conformes", "93%", FileText]
];

const treasuryItems: ReadonlyArray<readonly [string, string, string, LucideIcon]> = [
  ["Caisse", "2.4M", "Disponible immediatement", CreditCard],
  ["Banque", "10.1M", "Compte principal", WalletCards],
  ["Creances", "1.5M", "Cotisations a recouvrer", Clock3]
];

function Logo({ profile }: Readonly<{ profile: WorkspaceProfile | null }>) {
  if (profile?.logoDataUrl) {
    return <img alt="" className="size-full rounded-full object-cover" src={profile.logoDataUrl} />;
  }

  return <span className="text-base font-black text-white">N</span>;
}

function toneClass(tone: Metric["tone"]) {
  return {
    blue: "text-blue-700 bg-blue-50",
    green: "text-emerald-700 bg-emerald-50",
    red: "text-red-700 bg-red-50",
    slate: "text-slate-700 bg-slate-100"
  }[tone];
}

function SectionTitle({ title, action }: Readonly<{ title: string; action?: string }>) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-xl font-black tracking-normal text-slate-950">{title}</h2>
      {action ? <button className="text-sm font-bold text-blue-700" type="button">{action}</button> : null}
    </div>
  );
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
    <main className="min-h-screen bg-[#f5f7f8] px-5 pb-28 pt-5 text-slate-950 md:rounded-[28px]">
      <header className="mb-7 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Grid2X2 className="size-6" />
          <strong className="text-sm">NOVEX</strong>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative grid size-11 place-items-center rounded-full bg-white shadow-sm" type="button" aria-label="Notifications">
            <Bell className="size-5" />
            <span className="absolute right-2 top-2 size-2 rounded-full bg-red-600" />
          </button>
          <div className="grid size-12 place-items-center rounded-full" style={{ backgroundColor: profile.color }}>
            <Logo profile={profile} />
          </div>
        </div>
      </header>

      <section className="mb-6">
        <h1 className="text-3xl font-black leading-tight tracking-normal">Bonjour, President</h1>
        <p className="mt-2 text-base font-semibold text-slate-600">{profile.associationName || initialData.workspace.name}</p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
          <span className="size-2 rounded-full bg-emerald-500" />
          Tout est a jour
        </div>
      </section>

      <div className="mb-6 flex gap-3 overflow-x-auto pb-1">
        {["Ce mois", "Trimestre", "Annee", "Tout"].map((period, index) => (
          <button className={`min-h-10 shrink-0 rounded-full px-5 text-sm font-bold ${index === 0 ? "bg-black text-white" : "bg-white text-slate-700 shadow-sm"}`} key={period} type="button">
            {period}
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between text-sm font-bold">
          <span className="flex items-center gap-2">
            <WalletCards className="size-5" />
            Solde Total
          </span>
          <ChevronRight className="size-5 text-blue-700" />
        </div>
        <div className="mt-6 text-4xl font-black tracking-normal">12.5M {profile.currency}</div>
        <p className="mt-2 text-sm font-bold text-emerald-600">+8.2% vs le mois dernier</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-emerald-50 p-3">
            <TrendingUp className="mb-2 size-5 text-emerald-700" />
            <p className="text-xs font-bold text-slate-500">Recettes</p>
            <strong className="mt-1 block text-lg">8.9M</strong>
          </div>
          <div className="rounded-lg bg-red-50 p-3">
            <TrendingDown className="mb-2 size-5 text-red-700" />
            <p className="text-xs font-bold text-slate-500">Sorties</p>
            <strong className="mt-1 block text-lg">3.2M</strong>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-4">
        {metrics.map((metric) => (
          <div className="min-h-36 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" key={metric.label}>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${toneClass(metric.tone)}`}>{metric.label}</span>
            <div className="mt-5 text-2xl font-black tracking-normal">{metric.value}</div>
            <p className="mt-2 text-sm font-bold text-slate-500">{metric.detail}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionTitle title="Etat des Cotisations" action="Voir tout" />
        <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-5">
          <div className="relative grid size-32 place-items-center rounded-[28px] bg-[conic-gradient(#0b63ce_0_65%,#c81e1e_65%_82%,#e5e7eb_82%_100%)]">
            <div className="grid size-20 place-items-center rounded-full bg-white text-center shadow-sm">
              <span className="text-2xl font-black leading-none">65%</span>
              <span className="text-[10px] font-bold text-slate-500">Paye</span>
            </div>
          </div>
          <div className="grid gap-4 text-sm font-bold">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-blue-700" />Payees</span>
              <span>6.2M</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-red-600" />En retard</span>
              <span>1.5M</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-slate-300" />A venir</span>
              <span>1.0M</span>
            </div>
          </div>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-[65%] rounded-full bg-blue-700" />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-red-100 bg-red-50 p-5">
        <h2 className="flex items-center gap-2 text-xl font-black text-red-700">
          <CircleAlert className="size-6 fill-red-600 text-white" />
          Attention requise
        </h2>
        <div className="mt-4 grid gap-3">
          {[
            ["45 membres impayes", "Delai depasse de 15 jours"],
            ["4 projets a risque", "Budget consomme a plus de 85%"],
            ["2 justificatifs manquants", "A valider par la tresorerie"]
          ].map(([title, detail]) => (
            <div className="flex items-center gap-3 rounded-lg border border-red-100 bg-white p-4" key={title}>
              <div className="grid size-12 place-items-center rounded-full bg-red-50 text-red-600">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <strong className="block text-sm">{title}</strong>
                <span className="text-xs font-medium text-slate-500">{detail}</span>
              </div>
              <Button className="min-h-9 px-3 text-xs" type="button" variant="outline">Traiter</Button>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4">
        <SectionTitle title="Pilotage association" />
        {steeringItems.map(([title, detail, progress, Icon]) => (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" key={String(title)}>
            <div className="flex items-center gap-4">
              <div className="grid size-12 place-items-center rounded-lg bg-slate-100">
                <Icon className="size-6 text-slate-700" />
              </div>
              <div className="min-w-0 flex-1">
                <strong className="block text-base">{title}</strong>
                <span className="text-sm font-medium text-slate-500">{detail}</span>
              </div>
              <span className="text-lg font-black">{progress}</span>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-slate-900" style={{ width: String(progress) }} />
            </div>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionTitle title="Tresorerie" action="Details" />
        <div className="grid gap-4">
          {treasuryItems.map(([title, value, detail, Icon]) => (
            <div className="flex items-center gap-4 rounded-lg bg-slate-50 p-4" key={String(title)}>
              <div className="grid size-11 place-items-center rounded-md bg-white">
                <Icon className="size-5 text-blue-700" />
              </div>
              <div className="min-w-0 flex-1">
                <strong className="block text-sm">{title}</strong>
                <span className="text-xs font-medium text-slate-500">{detail}</span>
              </div>
              <span className="text-lg font-black">{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionTitle title="Activite recente" />
        <div className="grid gap-4">
          {activities.map(([title, detail, date]) => (
            <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-3" key={title}>
              <div className="mt-1 grid size-8 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="size-4" />
              </div>
              <div>
                <strong className="block text-sm">{title}</strong>
                <p className="mt-1 text-sm leading-5 text-slate-500">{detail}</p>
                <span className="mt-1 block text-xs font-bold text-slate-400">{date}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-xl bg-[#0f2347] p-5 text-white shadow-lg shadow-slate-900/15">
        <div className="flex items-start gap-4">
          <div className="grid size-12 place-items-center rounded-full bg-white/15">
            <Bot className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-black tracking-normal">Assistant IA</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-white/80">Analysez finances, membres, cotisations, projets et documents en quelques secondes.</p>
            <div className="mt-5 flex min-h-12 items-center gap-2 rounded-lg bg-black/20 px-4 text-sm text-white/50">
              <Search className="size-5" />
              Ex: Resume financier...
            </div>
          </div>
          <button className="grid size-12 place-items-center rounded-full bg-blue-600 shadow-lg" type="button" aria-label="Nouvelle action">
            <Plus className="size-6" />
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionTitle title="Synthese rapide" />
        <div className="grid gap-3 text-sm font-semibold text-slate-600">
          <p><span className="font-black text-slate-950">Pays:</span> {profile.country}</p>
          <p><span className="font-black text-slate-950">Type:</span> {profile.associationType}</p>
          <p><span className="font-black text-slate-950">Devise:</span> {profile.currency}</p>
          <p><span className="font-black text-slate-950">Workspace:</span> {workspaceSlug}</p>
        </div>
      </section>
    </main>
  );
}
