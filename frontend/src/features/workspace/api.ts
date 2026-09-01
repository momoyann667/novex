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

export function updateWorkspace(workspaceSlug: string, payload: WorkspaceUpdatePayload) {
  return apiFetch<WorkspaceResource>(`/workspaces/${workspaceSlug}/`, {
    method: "PATCH",
    headers: {
      "X-Workspace": workspaceSlug
    },
    body: JSON.stringify(payload)
  });
}
