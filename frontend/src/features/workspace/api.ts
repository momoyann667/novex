import { apiFetch } from "@/lib/api/client";

export type WorkspaceResource = {
  id: number;
  name: string;
  slug: string;
  organization_type: string;
  logo: string;
  currency: string;
  country: string;
  city: string;
  description: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type WorkspaceUpdatePayload = {
  name: string;
  organization_type: string;
  currency: string;
  country: string;
};

export type WorkspaceSettingsResource = {
  workspace_slug: string;
  workspace_name: string;
  organization_type: string;
  logo: string | null;
  currency: string;
  country: string;
  city: string;
  description: string;
  profile: {
    legal_name: string;
    address: string;
    contact_email: string;
    contact_phone: string;
    website_url: string;
  };
  subscription: {
    plan: string;
    plan_name: string;
    status: string;
    trial_started_at: string | null;
    trial_ends_at: string | null;
    current_period_started_at: string | null;
    current_period_ends_at: string | null;
    limits: Record<string, unknown>;
    entitlements: Record<string, unknown>;
  } | null;
  acronym: string;
  registration_number: string;
  region: string;
  founded_on: string | null;
  primary_contact_name: string;
  primary_contact_email: string;
  primary_contact_phone: string;
  primary_contact_function: string;
  timezone: string;
  language: string;
  date_format: string;
  money_format: Record<string, unknown>;
  theme: string;
  primary_color: string;
  secondary_color: string;
  finance_preferences: Record<string, unknown>;
  contribution_preferences: Record<string, unknown>;
  notification_preferences: Record<string, unknown>;
  member_preferences: Record<string, unknown>;
  project_preferences: Record<string, unknown>;
  event_preferences: Record<string, unknown>;
  document_preferences: Record<string, unknown>;
  integration_states: Record<string, string>;
  security_preferences: Record<string, unknown>;
};

export type WorkspaceSettingsUpdatePayload = Partial<Omit<WorkspaceSettingsResource, "subscription" | "logo">> & {
  logo?: File | null;
};

export function updateWorkspace(workspaceSlug: string, payload: WorkspaceUpdatePayload) {
  return apiFetch<WorkspaceResource>(`/workspaces/${workspaceSlug}/`, {
    method: "PATCH",
    headers: {
      "X-Workspace": workspaceSlug
    },
    body: JSON.stringify(payload)
  });
}

export function createWorkspace(payload: WorkspaceUpdatePayload) {
  return apiFetch<WorkspaceResource>("/workspaces/", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getWorkspaceSettings(workspaceSlug: string) {
  return apiFetch<WorkspaceSettingsResource>(`/workspaces/${workspaceSlug}/settings/`, {
    headers: {
      "X-Workspace": workspaceSlug
    },
    cache: "no-store"
  });
}

export function updateWorkspaceSettings(workspaceSlug: string, payload: WorkspaceSettingsUpdatePayload) {
  const hasLogoFile = payload.logo instanceof File;
  if (hasLogoFile) {
    const body = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (key === "logo" && value instanceof File) {
        body.append(key, value);
        return;
      }
      body.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    });
    return apiFetch<WorkspaceSettingsResource>(`/workspaces/${workspaceSlug}/settings/`, {
      method: "PATCH",
      headers: {
        "X-Workspace": workspaceSlug
      },
      body
    });
  }

  return apiFetch<WorkspaceSettingsResource>(`/workspaces/${workspaceSlug}/settings/`, {
    method: "PATCH",
    headers: {
      "X-Workspace": workspaceSlug
    },
    body: JSON.stringify(payload)
  });
}
