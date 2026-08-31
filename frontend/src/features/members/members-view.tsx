"use client";

import { useMemo, useState } from "react";
import { Bell, Bot, Filter, Grid2X2, Plus, Search, SlidersHorizontal, TrendingUp, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Member = {
  name: string;
  email: string;
  phone: string;
  function: string;
  joinedAt: string;
  status: "Actif" | "Inactif" | "Suspendu" | "Archive";
  avatar: string;
};

const members: Member[] = [
  { name: "Amara Diallo", email: "amara.diallo@example.com", phone: "+225 07 00 00 00 01", function: "President", joinedAt: "2024-01-15", status: "Actif", avatar: "bg-[linear-gradient(135deg,#0f172a,#64748b)]" },
  { name: "Jean-Marc Oka", email: "jm.oka@example.com", phone: "+225 05 00 00 00 02", function: "Tresorier", joinedAt: "2024-03-22", status: "Inactif", avatar: "bg-[linear-gradient(135deg,#dbeafe,#334155)]" },
  { name: "Koffi Kouakou", email: "k.kouakou@example.com", phone: "+225 01 00 00 00 03", function: "Secretaire general", joinedAt: "2023-11-04", status: "Actif", avatar: "bg-[linear-gradient(135deg,#ecfeff,#0f766e)]" },
  { name: "Fatou Diop", email: "f.diop@example.com", phone: "+221 77 000 00 04", function: "Responsable communication", joinedAt: "2025-02-18", status: "Actif", avatar: "bg-[linear-gradient(135deg,#fee2e2,#7c2d12)]" },
  { name: "Awa Traore", email: "awa.traore@example.com", phone: "+225 07 00 00 00 05", function: "Membre", joinedAt: "2025-06-09", status: "Actif", avatar: "bg-[linear-gradient(135deg,#fef3c7,#92400e)]" },
  { name: "Serge Nguessan", email: "serge.nguessan@example.com", phone: "+225 05 00 00 00 06", function: "Commissaire aux comptes", joinedAt: "2022-09-30", status: "Inactif", avatar: "bg-[linear-gradient(135deg,#e0e7ff,#312e81)]" },
  { name: "Nadia Bamba", email: "nadia.bamba@example.com", phone: "+225 01 00 00 00 07", function: "Membre", joinedAt: "2021-05-12", status: "Suspendu", avatar: "bg-[linear-gradient(135deg,#fef2f2,#991b1b)]" },
  { name: "Paul Ehouman", email: "paul.ehouman@example.com", phone: "+225 07 00 00 00 08", function: "Ancien membre", joinedAt: "2020-08-18", status: "Archive", avatar: "bg-[linear-gradient(135deg,#f1f5f9,#475569)]" }
];

const avatarStyles = [
  "bg-[linear-gradient(135deg,#0f172a,#64748b)]",
  "bg-[linear-gradient(135deg,#dbeafe,#334155)]",
  "bg-[linear-gradient(135deg,#ecfeff,#0f766e)]",
  "bg-[linear-gradient(135deg,#fee2e2,#7c2d12)]",
  "bg-[linear-gradient(135deg,#fef3c7,#92400e)]",
  "bg-[linear-gradient(135deg,#e0e7ff,#312e81)]"
];

function statusClass(status: Member["status"]) {
  return {
    Actif: "bg-emerald-50 text-emerald-700",
    Inactif: "bg-slate-100 text-slate-700",
    Suspendu: "bg-amber-50 text-amber-700",
    Archive: "bg-red-50 text-red-700"
  }[status];
}

export function MembersView() {
  const [memberRows, setMemberRows] = useState<Member[]>(members);
  const [query, setQuery] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [memberFunction, setMemberFunction] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [joinedAt, setJoinedAt] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<Member["status"]>("Actif");

  const visibleMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return memberRows
      .filter((member) => {
        const matchesQuery = !normalizedQuery || `${member.name} ${member.email} ${member.phone} ${member.function}`.toLowerCase().includes(normalizedQuery);
        const matchesStatus = !onlyActive || member.status === "Actif";
        return matchesQuery && matchesStatus;
      })
      .sort((first, second) => (sortAsc ? first.name.localeCompare(second.name) : second.name.localeCompare(first.name)));
  }, [memberRows, onlyActive, query, sortAsc]);

  function addMember() {
    const cleanName = fullName.trim();
    const cleanFunction = memberFunction.trim();
    if (!cleanName || !cleanFunction) {
      return;
    }

    setMemberRows((current) => [
      {
        name: cleanName,
        email: email.trim() || `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "membre"}@example.com`,
        phone: phone.trim(),
        function: cleanFunction,
        joinedAt,
        status,
        avatar: avatarStyles[current.length % avatarStyles.length]
      },
      ...current
    ]);
    setFullName("");
    setMemberFunction("");
    setPhone("");
    setEmail("");
    setJoinedAt(new Date().toISOString().slice(0, 10));
    setStatus("Actif");
    setShowForm(false);
  }

  function changeStatus(emailAddress: string, nextStatus: Member["status"]) {
    setMemberRows((current) => current.map((member) => (member.email === emailAddress ? { ...member, status: nextStatus } : member)));
  }

  return (
    <main className="min-h-screen bg-[#f5f7f8] px-4 pb-28 pt-4 text-slate-950 md:rounded-[28px]">
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
        <h1 className="text-3xl font-black leading-tight tracking-normal">Gestion des Membres</h1>
        <p className="mt-2 text-sm font-medium leading-5 text-slate-600">Gerez votre communaute et suivez l'engagement.</p>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3">
        <div className="min-h-28 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold text-slate-600">Total Membres</span>
            <Users className="size-8 text-slate-200" />
          </div>
          <div className="mt-3 text-3xl font-black tracking-normal">{memberRows.length.toLocaleString("fr-FR")}</div>
        </div>
        <div className="min-h-28 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold text-slate-600">Actifs</span>
            <Users className="size-8 text-slate-200" />
          </div>
          <div className="mt-3 text-3xl font-black tracking-normal text-emerald-600">{memberRows.filter((member) => member.status === "Actif").length}</div>
        </div>
        <div className="min-h-28 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold text-slate-600">Nouveaux (30j)</span>
            <UserPlus className="size-8 text-slate-200" />
          </div>
          <div className="mt-3 text-3xl font-black tracking-normal text-blue-700">+48</div>
        </div>
        <div className="min-h-28 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold text-slate-600">Croissance</span>
            <TrendingUp className="size-8 text-slate-200" />
          </div>
          <div className="mt-3 text-3xl font-black tracking-normal">+4.2%</div>
        </div>
      </section>

      <label className="mt-5 flex min-h-12 items-center gap-3 rounded-md border border-slate-300 bg-white px-4 shadow-sm">
        <Search className="size-5 text-slate-500" />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-slate-500"
          placeholder="Rechercher par nom, email..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="mt-4 flex gap-3">
        <Button className={`min-h-10 px-4 ${onlyActive ? "bg-blue-700 text-white hover:bg-blue-800" : ""}`} type="button" variant={onlyActive ? "default" : "outline"} onClick={() => setOnlyActive((value) => !value)}>
          <Filter className="size-4" />
          Filtres
        </Button>
        <Button className="min-h-10 px-4" type="button" variant="outline" onClick={() => setSortAsc((value) => !value)}>
          <SlidersHorizontal className="size-4" />
          Trier
        </Button>
      </div>

      <section className="mt-5 grid gap-3 md:hidden">
        {visibleMembers.map((member) => (
          <article className="flex min-h-20 items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={member.email}>
            <div className={`grid size-12 shrink-0 place-items-center rounded-full ${member.avatar}`}>
              <span className="text-sm font-black text-white">{member.name.slice(0, 1)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-black tracking-normal">{member.name}</h2>
              <p className="truncate text-xs font-medium text-slate-500">{member.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusClass(member.status)}`}>{member.status}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">{member.function}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-bold text-blue-700">
                {member.phone ? <a href={`tel:${member.phone.replace(/\s/g, "")}`}>Appeler</a> : null}
                {member.email ? <a href={`mailto:${member.email}`}>Email</a> : null}
                <button type="button">Voir</button>
                <button type="button">Modifier</button>
                {member.status === "Archive" ? (
                  <button type="button" onClick={() => changeStatus(member.email, "Actif")}>Restaurer</button>
                ) : (
                  <button type="button" onClick={() => changeStatus(member.email, "Archive")}>Archiver</button>
                )}
                <span className="basis-full text-slate-500">Adhesion {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(member.joinedAt))}</span>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-6 hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <div className="grid grid-cols-[minmax(180px,1.4fr)_1fr_150px_120px_130px_180px] gap-3 border-b border-slate-200 px-4 py-3 text-xs font-black uppercase text-slate-500">
          <span>Membre</span>
          <span>Fonction</span>
          <span>Telephone</span>
          <span>Statut</span>
          <span>Adhesion</span>
          <span>Actions</span>
        </div>
        {visibleMembers.map((member) => (
          <div className="grid grid-cols-[minmax(180px,1.4fr)_1fr_150px_120px_130px_180px] items-center gap-3 border-b border-slate-100 px-4 py-4 text-sm last:border-b-0" key={`table-${member.email}`}>
            <div className="flex min-w-0 items-center gap-3">
              <div className={`grid size-10 shrink-0 place-items-center rounded-full ${member.avatar}`}>
                <span className="text-xs font-black text-white">{member.name.slice(0, 1)}</span>
              </div>
              <div className="min-w-0">
                <strong className="block truncate">{member.name}</strong>
                <span className="block truncate text-xs text-slate-500">{member.email}</span>
              </div>
            </div>
            <span className="font-semibold">{member.function}</span>
            <a className="font-semibold text-blue-700" href={`tel:${member.phone.replace(/\s/g, "")}`}>{member.phone}</a>
            <span className={`w-fit rounded-full px-2 py-1 text-[11px] font-black ${statusClass(member.status)}`}>{member.status}</span>
            <span className="font-semibold text-slate-600">{new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(member.joinedAt))}</span>
            <div className="flex gap-2">
              <Button className="min-h-8 px-2 text-xs" type="button" variant="outline">Voir</Button>
              <Button className="min-h-8 px-2 text-xs" type="button" variant="outline">Modifier</Button>
              <Button className="min-h-8 px-2 text-xs" type="button" variant="outline" onClick={() => changeStatus(member.email, member.status === "Archive" ? "Actif" : "Archive")}>
                {member.status === "Archive" ? "Restaurer" : "Archiver"}
              </Button>
            </div>
          </div>
        ))}
      </section>

      {showForm ? (
        <section className="fixed inset-0 z-40 grid place-items-end bg-slate-950/35 px-4 pb-24 md:absolute md:place-items-center md:pb-0">
          <form className="w-full rounded-2xl bg-white p-5 shadow-2xl md:max-w-md" onSubmit={(event) => { event.preventDefault(); addMember(); }}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-normal">Ajouter un membre</h2>
              <button className="grid size-9 place-items-center rounded-full bg-slate-100" type="button" aria-label="Fermer" onClick={() => setShowForm(false)}>
                <X className="size-5" />
              </button>
            </div>
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-bold">
                Nom et prenoms
                <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" placeholder="Ex: Mariam Kone" value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Role
                <select className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base outline-none" value={memberFunction} onChange={(event) => setMemberFunction(event.target.value)}>
                  <option value="">Choisir une fonction</option>
                  <option>President</option>
                  <option>Vice-president</option>
                  <option>Secretaire general</option>
                  <option>Tresorier</option>
                  <option>Commissaire aux comptes</option>
                  <option>Responsable communication</option>
                  <option>Membre</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Telephone
                <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" placeholder="+225 07 00 00 00 00" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                Email
                <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" placeholder="membre@example.com" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-bold">
                  Adhesion
                  <input className="min-h-12 rounded-md border border-slate-300 px-3 text-base outline-none" type="date" value={joinedAt} onChange={(event) => setJoinedAt(event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Statut
                  <select className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base outline-none" value={status} onChange={(event) => setStatus(event.target.value as Member["status"])}>
                    <option>Actif</option>
                  <option>Inactif</option>
                    <option>Suspendu</option>
                    <option>Archive</option>
                  </select>
                </label>
              </div>
            </div>
            <Button className="mt-6 min-h-12 w-full bg-blue-700 text-white hover:bg-blue-800" disabled={!fullName.trim() || !memberFunction.trim()} type="submit">
              Enregistrer le membre
            </Button>
          </form>
        </section>
      ) : null}

      <button className="fixed bottom-24 right-5 z-20 grid size-14 place-items-center rounded-full bg-blue-700 text-white shadow-xl shadow-blue-900/25 md:absolute" type="button" aria-label="Ajouter un membre" onClick={() => setShowForm(true)}>
        <Plus className="size-7" />
      </button>

      <section className="mt-6 rounded-xl bg-[#0f2347] p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full bg-white/15">
            <Bot className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-black">Assistant IA</h2>
            <p className="text-xs font-medium text-white/75">Analysez l'engagement des membres.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
