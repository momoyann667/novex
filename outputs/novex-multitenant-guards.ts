export type WorkspaceRole =
  | "OWNER"
  | "ADMIN"
  | "PRESIDENT"
  | "TREASURER"
  | "SECRETARY"
  | "PROJECT_MANAGER"
  | "MEMBER";

export type WorkspaceMemberStatus = "invited" | "active" | "suspended" | "removed";
export type SubscriptionStatus = "trial" | "active" | "past_due" | "expired" | "suspended" | "cancelled";
export type PlanCode = "FREEMIUM" | "NOVEX_START" | "NOVEX_PRO";

export type Permission =
  | "*"
  | "workspace.view"
  | "members.view"
  | "members.view:self"
  | "members.create"
  | "members.update"
  | "members.delete"
  | "contributions.view"
  | "contributions.view:self"
  | "contributions.create"
  | "contributions.update"
  | "expenses.view"
  | "expenses.create"
  | "expenses.approve"
  | "expenses.delete"
  | "revenues.view"
  | "revenues.create"
  | "projects.view"
  | "projects.create"
  | "projects.update"
  | "events.view"
  | "events.create"
  | "documents.view"
  | "documents.upload"
  | "documents.delete"
  | "reports.view"
  | "reports.create"
  | "reports.export"
  | "settings.view"
  | "settings.update"
  | "workspace_users.view"
  | "workspace_users.invite"
  | "workspace_users.update_role"
  | "audit_logs.view";

export interface AuthenticatedUser {
  id: string;
  email?: string;
  status: "active" | "suspended" | "deleted";
}

export interface WorkspaceAccess {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  status: WorkspaceMemberStatus;
  permissions: Permission[];
}

export interface SubscriptionAccess {
  workspaceId: string;
  plan: PlanCode;
  status: SubscriptionStatus;
  trialEndsAt?: Date;
  entitlements: string[];
}

export interface WorkspaceAccessRepository {
  findMembership(userId: string, workspaceIdOrSlug: string): Promise<WorkspaceAccess | null>;
  findSubscription(workspaceId: string): Promise<SubscriptionAccess | null>;
}

export class AuthorizationError extends Error {
  readonly status = 403;

  constructor(message = "Acces refuse.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class AuthenticationError extends Error {
  readonly status = 401;

  constructor(message = "Authentification requise.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export function hasPermission(access: WorkspaceAccess, permission: Permission): boolean {
  return access.permissions.includes("*") || access.permissions.includes(permission);
}

export async function requireWorkspaceAccess(
  repo: WorkspaceAccessRepository,
  user: AuthenticatedUser | null,
  workspaceIdOrSlug: string,
  permission: Permission
): Promise<WorkspaceAccess> {
  if (!user || user.status !== "active") {
    throw new AuthenticationError();
  }

  const access = await repo.findMembership(user.id, workspaceIdOrSlug);

  if (!access || access.status !== "active") {
    throw new AuthorizationError("Vous n'avez pas acces a cet espace NOVEX.");
  }

  if (!hasPermission(access, permission)) {
    throw new AuthorizationError("Votre role ne permet pas cette action.");
  }

  return access;
}

export async function requireEntitlement(
  repo: WorkspaceAccessRepository,
  workspaceId: string,
  entitlement: string
): Promise<SubscriptionAccess> {
  const subscription = await repo.findSubscription(workspaceId);

  if (!subscription) {
    throw new AuthorizationError("Aucun abonnement actif pour cet espace.");
  }

  const usableStatuses: SubscriptionStatus[] = ["trial", "active"];

  if (!usableStatuses.includes(subscription.status)) {
    throw new AuthorizationError("L'abonnement ne permet pas cette action.");
  }

  if (subscription.status === "trial" && subscription.trialEndsAt && subscription.trialEndsAt < new Date()) {
    throw new AuthorizationError("La periode d'essai de cet espace est expiree.");
  }

  if (!subscription.entitlements.includes(entitlement)) {
    throw new AuthorizationError("Cette fonctionnalite n'est pas disponible avec ce plan.");
  }

  return subscription;
}

export function tenantCacheKey(workspaceId: string, key: string): string {
  return `workspace:${workspaceId}:${key}`;
}

export function assertSameWorkspace(resourceWorkspaceId: string, access: WorkspaceAccess): void {
  if (resourceWorkspaceId !== access.workspaceId) {
    throw new AuthorizationError("Cette ressource appartient a un autre espace.");
  }
}

export async function listMembersExample(
  repo: WorkspaceAccessRepository,
  user: AuthenticatedUser,
  workspaceSlug: string,
  queryMembersByWorkspace: (workspaceId: string) => Promise<unknown[]>
): Promise<unknown[]> {
  const access = await requireWorkspaceAccess(repo, user, workspaceSlug, "members.view");

  // The backend uses the authorized workspace from membership resolution,
  // never a raw workspace_id posted by the frontend.
  return queryMembersByWorkspace(access.workspaceId);
}

export async function createExpenseExample(
  repo: WorkspaceAccessRepository,
  user: AuthenticatedUser,
  workspaceSlug: string,
  insertExpense: (workspaceId: string) => Promise<unknown>
): Promise<unknown> {
  const access = await requireWorkspaceAccess(repo, user, workspaceSlug, "expenses.create");

  return insertExpense(access.workspaceId);
}
