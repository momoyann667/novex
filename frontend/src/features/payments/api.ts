import { ApiError, apiFetch } from "@/lib/api/client";
import { isInvalidWorkspaceSlug } from "@/lib/workspace/routing";

export type PayableContribution = {
  id: number;
  campaign: number;
  campaign_name: string;
  period_label: string;
  period_start: string | null;
  period_end: string | null;
  amount_due: string | number;
  amount_paid: string | number;
  waived_amount: string | number;
  remaining_amount: string | number;
  currency: string;
  due_date: string | null;
  status: string;
};

export type PayableContributionPayload = {
  member: { id: number; name: string; membership_number: string } | null;
  message?: string;
  results: PayableContribution[];
};

export type DonationProject = {
  id: number;
  name: string;
  description: string;
  status: string;
  status_label: string;
  budget: string | number;
  currency: string;
  progress: number;
  image: string;
  funding_received: string | number;
  funding_remaining: string | number;
};

export type PaymentResource = {
  id: number;
  reference: string;
  amount: string | number;
  currency: string;
  checkout_url: string;
  status: string;
  provider: string;
  contribution: number | null;
  metadata: Record<string, unknown>;
};

export type SelfPaymentResult = {
  payments: PaymentResource[];
  checkout_url: string;
  status: string;
  provider: string;
  online_available: boolean;
};

export type SelfPaymentPayload =
  | {
      type: "CONTRIBUTION";
      items: Array<{ contribution: number; amount: string }>;
      payment_method: string;
      idempotency_key: string;
    }
  | {
      type: "DONATION";
      project: number;
      amount: string;
      payment_method: string;
      idempotency_key: string;
    };

function workspaceHeaders(workspaceSlug: string) {
  if (isInvalidWorkspaceSlug(workspaceSlug)) {
    throw new ApiError("Workspace invalide. Reconnecte-toi pour ouvrir ton association.", 400);
  }

  return { "X-Workspace": workspaceSlug };
}

export async function listPayableContributions(workspaceSlug: string) {
  return apiFetch<PayableContributionPayload>("/payments/contributions/", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export async function listDonationProjects(workspaceSlug: string) {
  return apiFetch<DonationProject[]>("/payments/donation-projects/", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export async function initializeSelfPayment(workspaceSlug: string, payload: SelfPaymentPayload) {
  return apiFetch<SelfPaymentResult>("/payments/self-initialize/", {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify(payload)
  });
}
