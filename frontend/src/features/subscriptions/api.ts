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
  limits: Record<string, number>;
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
  limits: Record<string, number>;
  entitlements: Record<string, boolean | string>;
};

export type SubscriptionPayment = {
  id: number;
  date: string;
  reference: string;
  plan: string;
  amount: string | number;
  currency: string;
  method: string;
  status: string;
  receipt: string;
};

export type SubscriptionUsage = {
  key: string;
  label: string;
  used: number;
  limit: number;
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
  status: string;
  checkout_url: string;
  online_available: boolean;
  message: string;
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
