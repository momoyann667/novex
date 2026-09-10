"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Building2, CheckCircle2, Clock3, CreditCard, Layers3, LifeBuoy, MessageSquare, RefreshCw, ShieldCheck, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  getAdminActivity,
  getAdminAssociations,
  getAdminAudit,
  getAdminDashboard,
  getAdminPayments,
  getAdminPlans,
  getAdminReports,
  getAdminSettings,
  getAdminSubscriptions,
  getAdminTickets,
  getAdminUsers,
  replyAdminTicket,
  activateAdminAssociation,
  createAdminPlan,
  createAdminUser,
  deleteAdminPlan,
  deleteAdminUser,
  suspendAdminAssociation,
  updateAdminPlan,
  updateAdminTicketStatus,
  updateAdminUser,
  type AdminActivity,
  type AdminAssociation,
  type AdminDashboard,
  type AdminPayment,
  type AdminPlan,
  type AdminPlanPayload,
  type AdminSection,
  type AdminSubscription,
  type AdminSupportTicket,
  type AdminUser,
  type AdminUserPayload,
  type Paginated
} from "./api";

const periods = [
  { label: "Aujourd'hui", value: "today" },
  { label: "7 derniers jours", value: "7d" },
  { label: "30 derniers jours", value: "30d" },
  { label: "Ce mois", value: "month" },
  { label: "Mois precedent", value: "previous_month" },
  { label: "Ce trimestre", value: "quarter" },
  { label: "Cette annee", value: "year" },
  { label: "Annee precedente", value: "previous_year" }
];

const sectionTitles: Record<AdminSection, string> = {
  dashboard: "Dashboard Admin",
  associations: "Associations",
  users: "Utilisateurs",
  subscriptions: "Abonnements",
  payments: "Paiements SaaS",
  tickets: "Tickets",
  plans: "Plans & Offres",
  activity: "Activite globale",
  audit: "Audit",
  reports: "Rapports globaux",
  settings: "Parametres Admin"
};

export function AdminConsole({ section = "dashboard" }: Readonly<{ section?: AdminSection }>) {
  const [period, setPeriod] = useState("30d");
  const [search, setSearch] = useState("");
  const dashboard = useQuery({ queryKey: ["novex-admin-dashboard", period], queryFn: () => getAdminDashboard(period) });

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Equipe NOVEX</p>
          <h1 className="mt-2 text-3xl font-black">{sectionTitles[section]}</h1>
          <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">Console interne desktop pour superviser les associations, abonnements, paiements SaaS, revenus et alertes plateforme.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1">
          {periods.map((item) => (
            <button className={`min-h-9 rounded-md px-3 text-sm font-black ${period === item.value ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`} key={item.value} type="button" onClick={() => setPeriod(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {dashboard.error ? <ErrorPanel message={dashboard.error.message} /> : null}
      {section === "dashboard" ? <DashboardContent data={dashboard.data} isLoading={dashboard.isLoading} /> : null}
      {section === "associations" ? <AssociationsSection search={search} setSearch={setSearch} /> : null}
      {section === "users" ? <UsersSection search={search} setSearch={setSearch} /> : null}
      {section === "subscriptions" ? <SubscriptionsSection search={search} setSearch={setSearch} /> : null}
      {section === "payments" ? <PaymentsSection search={search} setSearch={setSearch} /> : null}
      {section === "tickets" ? <TicketsSection /> : null}
      {section === "plans" ? <PlansSection /> : null}
      {section === "activity" ? <ActivitySection search={search} setSearch={setSearch} audit={false} /> : null}
      {section === "audit" ? <ActivitySection search={search} setSearch={setSearch} audit /> : null}
      {section === "reports" ? <ReportsSection period={period} /> : null}
      {section === "settings" ? <SettingsSection /> : null}
    </div>
  );
}

function DashboardContent({ data, isLoading }: Readonly<{ data?: AdminDashboard; isLoading: boolean }>) {
  if (isLoading || !data) return <SkeletonRows />;
  const kpis = data.kpis;
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-4 gap-4">
        <Kpi title="Associations" value={kpis.associations_total} icon={Building2} hint={`${kpis.associations_active} actives`} />
        <Kpi title="Utilisateurs" value={kpis.users_total} icon={Users} hint={`${kpis.new_users} nouveaux sur la periode`} />
        <Kpi title="Abonnements actifs" value={kpis.subscriptions_active} icon={Layers3} hint={`${kpis.new_subscriptions} nouveaux`} />
        <Kpi title="Revenus NOVEX encaisses" value={money(kpis.revenue_paid, String(kpis.currency || "XOF"))} icon={CreditCard} hint="Paiements SaaS SUCCESS uniquement" />
        <Kpi title="MRR" value={money(kpis.mrr, String(kpis.currency || "XOF"))} icon={ArrowUpRight} hint="Abonnements payants actifs" />
        <Kpi title="ARR" value={money(kpis.arr, String(kpis.currency || "XOF"))} icon={ArrowUpRight} hint="MRR x 12" />
        <Kpi title="Churn payant" value={`${kpis.churn_rate}%`} icon={ArrowDownRight} hint={`${kpis.churn_lost} perdu(s) sur la periode`} danger={Number(kpis.churn_rate || 0) > 0} />
        <Kpi title="Conversion Freemium" value={`${kpis.conversion_rate}%`} icon={RefreshCw} hint={`Start ${kpis.conversion_start_rate}% - Pro ${kpis.conversion_pro_rate}%`} />
        <Kpi title="Paiements en attente" value={kpis.payments_pending} icon={RefreshCw} />
        <Kpi title="Paiements echoues" value={kpis.payments_failed} icon={AlertTriangle} danger />
        <Kpi title="Nouvelles associations" value={kpis.new_associations} icon={ArrowUpRight} hint={`${kpis.associations_growth}% vs periode precedente`} />
        <Kpi title="Croissance utilisateurs" value={kpis.new_users} icon={ArrowDownRight} hint={`${kpis.users_growth}% vs periode precedente`} />
      </div>

      <div className="grid grid-cols-[1.4fr_1fr] gap-5">
        <Panel title="Croissance des associations">
          <BarSeries rows={data.charts.associations_growth.map((row) => ({ label: monthLabel(row.month), value: row.new }))} />
        </Panel>
        <Panel title="Repartition des plans">
          <PlanDistribution rows={data.charts.plan_distribution} />
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Panel title="Evolution des inscriptions">
          <BarSeries rows={data.charts.registrations.map((row) => ({ label: monthLabel(row.month), value: row.new }))} />
        </Panel>
        <Panel title="Revenus SaaS confirmes">
          <BarSeries rows={data.charts.revenue.map((row) => ({ label: monthLabel(row.month), value: Number(row.total || 0) }))} money />
        </Panel>
      </div>

      <div className="grid grid-cols-[1.35fr_1fr] gap-5">
        <AssociationTable rows={data.recent_associations} />
        <div className="grid gap-5">
          <Panel title="Alertes Admin">
            {data.alerts.length ? data.alerts.map((alert) => <AlertRow alert={alert} key={alert.title} />) : <Empty message="Aucune alerte critique." />}
          </Panel>
          <ActivityList rows={data.recent_activity} />
        </div>
      </div>
    </div>
  );
}

function AssociationsSection({ search, setSearch }: Readonly<{ search: string; setSearch: (value: string) => void }>) {
  const queryClient = useQueryClient();
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => (status === "active" ? activateAdminAssociation(id, "Action admin depuis le back-office") : suspendAdminAssociation(id, "Action admin depuis le back-office")),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["novex-admin-associations"] });
      await queryClient.invalidateQueries({ queryKey: ["novex-admin-dashboard"] });
    }
  });
  const query = useQuery({ queryKey: ["novex-admin-associations", search], queryFn: () => getAdminAssociations({ search, page_size: 50 }) });
  return <TablePanel title="Toutes les associations" search={search} setSearch={setSearch}>{query.data ? <AssociationRows data={query.data} onStatusChange={(id, status) => statusMutation.mutate({ id, status })} /> : <SkeletonRows />}</TablePanel>;
}

function UsersSection({ search, setSearch }: Readonly<{ search: string; setSearch: (value: string) => void }>) {
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");
  const query = useQuery({ queryKey: ["novex-admin-users", search], queryFn: () => getAdminUsers({ search, page_size: 50 }) });
  const createMutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: async () => {
      setNotice("Utilisateur admin cree.");
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ["novex-admin-users"] });
    }
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: AdminUserPayload }) => updateAdminUser(id, payload),
    onSuccess: async () => {
      setNotice("Utilisateur admin modifie.");
      setEditingUser(null);
      await queryClient.invalidateQueries({ queryKey: ["novex-admin-users"] });
    }
  });
  const deleteMutation = useMutation({
    mutationFn: deleteAdminUser,
    onSuccess: async () => {
      setNotice("Utilisateur admin supprime.");
      await queryClient.invalidateQueries({ queryKey: ["novex-admin-users"] });
    }
  });

  return (
    <div className="grid gap-4">
      {notice ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{notice}</div> : null}
      {createMutation.error || updateMutation.error || deleteMutation.error ? <ErrorPanel message="Action impossible. Les utilisateurs venant de l'application mobile sont proteges." /> : null}
      <div className="flex justify-end">
        <button className="min-h-10 rounded-md bg-blue-700 px-4 text-sm font-black text-white" type="button" onClick={() => { setEditingUser(null); setShowForm(true); }}>
          Creer un utilisateur
        </button>
      </div>
      {showForm || editingUser ? (
        <AdminUserForm
          key={editingUser?.id || "create-user"}
          user={editingUser}
          pending={createMutation.isPending || updateMutation.isPending}
          onCancel={() => { setShowForm(false); setEditingUser(null); }}
          onSubmit={(payload) => {
            if (editingUser) updateMutation.mutate({ id: editingUser.id, payload });
            else createMutation.mutate(payload);
          }}
        />
      ) : null}
      <TablePanel title="Utilisateurs NOVEX" search={search} setSearch={setSearch}>
        {query.data ? <UserRows data={query.data} onEdit={(user) => { setEditingUser(user); setShowForm(false); }} onDelete={(user) => deleteMutation.mutate(user.id)} /> : <SkeletonRows />}
      </TablePanel>
    </div>
  );
}

function SubscriptionsSection({ search, setSearch }: Readonly<{ search: string; setSearch: (value: string) => void }>) {
  const query = useQuery({ queryKey: ["novex-admin-subscriptions", search], queryFn: () => getAdminSubscriptions({ search }) });
  return <TablePanel title="Abonnements des associations" search={search} setSearch={setSearch}>{query.data ? <SubscriptionRows data={query.data} /> : <SkeletonRows />}</TablePanel>;
}

function PaymentsSection({ search, setSearch }: Readonly<{ search: string; setSearch: (value: string) => void }>) {
  const query = useQuery({ queryKey: ["novex-admin-payments", search], queryFn: () => getAdminPayments({ search }) });
  return <TablePanel title="Historique des paiements SaaS" search={search} setSearch={setSearch}>{query.data ? <PaymentRows data={query.data} /> : <SkeletonRows />}</TablePanel>;
}

function TicketsSection() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState("month");
  const [selected, setSelected] = useState<AdminSupportTicket | null>(null);
  const query = useQuery({ queryKey: ["novex-admin-tickets", search, status, period], queryFn: () => getAdminTickets({ search, status, period, page_size: 50 }) });
  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: number; nextStatus: AdminSupportTicket["status"] }) => updateAdminTicketStatus(id, nextStatus),
    onSuccess: async (ticket) => {
      setSelected(ticket);
      await queryClient.invalidateQueries({ queryKey: ["novex-admin-tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["novex-admin-dashboard"] });
    }
  });
  const replyMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) => replyAdminTicket(id, body),
    onSuccess: async (ticket) => {
      setSelected(ticket);
      await queryClient.invalidateQueries({ queryKey: ["novex-admin-tickets"] });
    }
  });
  const stats = query.data?.stats;
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-4 gap-4">
        <Kpi title="Total tickets" value={stats?.total ?? 0} icon={LifeBuoy} />
        <Kpi title="En attente" value={stats?.pending ?? 0} icon={Clock3} />
        <Kpi title="Pris en charge" value={stats?.in_progress ?? 0} icon={MessageSquare} />
        <Kpi title="Regles" value={stats?.resolved ?? 0} icon={CheckCircle2} />
      </div>
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1fr_220px_220px] gap-3 border-b border-slate-200 p-5">
          <input className="h-11 rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-600" placeholder="Numero, objet, creator, association..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className="h-11 rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-600" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="PENDING">En attente</option>
            <option value="IN_PROGRESS">Pris en charge</option>
            <option value="RESOLVED">Regle</option>
          </select>
          <select className="h-11 rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-600" value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="today">Aujourd'hui</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
            <option value="previous_month">Mois precedent</option>
            <option value="">Toutes periodes</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          {query.data ? <TicketRows data={query.data.tickets} onOpen={setSelected} /> : <SkeletonRows />}
        </div>
      </section>
      {selected ? (
        <TicketDrawer
          ticket={selected}
          pending={statusMutation.isPending || replyMutation.isPending}
          onClose={() => setSelected(null)}
          onReply={(body) => replyMutation.mutate({ id: selected.id, body })}
          onStatus={(nextStatus) => statusMutation.mutate({ id: selected.id, nextStatus })}
        />
      ) : null}
    </div>
  );
}

function PlansSection() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null);
  const [notice, setNotice] = useState("");
  const query = useQuery({ queryKey: ["novex-admin-plans"], queryFn: getAdminPlans });
  const createMutation = useMutation({
    mutationFn: createAdminPlan,
    onSuccess: async () => {
      setNotice("Plan cree.");
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ["novex-admin-plans"] });
      await queryClient.invalidateQueries({ queryKey: ["novex-admin-dashboard"] });
    }
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: AdminPlanPayload }) => updateAdminPlan(id, payload),
    onSuccess: async () => {
      setNotice("Plan modifie.");
      setEditingPlan(null);
      await queryClient.invalidateQueries({ queryKey: ["novex-admin-plans"] });
      await queryClient.invalidateQueries({ queryKey: ["novex-admin-dashboard"] });
    }
  });
  const deleteMutation = useMutation({
    mutationFn: deleteAdminPlan,
    onSuccess: async () => {
      setNotice("Plan supprime.");
      await queryClient.invalidateQueries({ queryKey: ["novex-admin-plans"] });
      await queryClient.invalidateQueries({ queryKey: ["novex-admin-dashboard"] });
    }
  });
  const mutationError = createMutation.error || updateMutation.error || deleteMutation.error;

  return (
    <div className="grid gap-4">
      {notice ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{notice}</div> : null}
      {mutationError ? <ErrorPanel message={errorMessage(mutationError, "Action impossible sur ce plan. Verifiez les champs ou desactivez un plan deja utilise.")} /> : null}
      <div className="flex justify-end">
        <button className="min-h-10 rounded-md bg-blue-700 px-4 text-sm font-black text-white" type="button" onClick={() => { setEditingPlan(null); setShowForm(true); }}>
          Creer une offre
        </button>
      </div>
      {showForm || editingPlan ? (
        <AdminPlanForm
          key={editingPlan?.id || "create-plan"}
          plan={editingPlan}
          pending={createMutation.isPending || updateMutation.isPending}
          onCancel={() => { setShowForm(false); setEditingPlan(null); }}
          onSubmit={(payload) => {
            if (editingPlan) updateMutation.mutate({ id: editingPlan.id, payload });
            else createMutation.mutate(payload);
          }}
        />
      ) : null}
      <div className="grid grid-cols-3 gap-5">
        {query.data?.results.map((plan) => <PlanCard plan={plan} key={plan.id} onDelete={(item) => deleteMutation.mutate(item.id)} onEdit={(item) => { setEditingPlan(item); setShowForm(false); }} />) || <SkeletonRows />}
      </div>
    </div>
  );
}

function ActivitySection({ search, setSearch, audit }: Readonly<{ search: string; setSearch: (value: string) => void; audit: boolean }>) {
  const query = useQuery({ queryKey: ["novex-admin-activity", audit, search], queryFn: () => (audit ? getAdminAudit({ search }) : getAdminActivity({ search })) });
  return <TablePanel title={audit ? "Journal d'audit" : "Activite globale"} search={search} setSearch={setSearch}>{query.data ? <ActivityRows data={query.data} /> : <SkeletonRows />}</TablePanel>;
}

function ReportsSection({ period }: Readonly<{ period: string }>) {
  const query = useQuery({ queryKey: ["novex-admin-reports", period], queryFn: () => getAdminReports(period) });
  return (
    <Panel title="Rapports globaux NOVEX">
      <pre className="max-h-[620px] overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(query.data || {}, null, 2)}</pre>
    </Panel>
  );
}

function SettingsSection() {
  const query = useQuery({ queryKey: ["novex-admin-settings"], queryFn: getAdminSettings });
  return (
    <Panel title="Parametres de securite Admin">
      <pre className="max-h-[620px] overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(query.data || {}, null, 2)}</pre>
    </Panel>
  );
}

function Kpi({ title, value, hint, icon: Icon, danger = false }: Readonly<{ title: string; value: React.ReactNode; hint?: string; icon: typeof Building2; danger?: boolean }>) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-black text-slate-500">{title}</p>
        <Icon className={`size-5 ${danger ? "text-red-600" : "text-blue-700"}`} />
      </div>
      <div className={`mt-4 text-3xl font-black ${danger ? "text-red-700" : "text-slate-950"}`}>{value}</div>
      {hint ? <p className="mt-2 text-xs font-bold text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Panel({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">{title}</h2><div className="mt-4">{children}</div></section>;
}

function TablePanel({ title, search, setSearch, children }: Readonly<{ title: string; search: string; setSearch: (value: string) => void; children: React.ReactNode }>) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 p-5">
        <h2 className="text-xl font-black">{title}</h2>
        <input className="h-10 w-[380px] rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-600" placeholder="Rechercher..." value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function AssociationTable({ rows }: Readonly<{ rows: AdminAssociation[] }>) {
  return <TablePanel title="Associations recentes" search="" setSearch={() => undefined}><AssociationRows data={{ results: rows, count: rows.length, page: 1, page_size: rows.length, next: null, previous: null }} /></TablePanel>;
}

function TicketRows({ data, onOpen }: Readonly<{ data: Paginated<AdminSupportTicket>; onOpen: (ticket: AdminSupportTicket) => void }>) {
  return (
    <table className="w-full min-w-[1280px] text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
        <tr><Th>N Ticket</Th><Th>Date</Th><Th>Creator</Th><Th>Association</Th><Th>Objet</Th><Th>Categorie</Th><Th>Statut</Th><Th>Derniere activite</Th><Th>Action</Th></tr>
      </thead>
      <tbody>
        {data.results.map((row) => (
          <tr className="border-t border-slate-100" key={row.id}>
            <Td strong>{row.ticket_number}</Td>
            <Td>{dateTimeLabel(row.created_at)}</Td>
            <Td>{row.creator_name}<br /><span className="text-xs text-slate-400">{row.creator_email}</span></Td>
            <Td strong>{row.workspace_name}</Td>
            <Td>{row.subject}</Td>
            <Td>{row.category_label}</Td>
            <Td><Badge>{row.status_label}</Badge></Td>
            <Td>{dateTimeLabel(row.last_activity_at)}</Td>
            <Td><button className="rounded-md bg-slate-950 px-3 py-2 text-xs font-black text-white" type="button" onClick={() => onOpen(row)}>Consulter</button></Td>
          </tr>
        ))}
        {!data.results.length ? <tr><td className="px-4 py-10 text-center text-sm font-bold text-slate-500" colSpan={9}>Aucun ticket trouve.</td></tr> : null}
      </tbody>
    </table>
  );
}

function TicketDrawer({ ticket, pending, onClose, onReply, onStatus }: Readonly<{ ticket: AdminSupportTicket; pending: boolean; onClose: () => void; onReply: (body: string) => void; onStatus: (status: AdminSupportTicket["status"]) => void }>) {
  const [body, setBody] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50" role="dialog" aria-modal="true" aria-label="Detail ticket">
      <section className="ml-auto flex h-full w-[720px] flex-col overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase text-blue-700">{ticket.ticket_number}</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">{ticket.subject}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{ticket.workspace_name} - {ticket.creator_name}</p>
          </div>
          <button className="grid size-10 place-items-center rounded-md bg-slate-100" type="button" aria-label="Fermer" onClick={onClose}><X className="size-5" /></button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <Info label="Association" value={ticket.workspace_name} />
          <Info label="Creator" value={ticket.creator_name} />
          <Info label="Email" value={ticket.creator_email} />
          <Info label="Date" value={dateTimeLabel(ticket.created_at)} />
          <Info label="Categorie" value={ticket.category_label} />
          <Info label="Statut" value={ticket.status_label} />
          <Info label="Pris en charge" value={ticket.taken_at ? `${dateTimeLabel(ticket.taken_at)} par ${ticket.taken_by_name}` : "Non"} />
          <Info label="Regle" value={ticket.resolved_at ? `${dateTimeLabel(ticket.resolved_at)} par ${ticket.resolved_by_name}` : "Non"} />
        </div>
        <div className="mt-6">
          <h3 className="text-lg font-black">Description</h3>
          <p className="mt-3 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{ticket.description}</p>
        </div>
        <div className="mt-6 grid gap-3">
          <h3 className="text-lg font-black">Changer le statut</h3>
          <div className="grid grid-cols-3 gap-2">
            {(["PENDING", "IN_PROGRESS", "RESOLVED"] as const).map((item) => (
              <button className={`min-h-11 rounded-md px-3 text-sm font-black ${ticket.status === item ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-700"}`} disabled={pending} key={item} type="button" onClick={() => onStatus(item)}>
                {item === "PENDING" ? "En attente" : item === "IN_PROGRESS" ? "Pris en charge" : "Regle"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-3">
          <h3 className="text-lg font-black">Historique / Conversation</h3>
          {ticket.messages.map((message) => (
            <div className={`rounded-md border p-3 text-sm ${message.is_admin_reply ? "border-blue-100 bg-blue-50" : "border-slate-200 bg-white"}`} key={message.id}>
              <div className="flex justify-between gap-3 text-xs font-bold text-slate-500"><span>{message.author_name}</span><span>{dateTimeLabel(message.created_at)}</span></div>
              <p className="mt-2 whitespace-pre-wrap leading-6">{message.body}</p>
            </div>
          ))}
        </div>
        <form className="mt-6 grid gap-3" onSubmit={(event) => { event.preventDefault(); if (body.trim()) { onReply(body.trim()); setBody(""); } }}>
          <textarea className="min-h-28 rounded-md border border-slate-200 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-600" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Reponse NOVEX au creator..." />
          <button className="min-h-11 rounded-md bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-50" disabled={pending || !body.trim()} type="submit">
            {pending ? "Envoi..." : "Repondre au creator"}
          </button>
        </form>
      </section>
    </div>
  );
}

function AssociationRows({ data, onStatusChange }: Readonly<{ data: Paginated<AdminAssociation>; onStatusChange?: (id: number, status: string) => void }>) {
  return (
    <table className="w-full min-w-[980px] text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><Th>Association</Th><Th>Admin</Th><Th>Plan</Th><Th>Statut</Th><Th>Membres</Th><Th>Creee le</Th><Th>Derniere activite</Th><Th>Actions</Th></tr></thead>
      <tbody>{data.results.map((row) => <tr className="border-t border-slate-100" key={row.id}><Td strong>{row.name}</Td><Td>{row.admin}</Td><Td>{row.plan}</Td><Td><Badge>{row.status}</Badge></Td><Td>{row.members}</Td><Td>{dateLabel(row.created_at)}</Td><Td>{row.last_activity ? dateLabel(row.last_activity) : "Non disponible"}</Td><Td>{onStatusChange ? <button className={`rounded-md px-3 py-2 text-xs font-black ${row.status === "suspended" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`} type="button" onClick={() => onStatusChange(row.id, row.status === "suspended" ? "active" : "suspended")}>{row.status === "suspended" ? "Reactiver" : "Suspendre"}</button> : "Voir"}</Td></tr>)}</tbody>
    </table>
  );
}

function UserRows({ data, onEdit, onDelete }: Readonly<{ data: Paginated<AdminUser>; onEdit?: (user: AdminUser) => void; onDelete?: (user: AdminUser) => void }>) {
  return (
    <table className="w-full min-w-[1180px] text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><Th>Utilisateur</Th><Th>Email</Th><Th>Telephone</Th><Th>Source</Th><Th>Statut</Th><Th>Associations</Th><Th>Inscription</Th><Th>Derniere connexion</Th><Th>Actions</Th></tr></thead>
      <tbody>{data.results.map((row) => <tr className="border-t border-slate-100" key={row.id}><Td strong>{row.name}</Td><Td>{row.email}</Td><Td>{row.phone || "Non renseigne"}</Td><Td><Badge>{row.source === "application" ? "Application mobile" : "Admin"}</Badge></Td><Td><Badge>{row.status}</Badge></Td><Td>{row.workspaces.map((item) => item.name).join(", ") || "Aucune"}</Td><Td>{dateLabel(row.joined_at)}</Td><Td>{row.last_login ? dateLabel(row.last_login) : "Jamais"}</Td><Td>{row.can_manage ? <div className="flex gap-2"><button className="rounded-md bg-slate-950 px-3 py-2 text-xs font-black text-white" type="button" onClick={() => onEdit?.(row)}>Modifier</button><button className="rounded-md bg-red-600 px-3 py-2 text-xs font-black text-white" type="button" onClick={() => onDelete?.(row)}>Supprimer</button></div> : <span className="text-xs font-black text-slate-400">Protege</span>}</Td></tr>)}</tbody>
    </table>
  );
}

function AdminUserForm({ user, pending, onSubmit, onCancel }: Readonly<{ user: AdminUser | null; pending: boolean; onSubmit: (payload: AdminUserPayload) => void; onCancel: () => void }>) {
  const [form, setForm] = useState<AdminUserPayload>({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    password: "",
    is_staff: user?.is_staff ?? true,
    is_superuser: user?.is_superuser ?? false,
    is_active: user?.status !== "disabled"
  });

  function update<K extends keyof AdminUserPayload>(key: K, value: AdminUserPayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black">{user ? "Modifier l'utilisateur admin" : "Creer un utilisateur admin"}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Les utilisateurs lies a un workspace application restent en lecture seule.</p>
        </div>
        <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-black" type="button" onClick={onCancel}>Annuler</button>
      </div>
      <div className="mt-5 grid grid-cols-4 gap-3">
        <AdminInput label="Prenom" value={form.first_name} onChange={(value) => update("first_name", value)} />
        <AdminInput label="Nom" value={form.last_name} onChange={(value) => update("last_name", value)} />
        <AdminInput label="Email" value={form.email} onChange={(value) => update("email", value)} />
        <AdminInput label="Telephone" value={form.phone} onChange={(value) => update("phone", value)} />
        <AdminInput label={user ? "Nouveau mot de passe" : "Mot de passe"} value={form.password || ""} type="password" onChange={(value) => update("password", value)} />
        <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-bold"><input checked={form.is_staff} type="checkbox" onChange={(event) => update("is_staff", event.target.checked)} /> Staff</label>
        <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-bold"><input checked={form.is_superuser} type="checkbox" onChange={(event) => update("is_superuser", event.target.checked)} /> Super-admin</label>
        <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-bold"><input checked={form.is_active} type="checkbox" onChange={(event) => update("is_active", event.target.checked)} /> Actif</label>
      </div>
      <button className="mt-5 min-h-11 rounded-md bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-50" type="button" disabled={pending} onClick={() => onSubmit(form)}>
        {pending ? "Enregistrement..." : user ? "Modifier" : "Creer"}
      </button>
    </section>
  );
}

function AdminInput({ label, value, type = "text", onChange }: Readonly<{ label: string; value: string; type?: string; onChange: (value: string) => void }>) {
  return <label className="grid gap-2 text-sm font-black text-slate-700">{label}<input className="h-11 rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-600" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function AdminPlanForm({ plan, pending, onSubmit, onCancel }: Readonly<{ plan: AdminPlan | null; pending: boolean; onSubmit: (payload: AdminPlanPayload) => void; onCancel: () => void }>) {
  const [form, setForm] = useState({
    code: plan?.code || "",
    name: plan?.name || "",
    price: String(plan?.price || "0"),
    currency: plan?.currency || "XOF",
    billing_period: plan?.billing_period || "month",
    is_active: plan?.is_active ?? true
  });
  const [entitlementsText, setEntitlementsText] = useState(JSON.stringify(plan?.entitlements || {}, null, 2));
  const [jsonError, setJsonError] = useState("");

  function update(key: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    try {
      const entitlements = JSON.parse(entitlementsText || "{}") as Record<string, unknown>;
      if (!entitlements || Array.isArray(entitlements) || typeof entitlements !== "object") {
        setJsonError("Les fonctionnalites doivent etre un objet JSON.");
        return;
      }
      setJsonError("");
      onSubmit({ ...form, entitlements });
    } catch {
      setJsonError("Les fonctionnalites doivent etre un JSON valide.");
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black">{plan ? "Modifier l'offre" : "Creer une offre"}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Les changements s'appliquent au catalogue visible par les associations.</p>
        </div>
        <button className="rounded-md border border-slate-200 px-3 py-2 text-sm font-black" type="button" onClick={onCancel}>Annuler</button>
      </div>
      <div className="mt-5 grid grid-cols-4 gap-3">
        <AdminInput label="Code" value={form.code} onChange={(value) => update("code", value)} />
        <AdminInput label="Nom" value={form.name} onChange={(value) => update("name", value)} />
        <AdminInput label="Prix" type="number" value={form.price} onChange={(value) => update("price", value)} />
        <AdminInput label="Devise" value={form.currency} onChange={(value) => update("currency", value)} />
        <label className="grid gap-2 text-sm font-black text-slate-700">
          Periode
          <select className="h-11 rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-600" value={form.billing_period} onChange={(event) => update("billing_period", event.target.value)}>
            <option value="trial">Essai</option>
            <option value="month">Mensuel</option>
            <option value="year">Annuel</option>
          </select>
        </label>
        <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-bold"><input checked={form.is_active} type="checkbox" onChange={(event) => update("is_active", event.target.checked)} /> Offre active</label>
      </div>
      <label className="mt-5 grid gap-2 text-sm font-black text-slate-700">
        Fonctionnalites JSON
        <textarea className="min-h-40 rounded-md border border-slate-200 p-3 font-mono text-xs font-semibold outline-none focus:border-blue-600" value={entitlementsText} onChange={(event) => setEntitlementsText(event.target.value)} />
      </label>
      {jsonError ? <p className="mt-2 text-sm font-black text-red-700">{jsonError}</p> : null}
      <button className="mt-5 min-h-11 rounded-md bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-50" type="button" disabled={pending} onClick={submit}>
        {pending ? "Enregistrement..." : plan ? "Modifier l'offre" : "Creer l'offre"}
      </button>
    </section>
  );
}

function SubscriptionRows({ data }: Readonly<{ data: Paginated<AdminSubscription> }>) {
  return (
    <table className="w-full min-w-[1100px] text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><Th>Association</Th><Th>Plan</Th><Th>Statut</Th><Th>Debut</Th><Th>Fin</Th><Th>Montant</Th><Th>Derniere transaction</Th></tr></thead>
      <tbody>{data.results.map((row) => <tr className="border-t border-slate-100" key={row.id}><Td strong>{row.association}</Td><Td>{row.plan}</Td><Td><Badge>{row.status}</Badge></Td><Td>{dateLabel(row.started_at)}</Td><Td>{dateLabel(row.ends_at)}</Td><Td>{money(row.amount, row.currency)}</Td><Td>{row.last_payment || "Aucune"}</Td></tr>)}</tbody>
    </table>
  );
}

function PaymentRows({ data }: Readonly<{ data: Paginated<AdminPayment> }>) {
  return (
    <table className="w-full min-w-[1180px] text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><Th>Date</Th><Th>Association</Th><Th>Plan</Th><Th>Montant</Th><Th>Methode</Th><Th>Statut</Th><Th>Reference</Th><Th>Facture</Th></tr></thead>
      <tbody>{data.results.map((row) => <tr className="border-t border-slate-100" key={row.id}><Td>{dateLabel(row.date)}</Td><Td strong>{row.association}</Td><Td>{row.plan}</Td><Td>{money(row.amount, row.currency)}</Td><Td>{row.method}</Td><Td><Badge>{row.status}</Badge></Td><Td>{row.reference}</Td><Td>{row.invoice || "Non generee"}</Td></tr>)}</tbody>
    </table>
  );
}

function ActivityRows({ data }: Readonly<{ data: Paginated<AdminActivity> }>) {
  return (
    <table className="w-full min-w-[1100px] text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><Th>Date</Th><Th>Acteur</Th><Th>Action</Th><Th>Ressource</Th><Th>Association</Th><Th>IP</Th></tr></thead>
      <tbody>{data.results.map((row) => <tr className="border-t border-slate-100" key={row.id}><Td>{dateLabel(row.created_at)}</Td><Td>{row.actor}</Td><Td strong>{row.action}</Td><Td>{row.resource}</Td><Td>{row.association}</Td><Td>{row.ip_address || "Non disponible"}</Td></tr>)}</tbody>
    </table>
  );
}

function ActivityList({ rows }: Readonly<{ rows: AdminActivity[] }>) {
  return <Panel title="Activite recente">{rows.length ? rows.map((row) => <div className="border-b border-slate-100 py-3 last:border-b-0" key={row.id}><p className="font-black">{row.action}</p><p className="text-xs font-semibold text-slate-500">{row.association} - {row.actor} - {dateLabel(row.created_at)}</p></div>) : <Empty message="Aucune activite recente." />}</Panel>;
}

function PlanCard({ plan, onEdit, onDelete }: Readonly<{ plan: AdminPlan; onEdit?: (plan: AdminPlan) => void; onDelete?: (plan: AdminPlan) => void }>) {
  const entitlementCount = Object.values(plan.entitlements || {}).filter(Boolean).length;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between"><div><h2 className="text-xl font-black">{plan.name}</h2><p className="text-sm font-semibold text-slate-500">{plan.code}</p></div><Badge>{plan.is_active ? "Actif" : "Inactif"}</Badge></div>
      <p className="mt-6 text-3xl font-black">{money(plan.price, plan.currency)}</p>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm"><Info label="Abonnements" value={plan.subscriptions} /><Info label="Revenus" value={money(plan.revenue, plan.currency)} /><Info label="Periode" value={plan.billing_period} /><Info label="Entitlements" value={entitlementCount} /></div>
      <div className="mt-5 flex gap-2">
        <button className="min-h-10 flex-1 rounded-md bg-slate-950 px-3 text-sm font-black text-white" type="button" onClick={() => onEdit?.(plan)}>Modifier</button>
        <button
          className="min-h-10 flex-1 rounded-md bg-red-600 px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          type="button"
          disabled={plan.subscriptions > 0}
          title={plan.subscriptions > 0 ? "Ce plan est deja utilise par des abonnements." : "Supprimer ce plan"}
          onClick={() => {
            if (window.confirm(`Supprimer l'offre ${plan.name} ?`)) onDelete?.(plan);
          }}
        >
          Supprimer
        </button>
      </div>
    </section>
  );
}

function BarSeries({ rows, money: isMoney = false }: Readonly<{ rows: Array<{ label: string; value: number }>; money?: boolean }>) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return <div className="flex h-64 items-end gap-3 border-b border-l border-slate-200 px-4 pt-4">{rows.length ? rows.map((row) => <div className="flex flex-1 flex-col items-center gap-2" key={`${row.label}-${row.value}`}><div className="w-full rounded-t-md bg-blue-600" style={{ height: `${Math.max((row.value / max) * 200, 4)}px` }} /><span className="text-xs font-bold text-slate-500">{row.label}</span><span className="text-[11px] font-black">{isMoney ? compactMoney(row.value) : row.value}</span></div>) : <Empty message="Pas encore de donnees." />}</div>;
}

function PlanDistribution({ rows }: Readonly<{ rows: Array<{ plan__name: string; count: number }> }>) {
  const total = rows.reduce((sum, row) => sum + row.count, 0) || 1;
  return <div className="grid gap-3">{rows.length ? rows.map((row) => <div key={row.plan__name}><div className="flex justify-between text-sm font-black"><span>{row.plan__name}</span><span>{Math.round((row.count / total) * 100)}%</span></div><div className="mt-2 h-3 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${(row.count / total) * 100}%` }} /></div></div>) : <Empty message="Aucun abonnement." />}</div>;
}

function AlertRow({ alert }: Readonly<{ alert: { level: string; title: string; description: string } }>) {
  return <div className={`rounded-md border p-3 ${alert.level === "critical" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}><p className="font-black">{alert.title}</p><p className="mt-1 text-sm font-semibold">{alert.description}</p></div>;
}

function Th({ children }: Readonly<{ children: React.ReactNode }>) {
  return <th className="px-4 py-3 font-black">{children}</th>;
}

function Td({ children, strong = false }: Readonly<{ children: React.ReactNode; strong?: boolean }>) {
  return <td className={`px-4 py-3 align-top ${strong ? "font-black" : "font-semibold text-slate-600"}`}>{children}</td>;
}

function Badge({ children }: Readonly<{ children: React.ReactNode }>) {
  return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{children}</span>;
}

function Info({ label, value }: Readonly<{ label: string; value: React.ReactNode }>) {
  return <div className="rounded-md bg-slate-50 p-3"><p className="text-xs font-black text-slate-500">{label}</p><p className="mt-1 font-black">{value}</p></div>;
}

function Empty({ message }: Readonly<{ message: string }>) {
  return <p className="rounded-md bg-slate-50 p-4 text-sm font-bold text-slate-500">{message}</p>;
}

function ErrorPanel({ message }: Readonly<{ message: string }>) {
  return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{message}</div>;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function SkeletonRows() {
  return <div className="grid gap-3 p-5">{Array.from({ length: 4 }).map((_, index) => <div className="h-14 animate-pulse rounded-md bg-slate-200" key={index} />)}</div>;
}

function dateLabel(value?: string | null) {
  if (!value) return "Non disponible";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
}

function dateTimeLabel(value?: string | null) {
  if (!value) return "Non disponible";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function monthLabel(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(new Date(value));
}

function money(value: unknown, currency = "XOF") {
  const amount = typeof value === "number" ? value : Number(value || 0);
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function compactMoney(value: number) {
  return new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
