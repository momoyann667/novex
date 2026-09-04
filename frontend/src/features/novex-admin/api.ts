import { apiFetch } from "@/lib/api/client";

export type AdminSection = "dashboard" | "associations" | "users" | "subscriptions" | "payments" | "plans" | "activity" | "audit" | "reports" | "settings";

export type Paginated<T> = {
  count: number;
  page: number;
  page_size: number;
  next: number | null;
  previous: number | null;
  results: T[];
};

export type AdminDashboard = {
  period: string;
  kpis: Record<string, number | string>;
  charts: {
    associations_growth: Array<{ month: string; new: number }>;
    registrations: Array<{ month: string; new: number }>;
    revenue: Array<{ month: string; total: string }>;
    plan_distribution: Array<{ plan__name: string; plan__code: string; count: number }>;
    status_distribution: Array<{ status: string; count: number }>;
    revenue_by_plan: Array<{ metadata__plan_name: string; total: string; count: number }>;
    mrr: Array<{ month: string; total: string }>;
    arr: Array<{ month: string; total: string }>;
    conversion: Record<string, number>;
    churn: Record<string, number>;
  };
  recent_activity: AdminActivity[];
  recent_associations: AdminAssociation[];
  alerts: Array<{ level: string; title: string; description: string }>;
};

export type AdminAssociation = {
  id: number;
  name: string;
  slug: string;
  status: string;
  country: string;
  currency: string;
  admin: string;
  plan: string;
  members: number;
  created_at: string;
  last_activity?: string | null;
};

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  username: string;
  status: string;
  is_staff: boolean;
  joined_at: string;
  last_login: string | null;
  workspaces: Array<{ name: string; slug: string; role: string }>;
};

export type AdminSubscription = {
  id: number;
  association: string;
  workspace_slug: string;
  plan: string;
  plan_code: string;
  status: string;
  started_at: string | null;
  ends_at: string | null;
  amount: string;
  currency: string;
  last_payment: string;
};

export type AdminPayment = {
  id: number;
  date: string;
  association: string;
  workspace_slug: string;
  plan: string;
  amount: string;
  currency: string;
  method: string;
  status: string;
  reference: string;
  provider: string;
  provider_reference: string;
  invoice: string;
};

export type AdminPlan = {
  id: number;
  code: string;
  name: string;
  price: string;
  currency: string;
  billing_period: string;
  is_active: boolean;
  entitlements: Record<string, unknown>;
  subscriptions: number;
  revenue: string;
};

export type AdminActivity = {
  id: number;
  actor: string;
  action: string;
  resource: string;
  resource_id?: string;
  association: string;
  ip_address?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
};

function qs(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const value = search.toString();
  return value ? `?${value}` : "";
}

export function getAdminDashboard(period: string) {
  return apiFetch<AdminDashboard>(`/admin/dashboard/${qs({ period })}`);
}

export function getAdminAssociations(params: Record<string, string | number | undefined>) {
  return apiFetch<Paginated<AdminAssociation>>(`/admin/associations/${qs(params)}`);
}

export function suspendAdminAssociation(id: number, reason: string) {
  return apiFetch(`/admin/associations/${id}/suspend/`, {
    method: "POST",
    body: JSON.stringify({ reason })
  });
}

export function activateAdminAssociation(id: number, reason: string) {
  return apiFetch(`/admin/associations/${id}/activate/`, {
    method: "POST",
    body: JSON.stringify({ reason })
  });
}

export function getAdminUsers(params: Record<string, string | number | undefined>) {
  return apiFetch<Paginated<AdminUser>>(`/admin/users/${qs(params)}`);
}

export function getAdminSubscriptions(params: Record<string, string | number | undefined>) {
  return apiFetch<Paginated<AdminSubscription>>(`/admin/subscriptions/${qs(params)}`);
}

export function getAdminPayments(params: Record<string, string | number | undefined>) {
  return apiFetch<Paginated<AdminPayment>>(`/admin/payments/${qs(params)}`);
}

export function getAdminPlans() {
  return apiFetch<{ results: AdminPlan[] }>("/admin/plans/");
}

export function getAdminActivity(params: Record<string, string | number | undefined>) {
  return apiFetch<Paginated<AdminActivity>>(`/admin/activity/${qs(params)}`);
}

export function getAdminAudit(params: Record<string, string | number | undefined>) {
  return apiFetch<Paginated<AdminActivity>>(`/admin/audit/${qs(params)}`);
}

export function getAdminReports(period: string) {
  return apiFetch<Record<string, unknown>>(`/admin/reports/${qs({ period })}`);
}

export function getAdminSettings() {
  return apiFetch<Record<string, unknown>>("/admin/settings/");
}
