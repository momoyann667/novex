import { apiFetch } from "@/lib/api/client";
import { isInvalidWorkspaceSlug } from "@/lib/workspace/routing";

export type SupportTicketStatus = "PENDING" | "IN_PROGRESS" | "RESOLVED";

export type SupportTicketMessage = {
  id: number;
  author_name: string;
  body: string;
  is_admin_reply: boolean;
  created_at: string;
};

export type SupportTicket = {
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
  status: SupportTicketStatus;
  status_label: string;
  taken_at: string | null;
  taken_by_name: string;
  resolved_at: string | null;
  resolved_by_name: string;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  messages: SupportTicketMessage[];
};

export type SupportCategory = { value: string; label: string };
export type SupportStats = { total: number; pending: number; in_progress: number; resolved: number };
export type SupportQuota = { monthly_limit: number; used: number; remaining: number; period_start: string; period_end: string };

export type Paginated<T> = {
  count: number;
  page: number;
  page_size: number;
  next: number | null;
  previous: number | null;
  results: T[];
};

export type CreatorTicketsResponse = {
  stats: SupportStats;
  quota: SupportQuota;
  categories: SupportCategory[];
  tickets: Paginated<SupportTicket>;
};

function workspaceHeaders(workspaceSlug: string) {
  if (isInvalidWorkspaceSlug(workspaceSlug)) throw new Error("Workspace invalide.");
  return { "X-Workspace": workspaceSlug };
}

function qs(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const value = search.toString();
  return value ? `?${value}` : "";
}

export function getCreatorTickets(workspaceSlug: string, params: Record<string, string | number | undefined> = {}) {
  return apiFetch<CreatorTicketsResponse>(`/support/tickets/${qs(params)}`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export function createCreatorTicket(workspaceSlug: string, payload: { subject: string; description: string; category: string }) {
  return apiFetch<SupportTicket>("/support/tickets/", {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify(payload)
  });
}

export function replyCreatorTicket(workspaceSlug: string, ticketId: number, body: string) {
  return apiFetch<SupportTicket>(`/support/tickets/${ticketId}/reply/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify({ body })
  });
}
