"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock3, LifeBuoy, Loader2, MessageSquare, Plus, Send, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { workspacePath } from "@/lib/workspace/routing";
import { createCreatorTicket, getCreatorTickets, replyCreatorTicket, type SupportTicket } from "./api";

function dateLabel(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function statusTone(status: string) {
  if (status === "RESOLVED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "IN_PROGRESS") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function Kpi({ label, value, icon: Icon }: Readonly<{ label: string; value: number; icon: typeof LifeBuoy }>) {
  return (
    <Card className="rounded-md">
      <CardContent className="p-4">
        <Icon className="size-5 text-blue-700" />
        <p className="mt-3 text-xs font-bold text-slate-500">{label}</p>
        <div className="mt-1 text-3xl font-black text-slate-950">{value}</div>
      </CardContent>
    </Card>
  );
}

function TicketForm({ categories, pending, onClose, onSubmit }: Readonly<{ categories: Array<{ value: string; label: string }>; pending: boolean; onClose: () => void; onSubmit: (payload: { subject: string; description: string; category: string }) => void }>) {
  const [form, setForm] = useState({ subject: "", description: "", category: "TECHNICAL" });
  const canSubmit = form.subject.trim().length > 2 && form.description.trim().length > 8 && !pending;
  return (
    <div className="fixed inset-0 z-50 grid items-end bg-slate-950/40 md:items-center md:p-6" role="dialog" aria-modal="true" aria-label="Ouvrir un ticket">
      <form
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-8 shadow-2xl md:mx-auto md:max-w-2xl md:rounded-xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onSubmit({ subject: form.subject.trim(), description: form.description.trim(), category: form.category });
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Ouvrir un ticket</h2>
            <p className="mt-1 text-sm text-slate-500">Expliquez votre demande a l'equipe NOVEX.</p>
          </div>
          <button className="grid size-10 place-items-center rounded-full bg-slate-100" type="button" aria-label="Fermer" onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-bold text-slate-800">
            Objet *
            <input className="min-h-12 rounded-md border border-slate-200 px-3 outline-none focus:border-blue-600" required value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Ex: Probleme lors de l'ajout d'un membre" />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-800">
            Categorie
            <select className="min-h-12 rounded-md border border-slate-200 bg-white px-3 outline-none focus:border-blue-600" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-800">
            Description *
            <textarea className="min-h-44 rounded-md border border-slate-200 px-3 py-3 outline-none focus:border-blue-600" required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Bonjour, je rencontre un probleme..." />
          </label>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button className="w-full" type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button className="w-full" disabled={!canSubmit} type="submit">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Envoyer
          </Button>
        </div>
      </form>
    </div>
  );
}

function TicketDetail({ ticket, onClose, onReply, pending }: Readonly<{ ticket: SupportTicket; onClose: () => void; onReply: (body: string) => void; pending: boolean }>) {
  const [body, setBody] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid items-end bg-slate-950/40 md:items-center md:p-6" role="dialog" aria-modal="true" aria-label="Detail ticket">
      <section className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-8 shadow-2xl md:mx-auto md:max-w-3xl md:rounded-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-blue-700">{ticket.ticket_number}</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">{ticket.subject}</h2>
            <p className="mt-1 text-sm text-slate-500">{dateLabel(ticket.created_at)}</p>
          </div>
          <button className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100" type="button" aria-label="Fermer" onClick={onClose}><X className="size-5" /></button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={cn("rounded-md border px-2 py-1 text-xs font-black", statusTone(ticket.status))}>{ticket.status_label}</span>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{ticket.category_label}</span>
        </div>
        <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 whitespace-pre-wrap">{ticket.description}</div>
        <div className="mt-5 grid gap-3">
          <h3 className="font-black text-slate-950">Conversation</h3>
          {ticket.messages.map((message) => (
            <div className={cn("rounded-md border p-3 text-sm", message.is_admin_reply ? "border-blue-100 bg-blue-50" : "border-slate-200 bg-white")} key={message.id}>
              <div className="flex justify-between gap-3 text-xs font-bold text-slate-500"><span>{message.author_name}</span><span>{dateLabel(message.created_at)}</span></div>
              <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-800">{message.body}</p>
            </div>
          ))}
        </div>
        <form className="mt-5 grid gap-3" onSubmit={(event) => { event.preventDefault(); if (body.trim()) { onReply(body.trim()); setBody(""); } }}>
          <textarea className="min-h-24 rounded-md border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-600" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Repondre au ticket..." />
          <Button disabled={pending || !body.trim()} type="submit">{pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Repondre</Button>
        </form>
      </section>
    </div>
  );
}

export function SupportView({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["support-tickets", workspaceSlug], queryFn: () => getCreatorTickets(workspaceSlug, { page_size: 50 }) });
  const createMutation = useMutation({
    mutationFn: (payload: { subject: string; description: string; category: string }) => createCreatorTicket(workspaceSlug, payload),
    onSuccess: async () => {
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ["support-tickets", workspaceSlug] });
    }
  });
  const replyMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) => replyCreatorTicket(workspaceSlug, id, body),
    onSuccess: async (ticket) => {
      setSelected(ticket);
      await queryClient.invalidateQueries({ queryKey: ["support-tickets", workspaceSlug] });
    }
  });
  const stats = query.data?.stats;
  const quota = query.data?.quota;
  const canCreate = Boolean(quota && quota.remaining > 0);
  const tickets = query.data?.tickets.results ?? [];

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 overflow-x-hidden p-4 pb-24 md:p-0">
      <PageHeader
        title="Support / Mes tickets"
        description="Envoyez vos demandes a l'equipe NOVEX et suivez leur traitement."
        actions={<Button disabled={!canCreate} type="button" onClick={() => setShowForm(true)}><Plus className="size-4" /> Ouvrir un ticket</Button>}
      />

      {createMutation.error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{createMutation.error.message}</div> : null}
      {quota ? (
        <div className={cn("rounded-md border p-4 text-sm font-bold", quota.remaining > 0 ? "border-blue-100 bg-blue-50 text-blue-800" : "border-amber-200 bg-amber-50 text-amber-800")}>
          {quota.remaining} / {quota.monthly_limit} tickets restants ce mois.
          {quota.remaining <= 0 ? <span className="block mt-1">Votre quota sera renouvele automatiquement le mois prochain.</span> : null}
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Total tickets" value={stats?.total ?? 0} icon={LifeBuoy} />
        <Kpi label="En attente" value={stats?.pending ?? 0} icon={Clock3} />
        <Kpi label="Pris en charge" value={stats?.in_progress ?? 0} icon={MessageSquare} />
        <Kpi label="Regles" value={stats?.resolved ?? 0} icon={CheckCircle2} />
      </section>

      <section className="grid gap-3">
        {query.isLoading ? [1, 2, 3].map((item) => <div className="h-28 animate-pulse rounded-md border border-slate-200 bg-white" key={item} />) : null}
        {!query.isLoading && !tickets.length ? (
          <Card className="rounded-md"><CardContent className="p-8 text-center"><ShieldCheck className="mx-auto size-10 text-blue-700" /><h2 className="mt-3 text-lg font-black">Aucun ticket</h2><p className="mt-1 text-sm text-slate-500">Vos demandes envoyees a NOVEX apparaitront ici.</p></CardContent></Card>
        ) : null}
        {tickets.map((ticket) => (
          <button className="rounded-md border border-slate-200 bg-white p-4 text-left shadow-sm" key={ticket.id} type="button" onClick={() => setSelected(ticket)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase text-blue-700">{ticket.ticket_number}</p>
                <h2 className="mt-1 line-clamp-2 text-lg font-black text-slate-950">{ticket.subject}</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">{dateLabel(ticket.created_at)}</p>
              </div>
              <span className={cn("shrink-0 rounded-md border px-2 py-1 text-xs font-black", statusTone(ticket.status))}>{ticket.status_label}</span>
            </div>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{ticket.description}</p>
          </button>
        ))}
      </section>

      <Button asChild variant="outline"><a href={workspacePath(workspaceSlug, "settings")}><ArrowLeft className="size-4" /> Parametres</a></Button>

      {showForm ? <TicketForm categories={query.data?.categories ?? [{ value: "OTHER", label: "Autre" }]} pending={createMutation.isPending} onClose={() => setShowForm(false)} onSubmit={(payload) => createMutation.mutate(payload)} /> : null}
      {selected ? <TicketDetail ticket={selected} pending={replyMutation.isPending} onClose={() => setSelected(null)} onReply={(body) => replyMutation.mutate({ id: selected.id, body })} /> : null}
    </div>
  );
}
