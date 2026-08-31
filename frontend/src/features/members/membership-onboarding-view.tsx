"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bell, CheckCircle2, Clock3, Copy, FileText, Grid2X2, Link2, Mail, MessageCircle, Search, Send, ShieldCheck, UserCheck, UserPlus, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ApplicationStatus = "pending" | "under_review" | "approved" | "rejected" | "cancelled" | "expired";

type MembershipApplication = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  occupation: string;
  city: string;
  message: string;
  status: ApplicationStatus;
  source: "Formulaire public" | "Invitation" | "Admin";
  submittedAt: string;
  reviewedBy?: string;
  internalNote?: string;
};

const initialApplications: MembershipApplication[] = [
  {
    id: "APP-001",
    firstName: "Mariam",
    lastName: "Kone",
    email: "mariam.kone@example.com",
    phone: "+225 07 44 12 18 90",
    occupation: "Entrepreneure",
    city: "Abidjan",
    message: "Je souhaite contribuer aux actions communautaires et participer aux projets terrain.",
    status: "pending",
    source: "Formulaire public",
    submittedAt: "2026-08-29"
  },
  {
    id: "APP-002",
    firstName: "Samuel",
    lastName: "Brou",
    email: "samuel.brou@example.com",
    phone: "+225 05 19 33 01 20",
    occupation: "Juriste",
    city: "Yamoussoukro",
    message: "Disponible pour soutenir les commissions administratives.",
    status: "under_review",
    source: "Invitation",
    submittedAt: "2026-08-28",
    reviewedBy: "Awa Traore"
  },
  {
    id: "APP-003",
    firstName: "Helene",
    lastName: "Ndiaye",
    email: "helene.ndiaye@example.com",
    phone: "+221 77 511 22 10",
    occupation: "Formatrice",
    city: "Dakar",
    message: "Je veux rejoindre l'association pour animer des ateliers.",
    status: "approved",
    source: "Admin",
    submittedAt: "2026-08-25",
    reviewedBy: "President"
  }
];

const statusLabels: Record<ApplicationStatus, string> = {
  pending: "En attente",
  under_review: "En cours",
  approved: "Approuvee",
  rejected: "Refusee",
  cancelled: "Annulee",
  expired: "Expiree"
};

const statusClass: Record<ApplicationStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  under_review: "bg-blue-50 text-blue-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  cancelled: "bg-slate-100 text-slate-600",
  expired: "bg-slate-900 text-white"
};

type InvitationDraft = {
  name: string;
  email: string;
  phone: string;
  function: string;
  message: string;
};

function BackButton({ label = "Retour" }: Readonly<{ label?: string }>) {
  const router = useRouter();

  return (
    <button className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-white px-3 text-sm font-black text-slate-700 shadow-sm" type="button" onClick={() => router.back()}>
      <ArrowLeft className="size-4" />
      {label}
    </button>
  );
}

function whatsappHref(phone: string, message: string) {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function mailHref(email: string, subject: string, body: string) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function MembershipApplicationsView() {
  const [applications, setApplications] = useState(initialApplications);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");
  const [selectedId, setSelectedId] = useState(initialApplications[0]?.id || "");
  const selected = applications.find((application) => application.id === selectedId) || applications[0];

  const visibleApplications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return applications.filter((application) => {
      const matchesQuery = !normalizedQuery || `${application.firstName} ${application.lastName} ${application.email} ${application.phone}`.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === "all" || application.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [applications, query, statusFilter]);

  const kpis = [
    ["Candidatures", applications.length.toString(), FileText],
    ["En attente", applications.filter((item) => item.status === "pending").length.toString(), Clock3],
    ["A traiter", applications.filter((item) => item.status === "under_review").length.toString(), UserCheck],
    ["Approuvees", applications.filter((item) => item.status === "approved").length.toString(), CheckCircle2]
  ] as const;

  function updateStatus(id: string, status: ApplicationStatus) {
    setApplications((current) => current.map((application) => (application.id === id ? { ...application, status, reviewedBy: status === "pending" ? application.reviewedBy : "President" } : application)));
  }

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-4 pb-28 pt-4 text-slate-950 md:px-8">
      <BackButton />
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Grid2X2 className="size-6" />
          <strong className="text-sm">NOVEX</strong>
        </div>
        <button className="grid size-10 place-items-center rounded-full bg-white shadow-sm" type="button" aria-label="Notifications">
          <Bell className="size-5" />
        </button>
      </header>

      <section>
        <p className="text-xs font-black uppercase text-blue-700">Adhesion membres</p>
        <h1 className="mt-2 text-3xl font-black leading-tight tracking-normal">Demandes d'adhesion</h1>
        <p className="mt-2 text-sm font-medium leading-5 text-slate-600">Validez les candidats avant de les activer comme membres officiels.</p>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(([label, value, Icon]) => (
          <div className="min-h-28 rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={label}>
            <div className="flex items-start justify-between">
              <span className="text-xs font-bold text-slate-600">{label}</span>
              <Icon className="size-8 text-slate-200" />
            </div>
            <div className="mt-3 text-3xl font-black tracking-normal">{value}</div>
          </div>
        ))}
      </section>

      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px]">
        <label className="flex min-h-12 items-center gap-3 rounded-md border border-slate-300 bg-white px-4 shadow-sm">
          <Search className="size-5 text-slate-500" />
          <input className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-slate-500" placeholder="Rechercher nom, email, telephone..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <select className="min-h-12 rounded-md border border-slate-300 bg-white px-4 text-sm font-bold outline-none" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ApplicationStatus | "all")}>
          <option value="all">Tous les statuts</option>
          {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </div>

      <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-3">
          {visibleApplications.length ? visibleApplications.map((application) => (
            <button className={`rounded-lg border bg-white p-4 text-left shadow-sm transition ${selected?.id === application.id ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-200"}`} type="button" key={application.id} onClick={() => setSelectedId(application.id)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black tracking-normal">{application.firstName} {application.lastName}</h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{application.source} - {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(application.submittedAt))}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[11px] font-black ${statusClass[application.status]}`}>{statusLabels[application.status]}</span>
              </div>
              <div className="mt-3 grid gap-1 text-sm font-semibold text-slate-600">
                <span>{application.phone}</span>
                <span>{application.email}</span>
              </div>
            </button>
          )) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
              <h2 className="text-lg font-black">Aucune candidature</h2>
              <p className="mt-2 text-sm font-medium text-slate-500">Les nouvelles demandes apparaitront ici.</p>
            </div>
          )}
        </div>

        {selected ? (
          <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-blue-700">Detail candidature</p>
                <h2 className="mt-2 text-2xl font-black tracking-normal">{selected.firstName} {selected.lastName}</h2>
              </div>
              <span className={`rounded-full px-2 py-1 text-[11px] font-black ${statusClass[selected.status]}`}>{statusLabels[selected.status]}</span>
            </div>
            <div className="mt-5 grid gap-3 text-sm font-semibold text-slate-600">
              <p><strong className="text-slate-950">Telephone :</strong> {selected.phone}</p>
              <p><strong className="text-slate-950">Email :</strong> {selected.email}</p>
              <p><strong className="text-slate-950">Ville :</strong> {selected.city}</p>
              <p><strong className="text-slate-950">Profession :</strong> {selected.occupation}</p>
              <p className="rounded-lg bg-slate-50 p-3 leading-6">{selected.message}</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" onClick={() => updateStatus(selected.id, "under_review")}><UserCheck className="size-4" /> Review</Button>
              <Button type="button" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => updateStatus(selected.id, "approved")}><CheckCircle2 className="size-4" /> Approuver</Button>
              <Button type="button" variant="destructive" onClick={() => updateStatus(selected.id, "rejected")}><XCircle className="size-4" /> Refuser</Button>
              <Button type="button" variant="outline" onClick={() => updateStatus(selected.id, "cancelled")}><X className="size-4" /> Annuler</Button>
            </div>
            <div className="mt-5 rounded-lg bg-slate-950 p-4 text-white">
              <p className="text-sm font-black">Historique</p>
              <p className="mt-2 text-xs font-medium text-white/70">Candidature recue le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(selected.submittedAt))}.</p>
              {selected.reviewedBy ? <p className="mt-1 text-xs font-medium text-white/70">Prise en charge par {selected.reviewedBy}.</p> : null}
            </div>
          </aside>
        ) : null}
      </section>
    </main>
  );
}

export function MemberInvitationsView() {
  const [copied, setCopied] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [invitationDraft, setInvitationDraft] = useState<InvitationDraft | null>(null);
  const [invitations, setInvitations] = useState([
    { name: "Grace Kouame", email: "grace.kouame@example.com", phone: "+225 07 21 31 41 51", function: "Membre", status: "En attente", expires: "7 jours" },
    { name: "Eric Toure", email: "eric.toure@example.com", phone: "+225 05 22 18 41 00", function: "Commission projet", status: "Envoyee", expires: "5 jours" }
  ]);
  const publicLink = "https://novex.app/join/association-demo";
  const invitationMessage = invitationDraft
    ? `${invitationDraft.name}, vous etes invite(e) a rejoindre notre association sur NOVEX. ${publicLink}${invitationDraft.message ? `\n\nMessage : ${invitationDraft.message}` : ""}`
    : "";

  function addInvitation(formData: FormData) {
    const name = `${formData.get("firstName") || ""} ${formData.get("lastName") || ""}`.trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const memberFunction = String(formData.get("function") || "Membre").trim();
    const message = String(formData.get("message") || "").trim();
    if (!name || (!email && !phone)) {
      return;
    }
    setInvitations((current) => [{ name, email, phone, function: memberFunction || "Membre", status: "En attente", expires: "7 jours" }, ...current]);
    setInvitationDraft({ name, email, phone, function: memberFunction || "Membre", message });
  }

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-4 pb-28 pt-4 text-slate-950 md:px-8">
      <BackButton />
      <section className="rounded-xl bg-slate-950 p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full bg-white/15"><Link2 className="size-5" /></div>
          <div>
            <p className="text-xs font-bold text-white/65">Lien public d'adhesion</p>
            <h1 className="text-2xl font-black tracking-normal">Inviter et partager</h1>
          </div>
        </div>
        <div className="mt-5 rounded-lg bg-white/10 p-3 text-sm font-semibold text-white/80">{publicLink}</div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button type="button" className="bg-white text-slate-950 hover:bg-slate-100" onClick={() => { navigator.clipboard?.writeText(publicLink); setCopied(true); }}><Copy className="size-4" /> Copier</Button>
          <Button type="button" className="bg-blue-700 text-white hover:bg-blue-800" onClick={() => setShowForm(true)}><Send className="size-4" /> Inviter</Button>
        </div>
        {copied ? <p className="mt-3 text-xs font-bold text-emerald-200">Lien copie.</p> : null}
      </section>

      <section className="mt-5 grid gap-3">
        {invitations.map((invitation) => (
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={`${invitation.name}-${invitation.email || invitation.phone}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black tracking-normal">{invitation.name}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{invitation.email || invitation.phone}</p>
              </div>
              <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">{invitation.status}</span>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm font-bold text-slate-600">
              <span>{invitation.function}</span>
              <span>Expire dans {invitation.expires}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button type="button" variant="outline"><Mail className="size-4" /> Renvoyer</Button>
              <Button type="button" variant="outline"><X className="size-4" /> Annuler</Button>
            </div>
          </article>
        ))}
      </section>

      {showForm ? (
        <section className="fixed inset-0 z-40 grid place-items-end bg-slate-950/35 px-4 pb-24 md:place-items-center md:pb-0">
          <form className="w-full rounded-2xl bg-white p-5 shadow-2xl md:max-w-md" onSubmit={(event) => { event.preventDefault(); addInvitation(new FormData(event.currentTarget)); }}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-normal">Nouvelle invitation</h2>
              <button className="grid size-9 place-items-center rounded-full bg-slate-100" type="button" aria-label="Fermer" onClick={() => setShowForm(false)}><X className="size-5" /></button>
            </div>
            {invitationDraft ? (
              <div className="grid gap-4">
                <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800">
                  <h3 className="text-lg font-black">Invitation prete</h3>
                  <p className="mt-2 text-sm font-semibold">Choisissez le canal d'envoi pour {invitationDraft.name}.</p>
                </div>
                {invitationDraft.phone ? (
                  <Button asChild className="min-h-12 bg-emerald-600 text-white hover:bg-emerald-700">
                    <a href={whatsappHref(invitationDraft.phone, invitationMessage)} target="_blank" rel="noreferrer">
                      <MessageCircle className="size-5" />
                      Envoyer par WhatsApp
                    </a>
                  </Button>
                ) : null}
                {invitationDraft.email ? (
                  <Button asChild className="min-h-12 bg-blue-700 text-white hover:bg-blue-800">
                    <a href={mailHref(invitationDraft.email, "Invitation NOVEX", invitationMessage)}>
                      <Mail className="size-5" />
                      Envoyer par mail
                    </a>
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={() => { setInvitationDraft(null); setShowForm(false); }}>Terminer</Button>
              </div>
            ) : (
              <>
                <div className="grid gap-4">
                  <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" name="firstName" placeholder="Prenom" required />
                  <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" name="lastName" placeholder="Nom" required />
                  <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" name="phone" placeholder="Telephone WhatsApp ex: +2250700000000" />
                  <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" name="email" type="email" placeholder="Email du destinataire" />
                  <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" name="function" placeholder="Fonction eventuelle" />
                  <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-3 text-base outline-none" name="message" placeholder="Message" />
                </div>
                <Button className="mt-6 min-h-12 w-full bg-blue-700 text-white hover:bg-blue-800" type="submit">Preparer l'envoi <ArrowRight className="size-4" /></Button>
              </>
            )}
          </form>
        </section>
      ) : null}
    </main>
  );
}

export function MembershipApplicationDetailView({ applicationId }: Readonly<{ applicationId: string }>) {
  const application = initialApplications.find((item) => item.id === applicationId) || initialApplications[0];
  const [status, setStatus] = useState<ApplicationStatus>(application.status);

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-4 pb-28 pt-4 text-slate-950 md:px-8">
      <BackButton />
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase text-blue-700">Candidature {application.id}</p>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-normal">{application.firstName} {application.lastName}</h1>
            <p className="mt-2 text-sm font-semibold text-slate-500">{application.source} - {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(application.submittedAt))}</p>
          </div>
          <span className={`rounded-full px-2 py-1 text-[11px] font-black ${statusClass[status]}`}>{statusLabels[status]}</span>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black tracking-normal">Informations candidat</h2>
          <div className="mt-5 grid gap-3 text-sm font-semibold text-slate-600 md:grid-cols-2">
            <p><strong className="text-slate-950">Email :</strong> {application.email}</p>
            <p><strong className="text-slate-950">Telephone :</strong> {application.phone}</p>
            <p><strong className="text-slate-950">Ville :</strong> {application.city}</p>
            <p><strong className="text-slate-950">Profession :</strong> {application.occupation}</p>
          </div>
          <div className="mt-5 rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-950">Motivation</p>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{application.message}</p>
          </div>
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black tracking-normal">Traitement</h2>
          <div className="mt-5 grid gap-3">
            <Button type="button" variant="outline" onClick={() => setStatus("under_review")}><UserCheck className="size-4" /> Prendre en charge</Button>
            <Button type="button" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setStatus("approved")}><CheckCircle2 className="size-4" /> Approuver</Button>
            <Button type="button" variant="destructive" onClick={() => setStatus("rejected")}><XCircle className="size-4" /> Refuser</Button>
            <Button type="button" variant="outline" onClick={() => setStatus("cancelled")}><X className="size-4" /> Annuler</Button>
          </div>
          <div className="mt-5 rounded-lg bg-slate-950 p-4 text-white">
            <p className="text-sm font-black">Historique interne</p>
            <p className="mt-2 text-xs font-medium text-white/70">Creation de la candidature.</p>
            <p className="mt-1 text-xs font-medium text-white/70">Statut courant : {statusLabels[status]}.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}

export function PublicMembershipFormView({ slug }: Readonly<{ slug: string }>) {
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="min-h-screen bg-[#0b1220] px-4 py-6 text-slate-950">
      <BackButton />
      <section className="mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-md flex-col justify-center rounded-2xl bg-white p-6 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-blue-50 text-blue-700"><ShieldCheck className="size-7" /></div>
          <h1 className="mt-5 text-4xl font-black tracking-normal">NOVEX</h1>
          <p className="mt-3 text-lg font-bold">Rejoindre l'association</p>
          <p className="mt-2 text-sm font-medium text-slate-500">Formulaire public securise pour {slug}.</p>
        </div>
        {submitted ? (
          <div className="mt-8 rounded-xl bg-emerald-50 p-5 text-center">
            <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
            <h2 className="mt-3 text-xl font-black">Demande envoyee</h2>
            <p className="mt-2 text-sm font-medium text-emerald-700">L'association examinera votre candidature avant activation.</p>
          </div>
        ) : (
          <form className="mt-8 grid gap-4" onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }}>
            <div className="grid grid-cols-2 gap-3">
              <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" required placeholder="Prenom" />
              <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" required placeholder="Nom" />
            </div>
            <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" type="email" placeholder="Email" />
            <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" required placeholder="Telephone" />
            <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" placeholder="Profession" />
            <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" placeholder="Ville" />
            <textarea className="min-h-28 rounded-md border border-slate-300 px-3 py-3 text-base outline-none" placeholder="Motivation" />
            <input className="hidden" name="website" tabIndex={-1} autoComplete="off" />
            <Button className="min-h-12 w-full bg-blue-700 text-white hover:bg-blue-800" type="submit">Envoyer ma demande <ArrowRight className="size-4" /></Button>
          </form>
        )}
      </section>
    </main>
  );
}

export function InvitationAcceptanceView({ token }: Readonly<{ token: string }>) {
  const [status, setStatus] = useState<"pending" | "accepted" | "declined">("pending");

  return (
    <main className="min-h-screen bg-[#0b1220] px-4 py-6 text-slate-950">
      <BackButton />
      <section className="mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-md flex-col justify-center rounded-2xl bg-white p-6 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-blue-50 text-blue-700"><UserPlus className="size-7" /></div>
          <h1 className="mt-5 text-4xl font-black tracking-normal">NOVEX</h1>
          <p className="mt-3 text-lg font-bold">Invitation membre</p>
          <p className="mt-2 text-sm font-medium text-slate-500">Association demo vous invite a rejoindre son espace securise.</p>
        </div>
        <div className="mt-8 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
          <p>Token securise : {token.slice(0, 8)}...</p>
          <p className="mt-2">Message : bienvenue dans l'association.</p>
        </div>
        {status === "pending" ? (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" onClick={() => setStatus("declined")}><X className="size-4" /> Refuser</Button>
            <Button type="button" className="bg-blue-700 text-white hover:bg-blue-800" onClick={() => setStatus("accepted")}><CheckCircle2 className="size-4" /> Accepter</Button>
          </div>
        ) : (
          <div className={`mt-6 rounded-xl p-5 text-center ${status === "accepted" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            <h2 className="text-xl font-black">{status === "accepted" ? "Invitation acceptee" : "Invitation refusee"}</h2>
            <p className="mt-2 text-sm font-medium">{status === "accepted" ? "Votre acces membre est en cours d'activation." : "L'association sera informee de votre choix."}</p>
          </div>
        )}
      </section>
    </main>
  );
}
