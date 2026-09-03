"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { displayUserName, getCurrentUser } from "@/features/auth/current-user";
import { getWorkspaceSettings } from "@/features/workspace/api";
import { isWorkspaceSlugValid, loadWorkspaceProfile, WorkspaceProfile } from "@/features/workspace/workspace-profile";
import { getDashboardOverview } from "./api";
import type { DashboardOverview, PeriodCode } from "./types";
import { emptyDashboardOverview } from "./data";

type Metric = {
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "green" | "red" | "slate";
};

type PeriodKey = "Ce mois" | "Trimestre" | "Annee" | "Tout";

const periodData: Record<
  PeriodKey,
  {
    balance: string;
    balanceTrend: string;
    revenues: string;
    expenses: string;
    totalContributions: string;
    paidContributions: string;
    lateContributions: string;
    upcomingContributions: string;
    recoveryRate: number;
    metrics: Metric[];
  }
> = {
  "Ce mois": {
    balance: "12.5M",
    balanceTrend: "+8.2% vs le mois dernier",
    revenues: "8.9M",
    expenses: "3.2M",
    totalContributions: "8.7M",
    paidContributions: "6.2M",
    lateContributions: "1.5M",
    upcomingContributions: "1.0M",
    recoveryRate: 65,
    metrics: [
      { label: "Membres actifs", value: "1 258", detail: "+12 nouveaux", tone: "green" },
      { label: "Cotisations payees", value: "6.2M", detail: "65% recouvres", tone: "blue" },
      { label: "Depenses", value: "3.2M", detail: "Eleve ce mois", tone: "red" },
      { label: "Projets actifs", value: "18", detail: "4 a risque", tone: "slate" },
      { label: "Evenements", value: "7", detail: "2 cette semaine", tone: "blue" },
      { label: "Documents", value: "342", detail: "18 ajoutes", tone: "green" }
    ]
  },
  Trimestre: {
    balance: "31.4M",
    balanceTrend: "+14.6% vs trimestre precedent",
    revenues: "24.8M",
    expenses: "9.7M",
    totalContributions: "22.0M",
    paidContributions: "16.9M",
    lateContributions: "3.6M",
    upcomingContributions: "1.5M",
    recoveryRate: 77,
    metrics: [
      { label: "Membres actifs", value: "1 284", detail: "+48 nouveaux", tone: "green" },
      { label: "Cotisations payees", value: "16.9M", detail: "77% recouvres", tone: "blue" },
      { label: "Depenses", value: "9.7M", detail: "Sous controle", tone: "slate" },
      { label: "Projets actifs", value: "23", detail: "6 termines", tone: "green" },
      { label: "Evenements", value: "18", detail: "11 realises", tone: "blue" },
      { label: "Documents", value: "411", detail: "69 ajoutes", tone: "green" }
    ]
  },
  Annee: {
    balance: "84.2M",
    balanceTrend: "+21.3% vs annee derniere",
    revenues: "72.0M",
    expenses: "38.6M",
    totalContributions: "58.0M",
    paidContributions: "44.7M",
    lateContributions: "8.4M",
    upcomingContributions: "4.9M",
    recoveryRate: 81,
    metrics: [
      { label: "Membres actifs", value: "1 326", detail: "+176 cette annee", tone: "green" },
      { label: "Cotisations payees", value: "44.7M", detail: "81% recouvres", tone: "blue" },
      { label: "Depenses", value: "38.6M", detail: "64% budget", tone: "slate" },
      { label: "Projets actifs", value: "41", detail: "15 clotures", tone: "green" },
      { label: "Evenements", value: "52", detail: "4 majeurs", tone: "blue" },
      { label: "Documents", value: "928", detail: "317 valides", tone: "green" }
    ]
  },
  Tout: {
    balance: "146.8M",
    balanceTrend: "+38.9% depuis creation",
    revenues: "129.5M",
    expenses: "67.4M",
    totalContributions: "94.0M",
    paidContributions: "76.1M",
    lateContributions: "10.8M",
    upcomingContributions: "7.1M",
    recoveryRate: 86,
    metrics: [
      { label: "Membres actifs", value: "1 402", detail: "2 918 historiques", tone: "green" },
      { label: "Cotisations payees", value: "76.1M", detail: "86% recouvres", tone: "blue" },
      { label: "Depenses", value: "67.4M", detail: "Grand livre", tone: "slate" },
      { label: "Projets actifs", value: "67", detail: "39 archives", tone: "green" },
      { label: "Evenements", value: "138", detail: "9 420 presences", tone: "blue" },
      { label: "Documents", value: "1 842", detail: "GED complete", tone: "green" }
    ]
  }
};

const notifications = [
  ["Cotisations", "45 membres ont depasse le delai de paiement.", "Maintenant"],
  ["Budget", "Le projet centre communautaire approche 85% du budget.", "Il y a 18 min"],
  ["Document", "2 justificatifs financiers attendent validation.", "Aujourd'hui"],
  ["Evenement", "La reunion bureau commence demain a 10h.", "Demain"]
] as const;

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

const periodCodes: Record<PeriodKey, PeriodCode> = {
  "Ce mois": "month",
  Trimestre: "quarter",
  Annee: "year",
  Tout: "year"
};

function displayProfile(profile: WorkspaceProfile | null, workspaceName: string): WorkspaceProfile {
  return profile || {
    country: "Non renseigne",
    associationName: workspaceName,
    associationType: "Association",
    logoDataUrl: "",
    currency: "FCFA",
    color: "#0F7FF2"
  };
}

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
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("Ce mois");
  const [showNotifications, setShowNotifications] = useState(false);
  const dashboardQuery = useQuery({
    queryKey: ["dashboard-overview", workspaceSlug, selectedPeriod],
    queryFn: () => getDashboardOverview(workspaceSlug, periodCodes[selectedPeriod]),
    enabled: isWorkspaceSlugValid(workspaceSlug),
    retry: false
  });
  const userQuery = useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
    retry: false
  });
  const settingsQuery = useQuery({
    queryKey: ["workspace-settings", workspaceSlug],
    queryFn: () => getWorkspaceSettings(workspaceSlug),
    enabled: isWorkspaceSlugValid(workspaceSlug),
    retry: false
  });

  useEffect(() => {
    setProfile(loadWorkspaceProfile(workspaceSlug));
    setIsReady(true);
  }, [workspaceSlug]);

  if (!isReady) {
    return <div className="min-h-screen bg-white" />;
  }

  if (!isWorkspaceSlugValid(workspaceSlug)) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f7f8] px-5 text-slate-950">
        <section className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-black tracking-normal">Workspace introuvable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Reconnecte-toi pour revenir au dashboard de ton association.</p>
        </section>
      </main>
    );
  }

  const overview = dashboardQuery.data || initialData;
  const currentProfile = displayProfile(profile, overview.workspace.name);
  const workspaceOwnerName = settingsQuery.data?.owner?.full_name?.trim() || "";
  const dashboardUserName = workspaceOwnerName || displayUserName(userQuery.data);
  const dashboardAssociationName = settingsQuery.data?.workspace_name || currentProfile.associationName || initialData.workspace.name;
  const moneyFallback = `0 ${overview.workspace.currency === "XOF" ? "FCFA" : overview.workspace.currency}`;
  const current = {
    balance: overview.kpis.finance.current_balance || moneyFallback,
    balanceTrend: overview.empty_state ? "Aucune donnee enregistree" : `Periode: ${overview.period.label}`,
    revenues: overview.kpis.finance.revenues || moneyFallback,
    expenses: overview.kpis.finance.expenses || moneyFallback,
    totalContributions: overview.kpis.contributions.objective || moneyFallback,
    paidContributions: overview.kpis.contributions.collected || moneyFallback,
    lateContributions: `${overview.kpis.contributions.late_members.toLocaleString("fr-FR")} membre(s)`,
    upcomingContributions: overview.kpis.contributions.remaining || moneyFallback,
    recoveryRate: overview.kpis.contributions.recovery_rate,
    metrics: [
      { label: "Membres actifs", value: overview.kpis.members.active.toLocaleString("fr-FR"), detail: `${overview.kpis.members.total.toLocaleString("fr-FR")} total`, tone: "green" as const },
      { label: "Cotisations", value: overview.kpis.contributions.collected || moneyFallback, detail: `${overview.kpis.contributions.recovery_rate}% recouvres`, tone: "blue" as const },
      { label: "Depenses", value: overview.kpis.finance.expenses || moneyFallback, detail: overview.kpis.finance.masked ? "Acces limite" : overview.period.label, tone: "slate" as const },
      { label: "Projets actifs", value: overview.kpis.projects.active.toLocaleString("fr-FR"), detail: `${overview.kpis.projects.total.toLocaleString("fr-FR")} total`, tone: "slate" as const },
      { label: "Evenements", value: overview.kpis.events.upcoming.toLocaleString("fr-FR"), detail: "A venir", tone: "blue" as const },
      { label: "Documents", value: overview.kpis.documents.recent.toLocaleString("fr-FR"), detail: "Recents", tone: "green" as const }
    ]
  };
  const notificationItems = overview.alerts;
  const activityItems = overview.activity;
  const steeringMetrics: ReadonlyArray<readonly [string, string, string, LucideIcon]> = [
    ["Budget annuel", overview.kpis.finance.expenses || moneyFallback, "0%", Landmark],
    ["Objectifs membres", `${overview.kpis.members.active.toLocaleString("fr-FR")} actifs`, `${Math.round(overview.kpis.members.active_rate)}%`, Target],
    ["Evenements", `${overview.kpis.events.upcoming.toLocaleString("fr-FR")} a venir`, "0%", CalendarDays],
    ["Documents", `${overview.kpis.documents.recent.toLocaleString("fr-FR")} recents`, "0%", FileText]
  ];
  const treasuryMetrics: ReadonlyArray<readonly [string, string, string, LucideIcon]> = [
    ["Solde", overview.kpis.finance.current_balance || moneyFallback, "Disponible selon transactions validees", CreditCard],
    ["Recettes", overview.kpis.finance.revenues || moneyFallback, overview.period.label, WalletCards],
    ["Cotisations restantes", overview.kpis.contributions.remaining || moneyFallback, "A recouvrer", Clock3]
  ];

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-5 pb-28 pt-5 text-slate-950 md:rounded-[28px]">
      <header className="mb-7 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Grid2X2 className="size-6" />
          <strong className="text-sm">NOVEX</strong>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="relative grid size-11 place-items-center rounded-full bg-white shadow-sm"
            type="button"
            aria-expanded={showNotifications}
            aria-label="Notifications"
            onClick={() => setShowNotifications((open) => !open)}
          >
            <Bell className="size-5" />
            {notificationItems.length ? <span className="absolute right-2 top-2 size-2 rounded-full bg-red-600" /> : null}
          </button>
          <div className="grid size-12 place-items-center rounded-full" style={{ backgroundColor: currentProfile.color }}>
            <Logo profile={currentProfile} />
          </div>
        </div>
      </header>

      {showNotifications ? (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-900/10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black tracking-normal">Notifications</h2>
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-700">{notificationItems.length} nouvelle(s)</span>
          </div>
          <div className="grid gap-3">
            {notificationItems.length ? notificationItems.map(({ title, description, level }) => (
              <div className="rounded-lg bg-slate-50 p-4" key={title}>
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm">{title}</strong>
                  <span className="text-[11px] font-bold text-slate-400">{level}</span>
                </div>
                <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
              </div>
            )) : <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">Aucune notification pour le moment.</p>}
          </div>
        </section>
      ) : null}

      <section className="mb-6">
        <h1 className="text-3xl font-black leading-tight tracking-normal">Bonjour, {dashboardUserName}</h1>
        <p className="mt-2 text-base font-semibold text-slate-600">{dashboardAssociationName}</p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
          <span className="size-2 rounded-full bg-emerald-500" />
          {overview.empty_state ? "Workspace pret" : "Donnees synchronisees"}
        </div>
      </section>

      <div className="mb-6 flex gap-3 overflow-x-auto pb-1">
        {(Object.keys(periodData) as PeriodKey[]).map((period) => (
          <button
            className={`min-h-10 shrink-0 rounded-full px-5 text-sm font-bold ${selectedPeriod === period ? "bg-black text-white" : "bg-white text-slate-700 shadow-sm"}`}
            key={period}
            type="button"
            onClick={() => setSelectedPeriod(period)}
          >
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
        <div className="mt-6 text-4xl font-black tracking-normal">{current.balance}</div>
        <p className="mt-2 text-sm font-bold text-emerald-600">{current.balanceTrend}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-emerald-50 p-3">
            <TrendingUp className="mb-2 size-5 text-emerald-700" />
            <p className="text-xs font-bold text-slate-500">Recettes</p>
            <strong className="mt-1 block text-lg">{current.revenues}</strong>
          </div>
          <div className="rounded-lg bg-red-50 p-3">
            <TrendingDown className="mb-2 size-5 text-red-700" />
            <p className="text-xs font-bold text-slate-500">Sorties</p>
            <strong className="mt-1 block text-lg">{current.expenses}</strong>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-4">
        {current.metrics.map((metric) => (
          <div className="min-h-36 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" key={metric.label}>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${toneClass(metric.tone)}`}>{metric.label}</span>
            <div className="mt-5 text-2xl font-black tracking-normal">{metric.value}</div>
            <p className="mt-2 text-sm font-bold text-slate-500">{metric.detail}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionTitle title="Etat des Cotisations" action="Voir tout" />
        <div className="mb-4 flex justify-end">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{current.totalContributions} Total</span>
        </div>
        <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-5">
          <div
            className="relative grid size-32 place-items-center rounded-[28px]"
            style={{
              background: `conic-gradient(#0b63ce 0 ${current.recoveryRate}%, #c81e1e ${current.recoveryRate}% 82%, #e5e7eb 82% 100%)`
            }}
          >
            <div className="grid size-20 place-items-center rounded-full bg-white text-center shadow-sm">
              <span className="text-2xl font-black leading-none">{current.recoveryRate}%</span>
              <span className="text-[10px] font-bold text-slate-500">Paye</span>
            </div>
          </div>
          <div className="grid gap-4 text-sm font-bold">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-blue-700" />Payees</span>
              <span>{current.paidContributions}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-red-600" />En retard</span>
              <span>{current.lateContributions}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-slate-300" />A venir</span>
              <span>{current.upcomingContributions}</span>
            </div>
          </div>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-700" style={{ width: `${current.recoveryRate}%` }} />
        </div>
      </section>

      {notificationItems.length ? <section className="mt-6 rounded-xl border border-red-100 bg-red-50 p-5">
        <h2 className="flex items-center gap-2 text-xl font-black text-red-700">
          <CircleAlert className="size-6 fill-red-600 text-white" />
          Attention requise
        </h2>
        <div className="mt-4 grid gap-3">
          {notificationItems.map(({ title, description }) => (
            <div className="flex items-center gap-3 rounded-lg border border-red-100 bg-white p-4" key={title}>
              <div className="grid size-12 place-items-center rounded-full bg-red-50 text-red-600">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <strong className="block text-sm">{title}</strong>
                <span className="text-xs font-medium text-slate-500">{description}</span>
              </div>
              <Button className="min-h-9 px-3 text-xs" type="button" variant="outline">Traiter</Button>
            </div>
          ))}
        </div>
      </section> : null}

      <section className="mt-6 grid gap-4">
        <SectionTitle title="Pilotage association" />
        {steeringMetrics.map(([title, detail, progress, Icon]) => (
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
          {treasuryMetrics.map(([title, value, detail, Icon]) => (
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
          {activityItems.length ? activityItems.map(({ title, description, occurred_at }) => (
            <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-3" key={title}>
              <div className="mt-1 grid size-8 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="size-4" />
              </div>
              <div>
                <strong className="block text-sm">{title}</strong>
                <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
                <span className="mt-1 block text-xs font-bold text-slate-400">{new Intl.DateTimeFormat("fr-FR").format(new Date(occurred_at))}</span>
              </div>
            </div>
          )) : <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-500">Aucune activite recente.</p>}
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
          <p><span className="font-black text-slate-950">Pays:</span> {currentProfile.country}</p>
          <p><span className="font-black text-slate-950">Type:</span> {currentProfile.associationType}</p>
          <p><span className="font-black text-slate-950">Devise:</span> {currentProfile.currency}</p>
          <p><span className="font-black text-slate-950">Workspace:</span> {workspaceSlug}</p>
        </div>
      </section>
    </main>
  );
}
