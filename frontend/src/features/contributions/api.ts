import { ApiError, apiFetch } from "@/lib/api/client";
import { isInvalidWorkspaceSlug } from "@/lib/workspace/routing";

export type ContributionStatus = "PENDING" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED" | "WAIVED";
export type ContributionPeriod = "today" | "week" | "month" | "quarter" | "semester" | "year" | "all";

export type ContributionCampaign = {
  id: number;
  name: string;
  contribution_type: string;
  amount: string | number;
  currency: string;
  period_label: string;
  due_date: string | null;
  status: string;
};

export type MemberFilterOption = {
  id: number;
  name: string;
};

export type ContributionDashboard = {
  total_expected: string | number;
  total_collected: string | number;
  total_remaining: string | number;
  collection_rate: string | number;
  total_overdue?: string | number;
  members_concerned?: number;
  members_paid: number;
  members_partial: number;
  members_overdue: number;
  members_unpaid: number;
  waived: number;
  active_campaigns: number;
  upcoming_due: number;
  period: string;
  statuses?: Record<string, number>;
  series?: Array<{ period: string; expected: string | number; collected: string | number }>;
  payment_methods?: Array<{ method: string; label: string; amount: string | number; count: number }>;
  categories?: Array<{ label: string; expected: string | number; collected: string | number; collection_rate?: number }>;
};

export type ContributionAnalytics = {
  expected_amount: string | number;
  collected_amount: string | number;
  remaining_amount: string | number;
  collection_rate: string | number;
  collection_goal: string | number;
  overdue_amount: string | number;
  overdue_members: number;
  paid_members: number;
  partial_members: number;
  unpaid_members: number;
  trend?: Record<string, { value: number | null; direction: "up" | "down" | "flat" }>;
  series: Array<{ period: string; expected: string | number; collected: string | number }>;
  payment_methods?: Array<{ method: string; label: string; amount: string | number; count: number }>;
  overdue_segments: Array<{ label: string; count: number; amount: string | number }>;
  top_unpaid: Array<{ member_id: number; member_name: string; phone: string; amount_remaining: string | number }>;
  upcoming: Record<string, { days: number; members: number; amount_expected: string | number; items: number }>;
  campaign_performance: Array<{ campaign_id: number; campaign_name: string; total_expected: string | number; total_collected: string | number; total_remaining: string | number; collection_rate: number }>;
  type_performance: Array<{ type: string; label: string; expected: string | number; collected: string | number; remaining: string | number; collection_rate: number }>;
};

export type ContributionResource = {
  id: number;
  campaign: number;
  member: number;
  member_name: string;
  amount_due: string | number;
  amount_paid: string | number;
  waived_amount: string | number;
  remaining_amount: string | number;
  currency: string;
  due_date: string | null;
  status: ContributionStatus;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ContributionList = {
  count: number;
  next: string | null;
  previous: string | null;
  results: ContributionResource[];
};

export type ContributionMemberSummary = {
  member_id: number;
  member_name: string;
  phone: string;
  status: "A_JOUR" | "PARTIEL" | "NON_PAYE" | "EN_RETARD";
  expected: string | number;
  collected: string | number;
  waived: string | number;
  remaining: string | number;
  collection_rate: number;
  next_due: string | null;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type ContributionFilters = {
  period?: ContributionPeriod;
  campaign?: string;
  status?: string;
  search?: string;
  paymentMethod?: string;
  category?: string;
  group?: string;
  ordering?: string;
  page?: number;
  pageSize?: number;
};

export type ManualPaymentPayload = {
  amount: string;
  paid_at?: string;
  payment_method: string;
  document_reference?: string;
};

function workspaceHeaders(workspaceSlug: string) {
  if (isInvalidWorkspaceSlug(workspaceSlug)) {
    throw new ApiError("Workspace invalide. Reconnecte-toi pour ouvrir ton association.", 400);
  }
  return { "X-Workspace": workspaceSlug };
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "all") query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

function unwrapPaginated<T>(payload: T[] | Paginated<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results;
}

export async function getContributionDashboard(workspaceSlug: string, period: ContributionPeriod, campaign?: string) {
  return apiFetch<ContributionDashboard>(`/contributions/dashboard/${buildQuery({ period, campaign })}`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export async function getContributionAnalytics(workspaceSlug: string, period: ContributionPeriod, campaign?: string) {
  return apiFetch<ContributionAnalytics>(`/contributions/analytics/${buildQuery({ period, campaign, range: "12m" })}`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export async function listContributionCampaigns(workspaceSlug: string) {
  const payload = await apiFetch<ContributionCampaign[] | Paginated<ContributionCampaign>>("/contributions/campaigns/?ordering=-created_at", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
  return unwrapPaginated(payload);
}

export async function listContributionCategories(workspaceSlug: string) {
  const payload = await apiFetch<MemberFilterOption[] | Paginated<MemberFilterOption>>("/members/categories/", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
  return unwrapPaginated(payload);
}

export async function listContributionGroups(workspaceSlug: string) {
  const payload = await apiFetch<MemberFilterOption[] | Paginated<MemberFilterOption>>("/members/groups/", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
  return unwrapPaginated(payload);
}

export async function listContributions(workspaceSlug: string, filters: ContributionFilters) {
  const payload = await apiFetch<ContributionResource[] | ContributionList>(
    `/contributions/${buildQuery({
      campaign: filters.campaign,
      period: filters.period,
      category: filters.category,
      group: filters.group,
      payment_method: filters.paymentMethod,
      status: filters.status,
      search: filters.search,
      ordering: filters.ordering || "due_date",
      page: filters.page,
      page_size: filters.pageSize || 12
    })}`,
    { headers: workspaceHeaders(workspaceSlug), cache: "no-store" }
  );
  return Array.isArray(payload) ? { count: payload.length, next: null, previous: null, results: payload } : payload;
}

export async function listContributionMembers(workspaceSlug: string, filters: Pick<ContributionFilters, "status"> = {}) {
  const statusMap: Record<string, string> = {
    PAID: "A_JOUR",
    PARTIALLY_PAID: "PARTIEL",
    PENDING: "NON_PAYE",
    OVERDUE: "EN_RETARD"
  };
  return apiFetch<ContributionMemberSummary[]>(
    `/contributions/members-summary/${buildQuery({ status: filters.status ? statusMap[filters.status] || filters.status : undefined })}`,
    { headers: workspaceHeaders(workspaceSlug), cache: "no-store" }
  );
}

export async function recordContributionPayment(workspaceSlug: string, contributionId: number, payload: ManualPaymentPayload) {
  return apiFetch<{ payment_id: number; status: string }>(`/contributions/${contributionId}/payments/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify({
      ...payload,
      idempotency_key: `manual-${contributionId}-${Date.now()}`
    })
  });
}

export async function sendContributionReminder(workspaceSlug: string, contributionId: number) {
  return apiFetch(`/contributions/${contributionId}/send-reminder/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify({ channel: "IN_APP", reminder_kind: "REMINDER", send_now: true })
  });
}

export async function requestContributionExport(workspaceSlug: string, filters: ContributionFilters, exportFormat = "CSV") {
  return apiFetch<{ id: number; status: string; export_format: string }>("/contributions/exports/", {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify({
      export_type: "filtered_contributions",
      export_format: exportFormat,
      filters
    })
  });
}
