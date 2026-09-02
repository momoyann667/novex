import { ApiError, apiFetch } from "@/lib/api/client";
import { isInvalidWorkspaceSlug } from "@/lib/workspace/routing";
import type { ExpenseCategory } from "@/features/finance/expenses-api";

export type BudgetLineMetrics = {
  id: number;
  category: string;
  category_id: number;
  planned: string | number;
  committed: string | number;
  actual: string | number;
  remaining: string | number;
  variance: string | number;
  consumption_rate: string | number;
  risk_level: string;
};

export type BudgetLine = {
  id: number;
  budget: number;
  category: number;
  category_name: string;
  planned_amount: string | number;
  committed_amount: string | number;
  is_active: boolean;
  metrics: BudgetLineMetrics;
};

export type BudgetResource = {
  id: number;
  name: string;
  description: string;
  period_type: string;
  scope_type: string;
  start_date: string;
  end_date: string;
  total_amount: string | number;
  currency: string;
  status: string;
  project: number | null;
  project_name: string;
  event: number | null;
  event_name: string;
  lines: BudgetLine[];
  metrics: BudgetSummary;
  created_at: string;
  updated_at: string;
};

export type BudgetSummary = {
  id: number;
  name: string;
  status: string;
  scope_type: string;
  planned: string | number;
  budget_total: string | number;
  committed: string | number;
  actual: string | number;
  remaining: string | number;
  variance: string | number;
  consumption_rate: string | number;
  overrun: string | number;
  risk_level: string;
  lines: BudgetLineMetrics[];
};

export type BudgetAlert = {
  id: number;
  budget: string;
  budget_id: number;
  line: string;
  type: string;
  severity: string;
  threshold_percent: number;
  current_percent: string | number;
  message: string;
  channels: string[];
  is_resolved: boolean;
  created_at: string;
};

export type BudgetDashboard = {
  year: number;
  currency: string;
  budget_total: string | number;
  committed: string | number;
  actual: string | number;
  remaining: string | number;
  consumption_rate: string | number;
  overrun: string | number;
  risk_count: number;
  exceeded_count: number;
  unbudgeted_expense: string | number;
  budgets: BudgetSummary[];
  alerts: BudgetAlert[];
};

export type BudgetSettings = {
  id: number;
  allow_over_budget_expense: boolean;
  thresholds: Record<string, number>;
  notify_in_app: boolean;
  notify_email: boolean;
  notify_whatsapp: boolean;
  notify_sms: boolean;
};

export type BudgetPayload = {
  name: string;
  description?: string;
  period_type: string;
  scope_type: string;
  start_date: string;
  end_date: string;
  total_amount: string;
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

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

function unwrapPaginated<T>(payload: T[] | Paginated<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results;
}

export function getBudgetDashboard(workspaceSlug: string, year: number) {
  return apiFetch<BudgetDashboard>(`/budgets/dashboard/${buildQuery({ year })}`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export async function listBudgets(workspaceSlug: string, year: number) {
  const payload = await apiFetch<BudgetResource[] | Paginated<BudgetResource>>(`/budgets/${buildQuery({ year })}`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
  return unwrapPaginated(payload);
}

export function getBudget(workspaceSlug: string, budgetId: string | number) {
  return apiFetch<BudgetResource>(`/budgets/${budgetId}/`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export function getBudgetAnalytics(workspaceSlug: string, budgetId: string | number) {
  return apiFetch<BudgetSummary & { by_month: Array<{ period: string; actual: string | number }>; by_category: BudgetLineMetrics[]; transactions: Array<{ id: number; date: string; description: string; category: string; amount: string | number; status: string }> }>(`/budgets/${budgetId}/analytics/`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export function createBudget(workspaceSlug: string, payload: BudgetPayload) {
  return apiFetch<BudgetResource>("/budgets/", {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify(payload)
  });
}

export function createBudgetLine(workspaceSlug: string, budgetId: string | number, payload: { category: number; planned_amount: string }) {
  return apiFetch<BudgetLine>(`/budgets/${budgetId}/lines/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify(payload)
  });
}

export function activateBudget(workspaceSlug: string, budgetId: string | number) {
  return apiFetch<BudgetResource>(`/budgets/${budgetId}/activate/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug)
  });
}

export function listBudgetCategories(workspaceSlug: string) {
  return apiFetch<ExpenseCategory[]>("/finance/expenses/categories/", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export function getBudgetSettings(workspaceSlug: string) {
  return apiFetch<BudgetSettings>("/budgets/settings/", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export function updateBudgetSettings(workspaceSlug: string, payload: Partial<BudgetSettings>) {
  return apiFetch<BudgetSettings>("/budgets/settings/", {
    method: "PATCH",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify(payload)
  });
}
