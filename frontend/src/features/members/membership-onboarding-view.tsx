"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Bell, CheckCircle2, Clock3, Copy, FileText, Link2, MessageCircle, Search, Send, ShieldCheck, UserCheck, UserPlus, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api/client";
import { workspacePath } from "@/lib/workspace/routing";

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

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type InvitationResource = {
  id: number;
  member: number | null;
  first_name: string;
  last_name: string;
  invitee_name: string;
  email: string;
  phone: string;
  function: string;
  message: string;
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  expires_at: string;
  accept_url: string | null;
  created_at: string;
};

type MemberResource = {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  function: string;
  status: string;
};

function workspaceHeaders(workspaceSlug: string) {
  return { "X-Workspace": workspaceSlug };
}

function unwrapPaginated<T>(payload: T[] | Paginated<T>) {
  return Array.isArray(payload) ? payload : payload.results;
}

async function listMembers(workspaceSlug: string) {
  const payload = await apiFetch<MemberResource[] | Paginated<MemberResource>>("/members/?ordering=last_name&page_size=200", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
  return unwrapPaginated(payload);
}

async function listInvitations(workspaceSlug: string) {
  const payload = await apiFetch<InvitationResource[] | Paginated<InvitationResource>>("/members/invitations/?page_size=200", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
  return unwrapPaginated(payload);
}

async function createInvitation(workspaceSlug: string, payload: Partial<InvitationResource> & { member_id?: number }) {
  return apiFetch<InvitationResource>("/members/invitations/", {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify(payload)
  });
}

async function cancelInvitation(workspaceSlug: string, invitationId: number) {
  return apiFetch<InvitationResource>(`/members/invitations/${invitationId}/cancel/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug)
  });
}

async function resendInvitation(workspaceSlug: string, invitationId: number) {
  return apiFetch<InvitationResource>(`/members/invitations/${invitationId}/resend/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug)
  });
}

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

function invitationMessage(memberName: string, acceptUrl: string | null, workspaceSlug: string, customMessage = "") {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const link = acceptUrl ? `${baseUrl}${acceptUrl}` : `${baseUrl}${workspacePath(workspaceSlug, "members/invitations")}`;
  return `Bonjour ${memberName}, vous etes invite(e) a rejoindre l'association sur NOVEX. Cliquez ici : ${link}${customMessage ? `\n\nMessage : ${customMessage}` : ""}`;
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
          <img className="h-10 w-32 object-contain object-left" src="/brand/novex-logo.jpg" alt="NOVEX" />
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

export function MemberInvitationsView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [browserOrigin, setBrowserOrigin] = useState("");
  const publicLink = browserOrigin ? `${browserOrigin}/join/${workspaceSlug}` : `/join/${workspaceSlug}`;

  const membersQuery = useQuery({ queryKey: ["invitable-members", workspaceSlug], queryFn: () => listMembers(workspaceSlug) });
  const invitationsQuery = useQuery({ queryKey: ["member-invitations", workspaceSlug], queryFn: () => listInvitations(workspaceSlug) });

  const allInvitations = invitationsQuery.data || [];
  const invitations = allInvitations.filter((item) => item.status !== "accepted");
  const acceptedMemberIds = new Set(allInvitations.filter((item) => item.status === "accepted" && item.member).map((item) => item.member as number));
  const pendingMemberIds = new Set(allInvitations.filter((item) => item.status === "pending" && item.member).map((item) => item.member as number));
  const members = (membersQuery.data || []).filter((member) => member.status !== "archived" && !acceptedMemberIds.has(member.id));

  useEffect(() => {
    setBrowserOrigin(window.location.origin);
  }, []);

  const refreshInvitations = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["member-invitations", workspaceSlug] }),
      queryClient.invalidateQueries({ queryKey: ["invitable-members", workspaceSlug] })
    ]);
  };

  function openWhatsapp(member: { full_name?: string; first_name?: string; last_name?: string; phone?: string }, acceptUrl: string | null, customMessage = "") {
    const name = member.full_name || `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Membre";
    if (!member.phone) {
      setError("Ce membre n'a pas de numero WhatsApp enregistre.");
      return;
    }
    window.open(whatsappHref(member.phone, invitationMessage(name, acceptUrl, workspaceSlug, customMessage)), "_blank", "noopener,noreferrer");
  }

  const inviteMutation = useMutation({
    mutationFn: (member: MemberResource) => createInvitation(workspaceSlug, { member_id: member.id, message: "Bienvenue dans votre espace membre NOVEX." }),
    onSuccess: async (invitation, member) => {
      setError("");
      setNotice(`Invitation preparee pour ${member.full_name}.`);
      openWhatsapp(member, invitation.accept_url, invitation.message);
      await refreshInvitations();
    },
    onError: (mutationError) => setError(mutationError instanceof ApiError ? mutationError.message : "Impossible de creer l'invitation.")
  });

  const manualInviteMutation = useMutation({
    mutationFn: (payload: { first_name: string; last_name: string; email: string; phone: string; function: string; message: string }) => createInvitation(workspaceSlug, payload),
    onSuccess: async (invitation) => {
      setError("");
      setNotice(`Invitation preparee pour ${invitation.invitee_name}.`);
      openWhatsapp({ full_name: invitation.invitee_name, phone: invitation.phone }, invitation.accept_url, invitation.message);
      setManualOpen(false);
      await refreshInvitations();
    },
    onError: (mutationError) => setError(mutationError instanceof ApiError ? mutationError.message : "Impossible de creer l'invitation.")
  });

  const cancelMutation = useMutation({
    mutationFn: (invitationId: number) => cancelInvitation(workspaceSlug, invitationId),
    onSuccess: async () => {
      setNotice("Invitation annulee.");
      await refreshInvitations();
    },
    onError: (mutationError) => setError(mutationError instanceof ApiError ? mutationError.message : "Impossible d'annuler l'invitation.")
  });

  const resendMutation = useMutation({
    mutationFn: (invitation: InvitationResource) => resendInvitation(workspaceSlug, invitation.id),
    onSuccess: async (invitation) => {
      setNotice(`Invitation renvoyee a ${invitation.invitee_name}.`);
      openWhatsapp({ full_name: invitation.invitee_name, phone: invitation.phone }, invitation.accept_url, invitation.message);
      await refreshInvitations();
    },
    onError: (mutationError) => setError(mutationError instanceof ApiError ? mutationError.message : "Impossible de renvoyer l'invitation.")
  });

  function submitManualInvitation(formData: FormData) {
    const payload = {
      first_name: String(formData.get("firstName") || "").trim(),
      last_name: String(formData.get("lastName") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      function: String(formData.get("function") || "Membre").trim() || "Membre",
      message: String(formData.get("message") || "").trim()
    };
    if (!payload.first_name || !payload.last_name || !payload.phone) {
      setError("Nom, prenom et telephone WhatsApp sont requis.");
      return;
    }
    manualInviteMutation.mutate(payload);
  }

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-4 pb-28 pt-4 text-slate-950 md:px-8">
      <BackButton />
      {notice ? <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700">{notice}</p> : null}
      {error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-black text-red-700">{error}</p> : null}

      <section className="rounded-xl bg-slate-950 p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full bg-white/15"><Link2 className="size-5" /></div>
          <div>
            <p className="text-xs font-bold text-white/65">Lien public d'adhesion</p>
            <h1 className="text-2xl font-black tracking-normal">Inviter et partager</h1>
          </div>
        </div>
        <div className="mt-5 break-all rounded-lg bg-white/10 p-3 text-sm font-semibold text-white/80">{publicLink}</div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button type="button" className="bg-white text-slate-950 hover:bg-slate-100" onClick={() => { navigator.clipboard?.writeText(publicLink); setCopied(true); }}><Copy className="size-4" /> Copier</Button>
          <Button type="button" className="bg-blue-700 text-white hover:bg-blue-800" onClick={() => setManualOpen(true)}><Send className="size-4" /> Invitation libre</Button>
        </div>
        {copied ? <p className="mt-3 text-xs font-bold text-emerald-200">Lien copie.</p> : null}
      </section>

      <section className="mt-5 grid gap-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black tracking-normal">Membres a inviter</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Chaque ligne reprend le nom et le numero deja enregistres.</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 shadow-sm">{members.length}</span>
        </div>
        {membersQuery.isLoading ? <div className="rounded-lg bg-white p-5 text-sm font-bold text-slate-500">Chargement des membres...</div> : null}
        {!membersQuery.isLoading && members.map((member) => (
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={member.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black tracking-normal">{member.full_name}</h3>
                <p className="mt-1 truncate text-sm font-semibold text-slate-500">{member.phone || "Aucun numero"}</p>
                <p className="mt-1 truncate text-xs font-bold text-slate-400">{member.function || "Membre"}</p>
              </div>
              {pendingMemberIds.has(member.id) ? <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">Invite</span> : null}
            </div>
            <Button
              className="mt-4 min-h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              type="button"
              disabled={!member.phone || inviteMutation.isPending || pendingMemberIds.has(member.id)}
              onClick={() => inviteMutation.mutate(member)}
            >
              <MessageCircle className="size-4" />
              {pendingMemberIds.has(member.id) ? "Invitation en cours" : "Inviter par WhatsApp"}
            </Button>
          </article>
        ))}
        {!membersQuery.isLoading && !members.length ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <h3 className="text-lg font-black">Aucun membre a inviter</h3>
            <p className="mt-2 text-sm font-medium text-slate-500">Les membres acceptes ou deja invites ne s'affichent plus ici.</p>
          </div>
        ) : null}
      </section>

      <section className="mt-6 grid gap-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black tracking-normal">Invitations en cours</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Aucune donnee fictive n'est affichee.</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 shadow-sm">{invitations.length}</span>
        </div>
        {invitationsQuery.isLoading ? <div className="rounded-lg bg-white p-5 text-sm font-bold text-slate-500">Chargement des invitations...</div> : null}
        {!invitationsQuery.isLoading && invitations.map((invitation) => (
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={invitation.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black tracking-normal">{invitation.invitee_name}</h3>
                <p className="mt-1 truncate text-sm font-semibold text-slate-500">{invitation.phone || invitation.email}</p>
              </div>
              <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">{invitation.status === "pending" ? "En attente" : invitation.status}</span>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm font-bold text-slate-600">
              <span>{invitation.function || "Membre"}</span>
              <span>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(invitation.expires_at))}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" disabled={resendMutation.isPending} onClick={() => resendMutation.mutate(invitation)}><MessageCircle className="size-4" /> Renvoyer</Button>
              <Button type="button" variant="outline" disabled={cancelMutation.isPending || invitation.status !== "pending"} onClick={() => cancelMutation.mutate(invitation.id)}><X className="size-4" /> Annuler</Button>
            </div>
          </article>
        ))}
        {!invitationsQuery.isLoading && !invitations.length ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <h3 className="text-lg font-black">Aucune invitation</h3>
            <p className="mt-2 text-sm font-medium text-slate-500">Les invitations creees depuis vos membres apparaitront ici.</p>
          </div>
        ) : null}
      </section>

      {manualOpen ? (
        <section className="fixed inset-0 z-40 grid place-items-end bg-slate-950/35 px-4 pb-24 md:place-items-center md:pb-0">
          <form className="w-full rounded-2xl bg-white p-5 shadow-2xl md:max-w-md" onSubmit={(event) => { event.preventDefault(); submitManualInvitation(new FormData(event.currentTarget)); }}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-normal">Invitation libre</h2>
              <button className="grid size-9 place-items-center rounded-full bg-slate-100" type="button" aria-label="Fermer" onClick={() => setManualOpen(false)}><X className="size-5" /></button>
            </div>
            <div className="grid gap-4">
              <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" name="firstName" placeholder="Prenom" required />
              <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" name="lastName" placeholder="Nom" required />
              <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" name="phone" placeholder="Telephone WhatsApp ex: +2250700000000" required />
              <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" name="email" type="email" placeholder="Email facultatif" />
              <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" name="function" placeholder="Fonction eventuelle" />
              <textarea className="min-h-24 rounded-md border border-slate-300 px-3 py-3 text-base outline-none" name="message" placeholder="Message" />
            </div>
            <Button className="mt-6 min-h-12 w-full bg-emerald-600 text-white hover:bg-emerald-700" disabled={manualInviteMutation.isPending} type="submit">
              <MessageCircle className="size-4" />
              Inviter par WhatsApp
            </Button>
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
          <img className="mx-auto mt-5 h-auto w-full max-w-[240px] object-contain" src="/brand/novex-logo.jpg" alt="NOVEX" />
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
          <img className="mx-auto mt-5 h-auto w-full max-w-[240px] object-contain" src="/brand/novex-logo.jpg" alt="NOVEX" />
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
