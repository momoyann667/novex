import { ApiError, apiFetch } from "@/lib/api/client";
import { isInvalidWorkspaceSlug } from "@/lib/workspace/routing";

export type ExpenseStatus = "DRAFT" | "PENDING" | "VALIDATED" | "REJECTED" | "CANCELLED";

export type ExpenseDashboard = {
  total_expenses: string | number;
  monthly_expenses: string | number;
  pending_amount: string | number;
  pending_count: number;
  approved_amount: string | number;
  approved_count: number;
  currency: string;
  period: { year: number; month: number | null; label: string; start: string; end: string };
};

export type ExpenseBudgetCard = {
  id: number;
  name: string;
  status: string;
  scope_type: string;
  category: string;
  budget_total: string | number;
  spent: string | number;
  remaining: string | number;
  consumption_rate: string | number;
  overrun: string | number;
  state: string;
  currency: string;
};

export type ExpenseResource = {
  id: number;
  amount: string | number;
  currency: string;
  category: number;
  category_name: string;
  description: string;
  reference: string;
  transaction_date: string;
  status: ExpenseStatus;
  source: string;
  supplier_name: string;
  supplier_phone: string;
  invoice_reference: string;
  payment_method: string;
  requires_receipt: boolean;
  budget_id: number | null;
  budget_name: string;
  budget_line_id: number | null;
  budget_line_name: string;
  notes: string;
  cancellation_reason: string;
  created_by_name: string;
  documents_count: number;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpenseCategory = {
  id: number;
  name: string;
  kind: string;
};

export type ExpenseBudgetLine = {
  id: number;
  budget_id: number;
  budget_name: string;
  category_id: number;
  category_name: string;
  planned_amount: string | number;
  remaining: string | number;
  currency: string;
};

export type ExpensePayload = {
  description: string;
  amount: string;
  category: number;
  transaction_date: string;
  budget_line?: number | null;
  supplier_name?: string;
  supplier_phone?: string;
  invoice_reference?: string;
  payment_method?: string;
  notes?: string;
};

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type ExpenseFilters = {
  year?: number;
  month?: number | "all";
  page?: number;
  pageSize?: number;
  status?: string;
  budget?: string;
  category?: string;
  search?: string;
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

export function getExpenseDashboard(workspaceSlug: string, filters: ExpenseFilters) {
  return apiFetch<ExpenseDashboard>(`/finance/expenses/dashboard/${buildQuery({ year: filters.year, month: filters.month })}`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export function listExpenseBudgets(workspaceSlug: string, filters: ExpenseFilters) {
  return apiFetch<ExpenseBudgetCard[]>(`/finance/expenses/budgets/${buildQuery({ year: filters.year, month: filters.month })}`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export function listExpenses(workspaceSlug: string, filters: ExpenseFilters) {
  return apiFetch<Paginated<ExpenseResource>>(
    `/finance/expenses/${buildQuery({
      year: filters.year,
      month: filters.month,
      page: filters.page ?? 1,
      page_size: filters.pageSize ?? 4,
      status: filters.status,
      budget: filters.budget,
      category: filters.category,
      search: filters.search
    })}`,
    {
      headers: workspaceHeaders(workspaceSlug),
      cache: "no-store"
    }
  );
}

export function listExpenseCategories(workspaceSlug: string) {
  return apiFetch<ExpenseCategory[]>("/finance/expenses/categories/", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export function listExpenseBudgetLines(workspaceSlug: string) {
  return apiFetch<ExpenseBudgetLine[]>("/finance/expenses/budget-lines/", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export function createExpense(workspaceSlug: string, payload: ExpensePayload) {
  return apiFetch<ExpenseResource>("/finance/expenses/", {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify(payload)
  });
}

export function approveExpense(workspaceSlug: string, expenseId: number) {
  return apiFetch<ExpenseResource>(`/finance/expenses/${expenseId}/validate/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug)
  });
}

export function rejectExpense(workspaceSlug: string, expenseId: number, reason: string) {
  return apiFetch<ExpenseResource>(`/finance/expenses/${expenseId}/reject/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify({ reason })
  });
}

export function cancelExpense(workspaceSlug: string, expenseId: number, reason: string) {
  return apiFetch<ExpenseResource>(`/finance/expenses/${expenseId}/cancel/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify({ reason })
  });
}
