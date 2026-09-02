import { ApiError, apiFetch } from "@/lib/api/client";
import { isInvalidWorkspaceSlug } from "@/lib/workspace/routing";
import type { MemberOption } from "@/features/projects/api";

export type IncomeSource = "CONTRIBUTION" | "DONATION" | "GRANT" | "SPONSORSHIP";
export type SenderType = "MEMBER" | "OTHER";

export type IncomeCategory = {
  id: number;
  name: string;
  kind: string;
};

export type IncomeResource = {
  id: number;
  amount: string | number;
  currency: string;
  category: number;
  category_name: string;
  description: string;
  reference: string;
  transaction_date: string;
  status: string;
  source: string;
  sender_type: SenderType;
  member: number | null;
  member_name: string;
  sender_name: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type IncomeSummary = {
  mandate: { id: number | null; label: string; start: string; end: string };
  currency: string;
  total_revenue: string | number;
  monthly_revenue: string | number;
  month: { value: number; label: string; start: string; end: string };
  annual_target: string | number;
  target_progress: string | number;
  revenue_by_source: Array<{ source: IncomeSource; label: string; amount: string | number; percentage: string | number }>;
};

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type IncomePayload = {
  description: string;
  amount: string;
  category: number;
  transaction_date: string;
  source: IncomeSource;
  sender_type: SenderType;
  member?: number | null;
  sender_name?: string;
  notes?: string;
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
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

export function getIncomeSummary(workspaceSlug: string, month?: number) {
  return apiFetch<IncomeSummary>(`/finance/income/summary/${buildQuery({ month })}`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export function listIncome(workspaceSlug: string, page = 1) {
  return apiFetch<Paginated<IncomeResource>>(`/finance/income/${buildQuery({ page, page_size: 5, ordering: "-transaction_date" })}`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export function listIncomeCategories(workspaceSlug: string) {
  return apiFetch<IncomeCategory[]>("/finance/income/categories/", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export function listIncomeMembers(workspaceSlug: string) {
  return apiFetch<Paginated<MemberOption> | MemberOption[]>("/members/?ordering=last_name", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  }).then((payload) => Array.isArray(payload) ? payload : payload.results);
}

export function createIncome(workspaceSlug: string, payload: IncomePayload) {
  return apiFetch<IncomeResource>("/finance/income/", {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify(payload)
  });
}
