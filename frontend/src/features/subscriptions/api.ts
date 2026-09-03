import { ApiError, apiFetch } from "@/lib/api/client";
import { isInvalidWorkspaceSlug } from "@/lib/workspace/routing";

export type PlanCode = "FREEMIUM" | "NOVEX_START" | "NOVEX_PRO";

export type PlanResource = {
  code: PlanCode;
  name: string;
  description: string;
  price: string | number;
  currency: string;
  billing_period: string;
  limits: Record<string, number | null>;
  quotas: Array<{ code: string; label: string; limit: number | null; period: string }>;
  entitlements: Record<string, boolean | string>;
};

export type SubscriptionResource = {
  plan: PlanCode;
  plan_name: string;
  status: string;
  price: string | number;
  currency: string;
  billing_period: string;
  description: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_started_at: string | null;
  current_period_ends_at: string | null;
  cancelled_at: string | null;
  period_ends_at: string | null;
  days_remaining: number | null;
  trial_progress: number | null;
  limits: Record<string, number | null>;
  entitlements: Record<string, boolean | string>;
};

export type SubscriptionPayment = {
  id: number;
  date: string;
  reference: string;
  plan: string;
  plan_code: string;
  amount: string | number;
  currency: string;
  method: string;
  status: string;
  provider: string;
  provider_reference: string;
  period_start: string;
  period_end: string;
  receipt: string;
  receipt_id: number | null;
  checkout_url: string;
  created_at: string;
  paid_at: string | null;
};

export type SubscriptionUsage = {
  key: string;
  label: string;
  used: number;
  limit: number | null;
};

export type SubscriptionOverview = {
  subscription: SubscriptionResource;
  plans: PlanResource[];
  features: Array<{ code: string; label: string }>;
  usage: SubscriptionUsage[];
  payments: SubscriptionPayment[];
};

export type SubscriptionCheckout = {
  plan: PlanResource;
  payment: SubscriptionPayment;
  status: string;
  checkout_url: string;
  online_available: boolean;
  message: string;
};

export type SaasPaymentSummary = {
  total_paid: string | number;
  currency: string;
  pending_count: number;
  failed_count: number;
  success_count: number;
  last_payment: SubscriptionPayment | null;
  next_renewal: {
    plan: string;
    plan_code: string;
    amount: string | number;
    currency: string;
    date: string | null;
    frequency: string;
    status: string;
    days_remaining: number | null;
  };
  auto_renew_supported: boolean;
};

export type SubscriptionInvoice = {
  id: number;
  date: string;
  number: string;
  plan: string;
  amount: string | number;
  currency: string;
  status: string;
  payment: number;
  download_url: string;
};

export type SubscriptionRenewal = {
  plan: string;
  amount: string | number;
  currency: string;
  period: string;
  scheduled_for: string | null;
  status: string;
};

export type Paginated<T> = {
  count: number;
  page: number;
  page_size: number;
  next: number | null;
  previous: number | null;
  results: T[];
};

export type SaasPaymentsOverview = {
  summary: SaasPaymentSummary;
  payments: Paginated<SubscriptionPayment>;
  invoices: Paginated<SubscriptionInvoice>;
  renewals: SubscriptionRenewal[];
  plans: PlanResource[];
};

export type SaasPaymentFilters = {
  period?: string;
  status?: string;
  plan?: string;
  search?: string;
  page?: number;
};

function workspaceHeaders(workspaceSlug: string) {
  if (isInvalidWorkspaceSlug(workspaceSlug)) {
    throw new ApiError("Workspace invalide. Reconnecte-toi pour ouvrir ton association.", 400);
  }
  return { "X-Workspace": workspaceSlug };
}

export function getSubscriptionOverview(workspaceSlug: string) {
  return apiFetch<SubscriptionOverview>("/subscriptions/", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export function createSubscriptionCheckout(workspaceSlug: string, plan: Exclude<PlanCode, "FREEMIUM">) {
  return apiFetch<SubscriptionCheckout>("/subscriptions/checkout/", {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify({ plan })
  });
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "all") query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

export function getSaasPaymentsOverview(workspaceSlug: string, filters: SaasPaymentFilters = {}) {
  return apiFetch<SaasPaymentsOverview>(`/subscriptions/payments/${buildQuery({ ...filters, page_size: 10 })}`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export function retrySaasPayment(workspaceSlug: string, paymentId: number) {
  return apiFetch<SubscriptionCheckout>(`/subscriptions/payments/${paymentId}/retry/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify({})
  });
}

export function cancelSubscription(workspaceSlug: string) {
  return apiFetch<SubscriptionOverview>("/subscriptions/cancel/", {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify({})
  });
}

export function reactivateSubscription(workspaceSlug: string) {
  return apiFetch<SubscriptionOverview>("/subscriptions/reactivate/", {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify({})
  });
}
