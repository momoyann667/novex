"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, CheckCircle2, CreditCard, Download, Edit3, FileText, IdCard, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayUserName, getCurrentUser, userInitials } from "@/features/auth/current-user";
import { getWorkspaceSettings } from "@/features/workspace/api";
import { currentMemberProfile } from "./current-member-profile";

type Tab = "profile" | "contributions" | "payments" | "attendance" | "events" | "documents" | "history";

const association = {
  name: "Association",
  logoInitial: "A"
};

const contributions: Array<{ period: string; label: string; due: number; paid: number; remaining: number; status: string; dueDate: string }> = [];

const payments: Array<{ reference: string; reason: string; amount: number; method: string; status: string; date: string; receipt: string }> = [];

const participations: Array<{ title: string; date: string; status: string }> = [];

const events: Array<{ title: string; date: string; time: string; location: string; participation: string; past: boolean }> = [];

const documents: Array<{ name: string; type: string; size: string; category: string }> = [];

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "profile", label: "Profil" },
  { id: "contributions", label: "Cotisations" },
  { id: "payments", label: "Paiements" },
  { id: "attendance", label: "Presences" },
  { id: "events", label: "Evenements" },
  { id: "documents", label: "Documents" },
  { id: "history", label: "Historique" }
];

function formatMoney(value: number) {
  return `${value.toLocaleString("fr-FR")} FCFA`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(value));
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function MemberSpaceView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [isEditing, setIsEditing] = useState(false);
  const userQuery = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser, retry: false });
  const settingsQuery = useQuery({
    queryKey: ["workspace-settings", workspaceSlug],
    queryFn: () => getWorkspaceSettings(workspaceSlug),
    retry: false
  });
  const user = userQuery.data;
  const owner = settingsQuery.data?.owner;
  const ownerName = owner?.full_name?.trim() || "";
  const fullName = ownerName || displayUserName(user);
  const ownerFirstName = ownerName.split(/\s+/)[0] || "";
  const ownerLastName = ownerName.split(/\s+/).slice(1).join(" ");
  const workspaceName = settingsQuery.data?.workspace_name || association.name;
  const profile = {
    ...currentMemberProfile,
    firstName: ownerFirstName || user?.profile?.first_name || fullName.split(" ")[0] || "Utilisateur",
    lastName: ownerLastName || user?.profile?.last_name || "",
    fullName,
    initials: ownerName ? initialsFromName(ownerName) : userInitials(user),
    email: owner?.email || user?.email || "",
    phone: owner?.phone || user?.phone || "",
    joinedAt: new Date().toISOString().slice(0, 10),
    membershipNumber: "A creer",
    completion: owner?.email || user?.email ? 40 : 0,
    photoUrl: user?.profile?.avatar || ""
  };
  const totalDue = useMemo(() => contributions.reduce((sum, item) => sum + item.due, 0), []);
  const totalPaid = useMemo(() => contributions.reduce((sum, item) => sum + item.paid, 0), []);
  const remaining = Math.max(totalDue - totalPaid, 0);
  const participationRate = participations.length ? Math.round((participations.filter((item) => item.status === "Present").length / participations.length) * 100) : 0;

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-4 pb-28 pt-4 text-slate-950 md:px-8">
      <button className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-white px-3 text-sm font-black text-slate-700 shadow-sm" type="button" onClick={() => router.back()}>
        <ArrowLeft className="size-4" />
        Retour
      </button>

      <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-white/65">Bonjour {profile.firstName}</p>
            <h1 className="mt-2 text-3xl font-black tracking-normal">Mon espace</h1>
            <p className="mt-2 text-sm font-medium leading-6 text-white/70">Voici un apercu de votre activite dans l'association.</p>
          </div>
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-white text-lg font-black text-slate-950">{profile.initials}</div>
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-5 pt-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full bg-[#0f2347] text-sm font-black text-white">{workspaceName[0]?.toUpperCase() || association.logoInitial}</div>
            <strong className="text-sm tracking-normal text-slate-700">{workspaceName}</strong>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
            <span className="size-2 rounded-full bg-emerald-600" />
            {profile.status}
          </span>
        </div>

        <div className="px-5 py-7 text-center">
          <div className="mx-auto grid size-24 place-items-center overflow-hidden rounded-full border-4 border-white bg-[linear-gradient(135deg,#dbeafe,#0f2347)] shadow-lg shadow-slate-900/10">
            <span className="text-2xl font-black text-white">{profile.initials}</span>
          </div>
          <h2 className="mt-5 text-2xl font-black tracking-normal">{profile.fullName}</h2>
          <p className="mt-1 text-sm font-black text-slate-500">ID: {profile.membershipNumber}</p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm">
            <CheckCircle2 className="size-4 text-blue-700" />
            {profile.function} Premium
          </div>

          <div className="mx-auto mt-6 w-full max-w-[210px] rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid aspect-square place-items-center bg-slate-100 text-slate-300">
              <QrCode className="size-20" />
            </div>
            <p className="mt-3 text-xs font-black text-slate-500">Scanner pour verifier</p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-4 text-xs font-black text-slate-500">
          <span>Actif depuis le {formatDate(profile.joinedAt)}</span>
          <IdCard className="size-4" />
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Cotisations", remaining === 0 ? "A jour" : formatMoney(remaining), CreditCard],
          ["Participation", `${participationRate} %`, CalendarDays],
          ["Documents", documents.length.toString(), FileText],
          ["Anciennete", "0.6 an", IdCard]
        ].map(([label, value, Icon]) => (
          <div className="min-h-28 rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={label as string}>
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold text-slate-600">{label as string}</span>
              <Icon className="size-8 text-slate-200" />
            </div>
            <div className="mt-3 text-2xl font-black tracking-normal">{value as string}</div>
          </div>
        ))}
      </section>

      <section className="mt-5 rounded-xl bg-white p-4 shadow-sm">
        <p className="text-sm font-black">A retenir</p>
        <div className="mt-3 grid gap-2 text-sm font-semibold text-slate-600">
          {remaining ? <p>Votre prochaine cotisation affiche un reste de {formatMoney(remaining)}.</p> : <p>Vos cotisations sont a jour.</p>}
          {events.length ? <p>Prochain evenement prevu le {formatDate(events[0].date)}.</p> : <p>Aucun evenement lie a votre profil pour le moment.</p>}
          {profile.completion < 100 ? <p>Votre profil est complete a {profile.completion} %.</p> : null}
        </div>
      </section>

      <nav className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-black ${activeTab === tab.id ? "bg-blue-700 text-white" : "bg-white text-slate-600 shadow-sm"}`} key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      <section className="mt-5">
        {activeTab === "profile" ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black">Profil</h2>
                <Button type="button" variant="outline" onClick={() => setIsEditing((value) => !value)}><Edit3 className="size-4" /> Modifier</Button>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {["Nom: Mohamed", "Prenoms: Tangora", `Telephone: ${profile.phone}`, `Email: ${profile.email}`, `Ville: ${profile.city}`, `Profession: ${profile.occupation || "A completer"}`].map((item) => <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600" key={item}>{item}</p>)}
              </div>
              {isEditing ? (
                <form className="mt-5 grid gap-3">
                  <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" defaultValue={profile.phone} />
                  <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" defaultValue={profile.email} />
                  <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" placeholder="Profession" />
                  <Button className="min-h-12 bg-blue-700 text-white hover:bg-blue-800" type="button" onClick={() => setIsEditing(false)}>Enregistrer</Button>
                </form>
              ) : null}
            </article>
            <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black">Completion profil</h2>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-700" style={{ width: `${profile.completion}%` }} /></div>
              <p className="mt-3 text-3xl font-black">{profile.completion} %</p>
              <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-600">
                <p><CheckCircle2 className="mr-2 inline size-4 text-emerald-600" /> Informations personnelles</p>
                <p><CheckCircle2 className="mr-2 inline size-4 text-emerald-600" /> Telephone</p>
                <p><CheckCircle2 className="mr-2 inline size-4 text-emerald-600" /> Email</p>
                <p className="text-amber-700">Profession a completer</p>
              </div>
            </aside>
          </div>
        ) : null}

        {activeTab === "contributions" ? (
          <div className="grid gap-4">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <div className="flex items-end justify-between"><h2 className="text-xl font-black">Cotisations</h2><strong>{Math.round((totalPaid / totalDue) * 100)} %</strong></div>
              <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.round((totalPaid / totalDue) * 100)}%` }} /></div>
              <p className="mt-3 text-sm font-semibold text-slate-600">{formatMoney(totalPaid)} paye sur {formatMoney(totalDue)}. Reste : {formatMoney(remaining)}.</p>
            </div>
            {contributions.map((item) => <DataCard key={item.period} title={item.period} subtitle={item.label} value={formatMoney(item.due)} status={item.status} detail={`Echeance ${formatDate(item.dueDate)}`} />)}
            {!contributions.length ? <EmptyTab label="Aucune cotisation rattachee a votre profil." /> : null}
            <Button asChild className="min-h-12 bg-blue-700 text-white hover:bg-blue-800"><Link href={`/app/${workspaceSlug}/payments`}>Payer ma cotisation</Link></Button>
          </div>
        ) : null}

        {activeTab === "payments" ? (
          <div className="grid gap-3">
            {payments.map((item) => <DataCard key={item.reference} title={item.reason} subtitle={`${item.method} - ${formatDate(item.date)}`} value={formatMoney(item.amount)} status={item.status} detail={`Reference ${item.reference}`} action="Voir le recu" />)}
            {!payments.length ? <EmptyTab label="Aucun paiement enregistre." /> : null}
          </div>
        ) : null}

        {activeTab === "attendance" ? (
          <div className="grid gap-3">
            <div className="rounded-xl bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Presences</h2><p className="mt-2 text-3xl font-black">{participationRate} %</p><p className="text-sm font-semibold text-slate-500">{participations.filter((item) => item.status === "Present").length} presents, {participations.filter((item) => item.status === "Absent").length} absence.</p></div>
            {participations.map((item) => <DataCard key={item.title} title={item.title} subtitle={formatDate(item.date)} value={item.status} status={item.status} detail="Historique de presence" />)}
            {!participations.length ? <EmptyTab label="Aucune presence enregistree." /> : null}
          </div>
        ) : null}

        {activeTab === "events" ? (
          <div className="grid gap-3">
            {events.map((item) => <DataCard key={`${item.title}-${item.date}`} title={item.title} subtitle={`${formatDate(item.date)} - ${item.time} - ${item.location}`} value={item.participation} status={item.past ? "Passe" : "A venir"} detail={item.past ? "Evenement passe" : "Inscription ouverte"} />)}
            {!events.length ? <EmptyTab label="Aucun evenement rattache a votre profil." /> : null}
          </div>
        ) : null}

        {activeTab === "documents" ? (
          <div className="grid gap-3">
            {documents.map((item) => <DataCard key={item.name} title={item.name} subtitle={`${item.type} - ${item.size}`} value={item.category} status="Disponible" detail="Apercu et telechargement autorises" action="Telecharger" />)}
            {!documents.length ? <EmptyTab label="Aucun document disponible." /> : null}
          </div>
        ) : null}

        {activeTab === "history" ? (
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Mon historique</h2>
            <div className="mt-5 grid gap-5">
              <EmptyTab label="Aucun historique disponible." />
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function DataCard({ title, subtitle, value, status, detail, action }: Readonly<{ title: string; subtitle: string; value: string; status: string; detail: string; action?: string }>) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-black tracking-normal">{title}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">{status}</span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <strong className="text-xl font-black">{value}</strong>
        {action ? <Button type="button" variant="outline"><Download className="size-4" /> {action}</Button> : null}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-500">{detail}</p>
    </article>
  );
}

function EmptyTab({ label }: Readonly<{ label: string }>) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500 shadow-sm">
      {label}
    </div>
  );
}
