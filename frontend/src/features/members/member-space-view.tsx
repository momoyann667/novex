"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, CheckCircle2, CreditCard, Download, Edit3, FileText, IdCard, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayUserName, getCurrentUser, userInitials } from "@/features/auth/current-user";
import { getWorkspaceSettings } from "@/features/workspace/api";

type Tab = "profile" | "contributions" | "payments" | "attendance" | "events" | "documents" | "history";

type SelfMemberProfile = {
  workspace_name: string;
  workspace_currency: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone_country_code: string;
  phone: string;
  function: string;
  status: string;
  membership_number: string;
  join_date: string;
  occupation: string;
  city: string;
  photo: string;
  profile_completion?: {
    percentage?: number;
  };
};

type MoneyAmount = {
  value: string | number;
  currency: string;
};

type SelfMemberDashboard = {
  profile: {
    id: number;
    full_name: string;
    first_name: string;
    last_name: string;
    function: string;
    status: string;
    membership_number: string;
    join_date: string;
    photo: string;
    profile_completion?: { percentage?: number };
  };
  contribution_summary: {
    total_due: MoneyAmount;
    total_paid: MoneyAmount;
    remaining_to_pay: MoneyAmount;
    payment_rate: string | number;
    overdue_count: number;
    next_due_date: string | null;
  };
  contributions: Array<{
    id: number;
    campaign: string;
    period_label: string;
    amount_due: string | number;
    amount_paid: string | number;
    remaining_amount: string | number;
    currency: string;
    due_date: string | null;
    status: string;
    paid_at: string | null;
  }>;
  payment_summary: {
    total_paid: MoneyAmount;
    successful_count: number;
    pending_count: number;
    failed_count: number;
  };
  payments: Array<{
    id: number;
    reference: string;
    amount: string | number;
    currency: string;
    method: string;
    provider: string;
    status: string;
    reason: string;
    paid_at: string | null;
    created_at: string;
    receipt_number: string;
    receipt_url: string;
  }>;
  attendance_summary: {
    participated: number;
    missed: number;
    participation_rate: string | number;
  };
  events: {
    upcoming: Array<{ id: number; title: string; start_at: string; location: string; participation_status: string; attendance_status: string }>;
    past: Array<{ id: number; title: string; start_at: string; location: string; participation_status: string; attendance_status: string }>;
  };
  documents: Array<{ id: number; name: string; file_type: string; size: number; category: string; download_url: string }>;
  history: Array<{ date: string; type: string; title: string; detail: string }>;
  alerts: Array<{ type: string; message: string; amount?: string | number; currency?: string; date?: string }>;
};

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "profile", label: "Profil" },
  { id: "contributions", label: "Cotisations" },
  { id: "payments", label: "Paiements" },
  { id: "attendance", label: "Presences" },
  { id: "events", label: "Evenements" },
  { id: "documents", label: "Documents" },
  { id: "history", label: "Historique" }
];

function numberValue(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatMoney(value: unknown, currency = "FCFA") {
  return `${numberValue(value).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ${currency}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Non definie";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(value));
}

function statusLabel(status: string) {
  return {
    PAID: "Payee",
    PARTIALLY_PAID: "Partielle",
    PENDING: "En attente",
    OVERDUE: "En retard",
    WAIVED: "Exoneree",
    CANCELLED: "Annulee",
    SUCCESS: "Reussi",
    PROCESSING: "En cours",
    FAILED: "Echoue",
    CANCELLED_PAYMENT: "Annule"
  }[status] || status || "En attente";
}

function paymentMethodLabel(method: string) {
  return {
    CASH: "Especes",
    MOBILE_MONEY: "Mobile Money",
    WAVE: "Wave",
    BANK_TRANSFER: "Virement",
    CHECK: "Cheque",
    MANUAL: "Manuel",
    AGGREGATOR: "Agregateur",
    CARD: "Carte bancaire"
  }[method] || method || "Paiement";
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function getSelfMemberProfile(workspaceSlug: string) {
  return fetch(`/api/backend/me/member/`, {
    credentials: "include",
    headers: { "X-Workspace": workspaceSlug },
    cache: "no-store"
  }).then(async (response) => {
    if (!response.ok) return null;
    return (await response.json()) as SelfMemberProfile;
  });
}

function getSelfMemberDashboard(workspaceSlug: string) {
  return fetch(`/api/backend/me/member/dashboard/`, {
    credentials: "include",
    headers: { "X-Workspace": workspaceSlug },
    cache: "no-store"
  }).then(async (response) => {
    if (!response.ok) return null;
    return (await response.json()) as SelfMemberDashboard;
  });
}

export function MemberSpaceView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [isEditing, setIsEditing] = useState(false);
  const userQuery = useQuery({ queryKey: ["current-user", workspaceSlug], queryFn: () => getCurrentUser(workspaceSlug), retry: false });
  const selfMemberQuery = useQuery({
    queryKey: ["self-member-profile", workspaceSlug],
    queryFn: () => getSelfMemberProfile(workspaceSlug),
    retry: false
  });
  const memberDashboardQuery = useQuery({
    queryKey: ["self-member-dashboard", workspaceSlug],
    queryFn: () => getSelfMemberDashboard(workspaceSlug),
    retry: false
  });
  const settingsQuery = useQuery({
    queryKey: ["workspace-settings", workspaceSlug],
    queryFn: () => getWorkspaceSettings(workspaceSlug),
    retry: false
  });
  const user = userQuery.data;
  const member = selfMemberQuery.data;
  const dashboard = memberDashboardQuery.data;
  const dashboardProfile = dashboard?.profile;
  const fullName = member?.full_name || displayUserName(user);
  const firstName = member?.first_name || user?.profile?.first_name || fullName.split(" ")[0] || "Utilisateur";
  const lastName = member?.last_name || user?.profile?.last_name || "";
  const workspaceName = settingsQuery.data?.workspace_name || member?.workspace_name || "Association";
  const contributions = dashboard?.contributions || [];
  const payments = dashboard?.payments || [];
  const documents = dashboard?.documents || [];
  const upcomingEvents = dashboard?.events?.upcoming || [];
  const pastEvents = dashboard?.events?.past || [];
  const alerts = dashboard?.alerts || [];
  const contributionSummary = dashboard?.contribution_summary;
  const paymentSummary = dashboard?.payment_summary;
  const attendanceSummary = dashboard?.attendance_summary;
  const currency = contributionSummary?.total_due?.currency || member?.workspace_currency || "FCFA";
  const profile = {
    firstName: dashboardProfile?.first_name || firstName,
    lastName: dashboardProfile?.last_name || lastName,
    fullName: dashboardProfile?.full_name || fullName,
    initials: dashboardProfile?.full_name ? initialsFromName(dashboardProfile.full_name) : member?.full_name ? initialsFromName(member.full_name) : userInitials(user),
    email: member?.email || user?.email || "",
    phone: `${member?.phone_country_code || ""}${member?.phone || user?.phone || ""}`,
    joinedAt: dashboardProfile?.join_date || member?.join_date || new Date().toISOString().slice(0, 10),
    membershipNumber: dashboardProfile?.membership_number || member?.membership_number || "A creer",
    function: dashboardProfile?.function || member?.function || "Membre",
    status: dashboardProfile?.status === "active" || member?.status === "active" ? "Actif" : dashboardProfile?.status || member?.status || "Actif",
    occupation: member?.occupation || "",
    city: member?.city || "",
    completion: dashboardProfile?.profile_completion?.percentage ?? member?.profile_completion?.percentage ?? (user?.email ? 40 : 0),
    photoUrl: dashboardProfile?.photo || member?.photo || user?.profile?.avatar || ""
  };
  const totalDue = numberValue(contributionSummary?.total_due?.value);
  const totalPaid = numberValue(contributionSummary?.total_paid?.value);
  const remaining = numberValue(contributionSummary?.remaining_to_pay?.value);
  const contributionRate = Math.round(numberValue(contributionSummary?.payment_rate));
  const participationRate = Math.round(numberValue(attendanceSummary?.participation_rate));

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
            <div className="grid size-10 place-items-center rounded-full bg-[#0f2347] text-sm font-black text-white">{workspaceName[0]?.toUpperCase() || "A"}</div>
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
          ["Cotisations", remaining === 0 ? "A jour" : formatMoney(remaining, currency), CreditCard],
          ["Paiements", formatMoney(paymentSummary?.total_paid?.value, paymentSummary?.total_paid?.currency || currency), CreditCard],
          ["Participation", `${participationRate} %`, CalendarDays],
          ["Documents", documents.length.toString(), FileText]
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
          {remaining ? <p>Vos cotisations affichent un reste total de {formatMoney(remaining, currency)}.</p> : <p>Vos cotisations sont a jour.</p>}
          {contributionSummary?.overdue_count ? <p>{contributionSummary.overdue_count} cotisation(s) en retard.</p> : null}
          {contributionSummary?.next_due_date ? <p>Prochaine echeance le {formatDate(contributionSummary.next_due_date)}.</p> : null}
          {upcomingEvents.length ? <p>Prochain evenement prevu le {formatDate(upcomingEvents[0].start_at)}.</p> : <p>Aucun evenement lie a votre profil pour le moment.</p>}
          {profile.completion < 100 ? <p>Votre profil est complete a {profile.completion} %.</p> : null}
          {alerts.map((alert, index) => <p key={`${alert.type}-${index}`}>{alert.message}</p>)}
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
                {[`Nom: ${profile.lastName || "A completer"}`, `Prenoms: ${profile.firstName || "A completer"}`, `Telephone: ${profile.phone || "A completer"}`, `Email: ${profile.email || "A completer"}`, `Ville: ${profile.city || "A completer"}`, `Profession: ${profile.occupation || "A completer"}`].map((item) => <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600" key={item}>{item}</p>)}
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
              <div className="flex items-end justify-between"><h2 className="text-xl font-black">Cotisations</h2><strong>{contributionRate} %</strong></div>
              <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${contributionRate}%` }} /></div>
              <p className="mt-3 text-sm font-semibold text-slate-600">{formatMoney(totalPaid, currency)} paye sur {formatMoney(totalDue, currency)}. Reste : {formatMoney(remaining, currency)}.</p>
            </div>
            {contributions.map((item) => (
              <DataCard
                key={item.id}
                title={item.campaign}
                subtitle={`${item.period_label || "Cotisation"} - paye ${formatMoney(item.amount_paid, item.currency || currency)}`}
                value={formatMoney(item.remaining_amount, item.currency || currency)}
                status={statusLabel(item.status)}
                detail={`Echeance ${formatDate(item.due_date)}`}
              />
            ))}
            {!contributions.length ? <EmptyTab label="Aucune cotisation rattachee a votre profil." /> : null}
            <Button asChild className="min-h-12 bg-blue-700 text-white hover:bg-blue-800"><Link href={`/app/${workspaceSlug}/payments`}>Payer ma cotisation</Link></Button>
          </div>
        ) : null}

        {activeTab === "payments" ? (
          <div className="grid gap-3">
            {payments.map((item) => <DataCard key={item.id} title={item.reason} subtitle={`${paymentMethodLabel(item.method)} - ${formatDate(item.paid_at || item.created_at)}`} value={formatMoney(item.amount, item.currency || currency)} status={statusLabel(item.status)} detail={`Reference ${item.reference}`} action={item.receipt_url ? "Voir le recu" : undefined} href={item.receipt_url || undefined} />)}
            {!payments.length ? <EmptyTab label="Aucun paiement enregistre." /> : null}
          </div>
        ) : null}

        {activeTab === "attendance" ? (
          <div className="grid gap-3">
            <div className="rounded-xl bg-white p-5 shadow-sm"><h2 className="text-xl font-black">Presences</h2><p className="mt-2 text-3xl font-black">{participationRate} %</p><p className="text-sm font-semibold text-slate-500">{attendanceSummary?.participated || 0} presence(s), {attendanceSummary?.missed || 0} absence(s).</p></div>
            {[...upcomingEvents, ...pastEvents].map((item) => <DataCard key={item.id} title={item.title} subtitle={formatDate(item.start_at)} value={statusLabel(item.attendance_status)} status={statusLabel(item.participation_status)} detail={item.location || "Lieu non renseigne"} />)}
            {!upcomingEvents.length && !pastEvents.length ? <EmptyTab label="Aucune presence enregistree." /> : null}
          </div>
        ) : null}

        {activeTab === "events" ? (
          <div className="grid gap-3">
            {upcomingEvents.map((item) => <DataCard key={`upcoming-${item.id}`} title={item.title} subtitle={`${formatDate(item.start_at)} - ${item.location || "Lieu non renseigne"}`} value={statusLabel(item.participation_status)} status="A venir" detail="Evenement a venir" />)}
            {pastEvents.map((item) => <DataCard key={`past-${item.id}`} title={item.title} subtitle={`${formatDate(item.start_at)} - ${item.location || "Lieu non renseigne"}`} value={statusLabel(item.participation_status)} status="Passe" detail="Evenement passe" />)}
            {!upcomingEvents.length && !pastEvents.length ? <EmptyTab label="Aucun evenement rattache a votre profil." /> : null}
          </div>
        ) : null}

        {activeTab === "documents" ? (
          <div className="grid gap-3">
            {documents.map((item) => <DataCard key={item.id} title={item.name} subtitle={`${item.file_type} - ${item.size || 0} octets`} value={item.category || "Document"} status="Disponible" detail="Apercu et telechargement autorises" action={item.download_url ? "Telecharger" : undefined} href={item.download_url || undefined} />)}
            {!documents.length ? <EmptyTab label="Aucun document disponible." /> : null}
          </div>
        ) : null}

        {activeTab === "history" ? (
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black">Mon historique</h2>
            <div className="mt-5 grid gap-5">
              {dashboard?.history.map((item, index) => <DataCard key={`${item.type}-${index}`} title={item.title} subtitle={formatDate(item.date)} value={item.type} status="Historique" detail={item.detail} />)}
              {!dashboard?.history.length ? <EmptyTab label="Aucun historique disponible." /> : null}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function DataCard({ title, subtitle, value, status, detail, action, href }: Readonly<{ title: string; subtitle: string; value: string; status: string; detail: string; action?: string; href?: string }>) {
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
        {action && href ? <Button asChild type="button" variant="outline"><a href={href}><Download className="size-4" /> {action}</a></Button> : null}
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
