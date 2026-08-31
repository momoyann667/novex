"use client";

import { useMemo, useState } from "react";
import { Bell, Bot, ChevronDown, Filter, Grid2X2, Plus, Search, SlidersHorizontal, TrendingUp, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

type Member = {
  name: string;
  email: string;
  status: "Actif" | "Inactif";
  plan: "Premium" | "Standard";
  avatar: string;
};

const members: Member[] = [
  { name: "Amara Diallo", email: "amara.diallo@example.com", status: "Actif", plan: "Premium", avatar: "bg-[linear-gradient(135deg,#0f172a,#64748b)]" },
  { name: "Jean-Marc Oka", email: "jm.oka@example.com", status: "Inactif", plan: "Standard", avatar: "bg-[linear-gradient(135deg,#dbeafe,#334155)]" },
  { name: "Koffi Kouakou", email: "k.kouakou@example.com", status: "Actif", plan: "Premium", avatar: "bg-[linear-gradient(135deg,#ecfeff,#0f766e)]" },
  { name: "Fatou Diop", email: "f.diop@example.com", status: "Actif", plan: "Standard", avatar: "bg-[linear-gradient(135deg,#fee2e2,#7c2d12)]" },
  { name: "Awa Traore", email: "awa.traore@example.com", status: "Actif", plan: "Premium", avatar: "bg-[linear-gradient(135deg,#fef3c7,#92400e)]" },
  { name: "Serge Nguessan", email: "serge.nguessan@example.com", status: "Inactif", plan: "Standard", avatar: "bg-[linear-gradient(135deg,#e0e7ff,#312e81)]" }
];

function statusClass(status: Member["status"]) {
  return status === "Actif" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";
}

export function MembersView() {
  const [query, setQuery] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);

  const visibleMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return members
      .filter((member) => {
        const matchesQuery = !normalizedQuery || `${member.name} ${member.email}`.toLowerCase().includes(normalizedQuery);
        const matchesStatus = !onlyActive || member.status === "Actif";
        return matchesQuery && matchesStatus;
      })
      .sort((first, second) => (sortAsc ? first.name.localeCompare(second.name) : second.name.localeCompare(first.name)));
  }, [onlyActive, query, sortAsc]);

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

      <button className="mt-5 flex min-h-11 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-4 text-sm font-bold shadow-sm" type="button">
        <span className="flex items-center gap-2">
          <Grid2X2 className="size-4" />
          Workspace Principal
        </span>
        <ChevronDown className="size-4" />
      </button>

      <section className="mt-5 grid grid-cols-2 gap-3">
        <div className="min-h-28 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold text-slate-600">Total Membres</span>
            <Users className="size-8 text-slate-200" />
          </div>
          <div className="mt-3 text-3xl font-black tracking-normal">1,258</div>
        </div>
        <div className="min-h-28 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold text-slate-600">Actifs</span>
            <Users className="size-8 text-slate-200" />
          </div>
          <div className="mt-3 text-3xl font-black tracking-normal text-emerald-600">984</div>
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

      <section className="mt-5 grid gap-3">
        {visibleMembers.map((member) => (
          <article className="flex min-h-20 items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={member.email}>
            <div className={`grid size-12 shrink-0 place-items-center rounded-full ${member.avatar}`}>
              <span className="text-sm font-black text-white">{member.name.slice(0, 1)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-black tracking-normal">{member.name}</h2>
              <p className="truncate text-xs font-medium text-slate-500">{member.email}</p>
              <div className="mt-2 flex gap-2">
                <span className={`rounded-full px-2 py-1 text-[10px] font-black ${statusClass(member.status)}`}>{member.status}</span>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">{member.plan}</span>
              </div>
            </div>
          </article>
        ))}
      </section>

      <button className="fixed bottom-24 right-5 z-20 grid size-14 place-items-center rounded-full bg-blue-700 text-white shadow-xl shadow-blue-900/25 md:absolute" type="button" aria-label="Ajouter un membre">
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
