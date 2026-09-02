import { apiFetch, ApiError } from "@/lib/api/client";
import { isInvalidWorkspaceSlug } from "@/lib/workspace/routing";

export type ProjectStatus = "DRAFT" | "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED" | "ARCHIVED";
export type ProjectPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ProjectBudgetSummary = {
  budget: string | number;
  funding_received: string | number;
  funding_remaining: string | number;
  expenses: string | number;
  actual_expense: string | number;
  remaining: string | number;
  project_balance: string | number;
  consumed_rate: number;
  progress: number;
  expense_count: number;
  days_remaining: number | null;
  is_delayed: boolean;
};

export type ProjectAnalytics = {
  progress: number;
  budget: string | number;
  actual_expense: string | number;
  remaining_budget: string | number;
  task_count: number;
  completed_tasks: number;
  blocked_tasks: number;
  overdue_tasks: number;
  milestone_count: number;
  completed_milestones: number;
  objective_count: number;
  risk_level: string;
  risk_score: number;
  risk_causes: string[];
};

export type ProjectTeamPreview = {
  id: number;
  name: string;
  role: string;
};

export type ProjectResource = {
  id: number;
  code: string;
  name: string;
  description: string;
  objectives: string;
  status: ProjectStatus;
  status_label: string;
  priority: ProjectPriority;
  priority_label: string;
  visibility: string;
  parent: number | null;
  start_date: string | null;
  end_date: string | null;
  owner: number | null;
  owner_name: string;
  responsible_user: number | null;
  responsible_user_name: string;
  responsible_member: number | null;
  responsible_member_name: string;
  team_preview: ProjectTeamPreview[];
  planned_budget: string | number;
  budget: string | number;
  currency: string;
  budget_summary: ProjectBudgetSummary;
  analytics: ProjectAnalytics;
  risk: {
    score: number;
    level: string;
    causes: string[];
    recommended_action: string;
  };
  progress: number;
  progress_mode: string;
  category: string;
  image: string;
  partners: string;
  notes: string;
  is_delayed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectBoard = {
  counts: {
    all: number;
    in_progress: number;
    completed: number;
    cancelled: number;
  };
  projects: ProjectResource[];
};

export type MemberOption = {
  id: number;
  full_name: string;
  first_name: string;
  last_name: string;
  function: string;
};

export type ProjectFormPayload = {
  name: string;
  description?: string;
  responsible_member?: number | null;
  owner?: number | null;
  category?: string;
  priority: ProjectPriority;
  status?: ProjectStatus;
  start_date?: string | null;
  end_date?: string | null;
  budget: number;
};

export type ProjectMemberPayload = {
  member: number;
  role: "PROJECT_MANAGER" | "MEMBER" | "FINANCE" | "OBSERVER";
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

function unwrapList<T>(payload: T[] | Paginated<T>) {
  return Array.isArray(payload) ? payload : payload.results;
}

function queryString(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

export async function getProjectBoard(workspaceSlug: string, search = "") {
  return apiFetch<ProjectBoard>(`/projects/board/${queryString({ search })}`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export async function getProject(workspaceSlug: string, projectId: string) {
  return apiFetch<ProjectResource>(`/projects/${projectId}/`, {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
}

export async function listMemberOptions(workspaceSlug: string) {
  const payload = await apiFetch<MemberOption[] | Paginated<MemberOption>>("/members/?ordering=last_name", {
    headers: workspaceHeaders(workspaceSlug),
    cache: "no-store"
  });
  return unwrapList(payload);
}

export async function createProject(workspaceSlug: string, payload: ProjectFormPayload) {
  return apiFetch<ProjectResource>("/projects/", {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify(payload)
  });
}

export async function addProjectMember(workspaceSlug: string, projectId: number, payload: ProjectMemberPayload) {
  return apiFetch<ProjectTeamPreview>(`/projects/${projectId}/members/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug),
    body: JSON.stringify(payload)
  });
}

export async function updateProjectStatus(workspaceSlug: string, projectId: number, action: "activate" | "pause" | "complete" | "cancel") {
  return apiFetch<ProjectResource>(`/projects/${projectId}/${action}/`, {
    method: "POST",
    headers: workspaceHeaders(workspaceSlug)
  });
}
