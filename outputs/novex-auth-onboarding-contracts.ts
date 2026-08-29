export type UserStatus = "pending_verification" | "active" | "suspended" | "deleted";
export type SessionStatus = "active" | "expired" | "revoked";
export type WorkspaceStatus = "active" | "suspended" | "archived";
export type WorkspaceRole = "OWNER" | "ADMIN" | "PRESIDENT" | "TREASURER" | "SECRETARY" | "PROJECT_MANAGER" | "MEMBER";
export type OrganizationType =
  | "ASSOCIATION"
  | "SYNDICAT"
  | "ONG"
  | "MUTUELLE"
  | "COOPERATIVE"
  | "AMICALE"
  | "CLUB"
  | "ASSOCIATION_ESTUDIANTINE"
  | "ORGANISATION_PROFESSIONNELLE"
  | "FONDATION"
  | "ORGANISATION_COMMUNAUTAIRE"
  | "AUTRE";

export type SubscriptionStatus = "trial" | "active" | "past_due" | "expired" | "suspended" | "cancelled";
export type SignupEvent =
  | "signup_started"
  | "signup_completed"
  | "email_verified"
  | "onboarding_started"
  | "workspace_created"
  | "onboarding_completed"
  | "first_member_added"
  | "first_contribution_created"
  | "first_expense_created"
  | "subscription_started";

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  passwordConfirmation: string;
  acceptedTerms: boolean;
  invitationToken?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
  passwordConfirmation: string;
}

export interface CreateWorkspaceInput {
  name: string;
  organizationType: OrganizationType;
  description?: string;
  country?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  currency?: string;
  collectsContributions?: boolean;
  contributionFrequency?: "monthly" | "quarterly" | "semiannual" | "annual" | "custom";
}

export interface User {
  id: string;
  email: string;
  phone?: string;
  status: UserStatus;
  emailVerifiedAt?: Date;
  termsAcceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Profile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  locale: "fr-CI" | string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  organizationType: OrganizationType;
  logoUrl?: string;
  currency: string;
  country: string;
  city?: string;
  status: WorkspaceStatus;
  ownerUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  status: "invited" | "active" | "suspended" | "removed";
  joinedAt?: Date;
  invitedAt?: Date;
  lastActiveAt?: Date;
}

export interface Subscription {
  id: string;
  workspaceId: string;
  planCode: "FREEMIUM" | "NOVEX_START" | "NOVEX_PRO";
  status: SubscriptionStatus;
  trialStartedAt?: Date;
  trialEndsAt?: Date;
  currentPeriodStartedAt?: Date;
  currentPeriodEndsAt?: Date;
}

export interface OnboardingState {
  userId: string;
  workspaceId?: string;
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;
  completedSteps: number[];
  hiddenActivationChecklist?: boolean;
}

export interface TrialStatusView {
  status: SubscriptionStatus;
  serverNow: Date;
  trialStartedAt?: Date;
  trialEndsAt?: Date;
  daysRemaining: number;
  severity: "info" | "notice" | "warning" | "danger" | "expired";
  label: string;
}
