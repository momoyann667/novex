"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Building2, CreditCard, Layers3, RefreshCw, ShieldCheck, Users } from "lucide-react";
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
  getAdminUsers,
  activateAdminAssociation,
  suspendAdminAssociation,
  type AdminActivity,
  type AdminAssociation,
  type AdminDashboard,
  type AdminPayment,
  type AdminPlan,
  type AdminSection,
  type AdminSubscription,
  type AdminUser,
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
  const query = useQuery({ queryKey: ["novex-admin-users", search], queryFn: () => getAdminUsers({ search }) });
  return <TablePanel title="Utilisateurs NOVEX" search={search} setSearch={setSearch}>{query.data ? <UserRows data={query.data} /> : <SkeletonRows />}</TablePanel>;
}

function SubscriptionsSection({ search, setSearch }: Readonly<{ search: string; setSearch: (value: string) => void }>) {
  const query = useQuery({ queryKey: ["novex-admin-subscriptions", search], queryFn: () => getAdminSubscriptions({ search }) });
  return <TablePanel title="Abonnements des associations" search={search} setSearch={setSearch}>{query.data ? <SubscriptionRows data={query.data} /> : <SkeletonRows />}</TablePanel>;
}

function PaymentsSection({ search, setSearch }: Readonly<{ search: string; setSearch: (value: string) => void }>) {
  const query = useQuery({ queryKey: ["novex-admin-payments", search], queryFn: () => getAdminPayments({ search }) });
  return <TablePanel title="Historique des paiements SaaS" search={search} setSearch={setSearch}>{query.data ? <PaymentRows data={query.data} /> : <SkeletonRows />}</TablePanel>;
}

function PlansSection() {
  const query = useQuery({ queryKey: ["novex-admin-plans"], queryFn: getAdminPlans });
  return (
    <div className="grid grid-cols-3 gap-5">
      {query.data?.results.map((plan) => <PlanCard plan={plan} key={plan.code} />) || <SkeletonRows />}
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

function AssociationRows({ data, onStatusChange }: Readonly<{ data: Paginated<AdminAssociation>; onStatusChange?: (id: number, status: string) => void }>) {
  return (
    <table className="w-full min-w-[980px] text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><Th>Association</Th><Th>Admin</Th><Th>Plan</Th><Th>Statut</Th><Th>Membres</Th><Th>Creee le</Th><Th>Derniere activite</Th><Th>Actions</Th></tr></thead>
      <tbody>{data.results.map((row) => <tr className="border-t border-slate-100" key={row.id}><Td strong>{row.name}</Td><Td>{row.admin}</Td><Td>{row.plan}</Td><Td><Badge>{row.status}</Badge></Td><Td>{row.members}</Td><Td>{dateLabel(row.created_at)}</Td><Td>{row.last_activity ? dateLabel(row.last_activity) : "Non disponible"}</Td><Td>{onStatusChange ? <button className={`rounded-md px-3 py-2 text-xs font-black ${row.status === "suspended" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`} type="button" onClick={() => onStatusChange(row.id, row.status === "suspended" ? "active" : "suspended")}>{row.status === "suspended" ? "Reactiver" : "Suspendre"}</button> : "Voir"}</Td></tr>)}</tbody>
    </table>
  );
}

function UserRows({ data }: Readonly<{ data: Paginated<AdminUser> }>) {
  return (
    <table className="w-full min-w-[980px] text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><Th>Utilisateur</Th><Th>Email</Th><Th>Statut</Th><Th>Associations</Th><Th>Inscription</Th><Th>Derniere connexion</Th></tr></thead>
      <tbody>{data.results.map((row) => <tr className="border-t border-slate-100" key={row.id}><Td strong>{row.name}</Td><Td>{row.email}</Td><Td><Badge>{row.status}</Badge></Td><Td>{row.workspaces.map((item) => item.name).join(", ") || "Aucune"}</Td><Td>{dateLabel(row.joined_at)}</Td><Td>{row.last_login ? dateLabel(row.last_login) : "Jamais"}</Td></tr>)}</tbody>
    </table>
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

function PlanCard({ plan }: Readonly<{ plan: AdminPlan }>) {
  const entitlementCount = Object.values(plan.entitlements || {}).filter(Boolean).length;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between"><div><h2 className="text-xl font-black">{plan.name}</h2><p className="text-sm font-semibold text-slate-500">{plan.code}</p></div><Badge>{plan.is_active ? "Actif" : "Inactif"}</Badge></div>
      <p className="mt-6 text-3xl font-black">{money(plan.price, plan.currency)}</p>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm"><Info label="Abonnements" value={plan.subscriptions} /><Info label="Revenus" value={money(plan.revenue, plan.currency)} /><Info label="Periode" value={plan.billing_period} /><Info label="Entitlements" value={entitlementCount} /></div>
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

function SkeletonRows() {
  return <div className="grid gap-3 p-5">{Array.from({ length: 4 }).map((_, index) => <div className="h-14 animate-pulse rounded-md bg-slate-200" key={index} />)}</div>;
}

function dateLabel(value?: string | null) {
  if (!value) return "Non disponible";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
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
