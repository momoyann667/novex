import { apiFetch } from "@/lib/api/client";

export type CurrentUser = {
  id: number;
  username: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  full_name: string;
  profile: {
    first_name: string;
    last_name: string;
    full_name: string;
    avatar: string;
    locale: string;
  } | null;
  default_workspace: {
    id: number;
    name: string;
    slug: string;
  } | null;
  workspace_access: {
    workspace: { id: number; name: string; slug: string } | null;
    role: "creator" | "membre" | "super_admin" | string;
    role_code?: string;
    role_label: string;
    permissions: string[];
  } | null;
  must_change_password: boolean;
  is_staff: boolean;
  is_superuser: boolean;
};

export function displayUserName(user: CurrentUser | undefined | null) {
  return user?.profile?.full_name || user?.full_name || user?.email || "Utilisateur NOVEX";
}

export function userInitials(user: CurrentUser | undefined | null) {
  const name = displayUserName(user);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function getCurrentUser(workspaceSlugOrContext?: string | { queryKey?: readonly unknown[] }) {
  const workspaceSlug = typeof workspaceSlugOrContext === "string" ? workspaceSlugOrContext : undefined;
  return apiFetch<CurrentUser>("/auth/me/", {
    cache: "no-store",
    headers: workspaceSlug ? { "X-Workspace": workspaceSlug } : undefined
  });
}
