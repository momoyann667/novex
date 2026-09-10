import { apiFetch } from "@/lib/api/client";

export type AdminSection = "dashboard" | "associations" | "users" | "subscriptions" | "payments" | "tickets" | "plans" | "activity" | "audit" | "reports" | "settings";

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
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  phone: string;
  status: string;
  is_staff: boolean;
  is_superuser: boolean;
  source: "application" | "admin";
  can_manage: boolean;
  joined_at: string;
  last_login: string | null;
  workspaces: Array<{ name: string; slug: string; role: string }>;
};

export type AdminUserPayload = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password?: string;
  is_staff: boolean;
  is_superuser: boolean;
  is_active?: boolean;
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

export type AdminSupportTicket = {
  id: number;
  ticket_number: string;
  workspace_name: string;
  workspace_slug: string;
  creator_name: string;
  creator_email: string;
  subject: string;
  description: string;
  category: string;
  category_label: string;
  status: "PENDING" | "IN_PROGRESS" | "RESOLVED";
  status_label: string;
  taken_at: string | null;
  taken_by_name: string;
  resolved_at: string | null;
  resolved_by_name: string;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  messages: Array<{ id: number; author_name: string; body: string; is_admin_reply: boolean; created_at: string }>;
};

export type AdminSupportTicketsResponse = {
  stats: { total: number; pending: number; in_progress: number; resolved: number };
  tickets: Paginated<AdminSupportTicket>;
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

export function createAdminUser(payload: AdminUserPayload) {
  return apiFetch<AdminUser>("/admin/users/", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateAdminUser(id: number, payload: AdminUserPayload) {
  return apiFetch<AdminUser>(`/admin/users/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteAdminUser(id: number) {
  return apiFetch<void>(`/admin/users/${id}/`, {
    method: "DELETE"
  });
}

export function getAdminSubscriptions(params: Record<string, string | number | undefined>) {
  return apiFetch<Paginated<AdminSubscription>>(`/admin/subscriptions/${qs(params)}`);
}

export function getAdminPayments(params: Record<string, string | number | undefined>) {
  return apiFetch<Paginated<AdminPayment>>(`/admin/payments/${qs(params)}`);
}

export function getAdminTickets(params: Record<string, string | number | undefined>) {
  return apiFetch<AdminSupportTicketsResponse>(`/admin/tickets/${qs(params)}`);
}

export function updateAdminTicketStatus(id: number, status: "PENDING" | "IN_PROGRESS" | "RESOLVED") {
  return apiFetch<AdminSupportTicket>(`/admin/tickets/${id}/status/`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
}

export function replyAdminTicket(id: number, body: string) {
  return apiFetch<AdminSupportTicket>(`/admin/tickets/${id}/reply/`, {
    method: "POST",
    body: JSON.stringify({ body })
  });
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
