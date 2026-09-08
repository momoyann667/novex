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
