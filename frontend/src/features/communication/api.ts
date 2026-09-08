import { ApiError, apiFetch } from "@/lib/api/client";
import { isInvalidWorkspaceSlug } from "@/lib/workspace/routing";

export type CommunicationMember = {
  id: number;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  function: string;
  status: string;
  groups_detail?: Array<{ id: number; name: string }>;
};

export type ContributionMemberRecovery = {
  member_id: number;
  member_name: string;
  phone: string;
  remaining: string | number;
  status: string;
  items?: Array<{ id: number; remaining_amount: string | number; status: string }>;
};

export type BackendCommunication = {
  id: number;
  communication_type: "ANNOUNCEMENT" | "BROADCAST" | "DIRECT_NOTIFICATION" | "SYSTEM_NOTIFICATION";
  title: string;
  content: string;
  category: string;
  priority: string;
  status: "DRAFT" | "SCHEDULED" | "PROCESSING" | "SENT" | "PARTIALLY_SENT" | "FAILED" | "CANCELLED";
  audience_type: "ALL_MEMBERS" | "ACTIVE_MEMBERS" | "CATEGORY" | "FUNCTION" | "SEGMENT" | "SELECTED_MEMBERS";
  audience_filters: Record<string, unknown>;
  audience_snapshot: { total?: number; member_ids?: number[]; truncated?: boolean };
  channels: Array<"IN_APP" | "PUSH" | "EMAIL" | "SMS" | "WHATSAPP">;
  scheduled_at: string | null;
  sent_at: string | null;
  recipients_count: number;
  created_at: string;
  updated_at: string;
};

export type CommunicationPayload = {
  communication_type: BackendCommunication["communication_type"];
  title: string;
  content: string;
  audience_type: BackendCommunication["audience_type"];
  audience_filters?: Record<string, unknown>;
  channels: BackendCommunication["channels"];
  category?: string;
  priority?: string;
  scheduled_at?: string | null;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function workspaceHeaders(workspaceSlug: string) {
  if (isInvalidWorkspaceSlug(workspaceSlug)) {
    throw new ApiError("Workspace invalide. Reconnecte-toi pour ouvrir ton association.", 400);
  }
  return { "X-Workspace": workspaceSlug };
}

function unwrapList<T>(payload: T[] | Paginated<T>) {
  return Array.isArray(payload) ? payload : payload.results;
}

export async function listCommunicationMembers(workspaceSlug: string) {
  const payload = await apiFetch<CommunicationMember[] | Paginated<CommunicationMember>>("/members/?ordering=last_name&page_size=500", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
  return unwrapList(payload);
}

export async function listContributionRecoveryMembers(workspaceSlug: string) {
  return apiFetch<ContributionMemberRecovery[]>("/contributions/members-summary/", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export async function listCommunications(workspaceSlug: string) {
  const payload = await apiFetch<BackendCommunication[] | Paginated<BackendCommunication>>("/communication/?ordering=-created_at&page_size=500", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
  return unwrapList(payload);
}

export async function createCommunication(workspaceSlug: string, payload: CommunicationPayload) {
  return apiFetch<BackendCommunication>("/communication/", {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify(payload)
  });
}

export async function sendCommunication(workspaceSlug: string, communicationId: number) {
  return apiFetch<BackendCommunication>(`/communication/${communicationId}/send/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify({ send_now: true })
  });
}

export async function scheduleCommunication(workspaceSlug: string, communicationId: number, scheduledAt: string) {
  return apiFetch<BackendCommunication>(`/communication/${communicationId}/schedule/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify({ scheduled_at: scheduledAt })
  });
}
