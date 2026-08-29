import {
  CreateWorkspaceInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  Subscription,
  TrialStatusView,
  User,
  Workspace
} from "./novex-auth-onboarding-contracts";

export const PASSWORD_POLICY = {
  minLength: 8,
  requireLetter: true,
  requireNumber: true
};

export function validatePassword(password: string): string[] {
  const errors: string[] = [];

  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Le mot de passe doit contenir au moins ${PASSWORD_POLICY.minLength} caracteres.`);
  }

  if (PASSWORD_POLICY.requireLetter && !/[A-Za-z]/.test(password)) {
    errors.push("Le mot de passe doit contenir au moins une lettre.");
  }

  if (PASSWORD_POLICY.requireNumber && !/[0-9]/.test(password)) {
    errors.push("Le mot de passe doit contenir au moins un chiffre.");
  }

  return errors;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function makeWorkspaceSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function addTrialDays(serverNow: Date, trialDays = 14): Date {
  const endsAt = new Date(serverNow);
  endsAt.setUTCDate(endsAt.getUTCDate() + trialDays);
  return endsAt;
}

export function getTrialStatus(subscription: Subscription, serverNow: Date): TrialStatusView {
  const trialEndsAt = subscription.trialEndsAt;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - serverNow.getTime()) / msPerDay))
    : 0;

  if (subscription.status !== "trial" || !trialEndsAt || trialEndsAt <= serverNow) {
    return {
      status: subscription.status === "trial" ? "expired" : subscription.status,
      serverNow,
      trialStartedAt: subscription.trialStartedAt,
      trialEndsAt,
      daysRemaining: 0,
      severity: "expired",
      label: "Votre periode d'essai est terminee."
    };
  }

  if (daysRemaining <= 1) {
    return { status: "trial", serverNow, trialStartedAt: subscription.trialStartedAt, trialEndsAt, daysRemaining, severity: "danger", label: "Dernier jour d'essai gratuit." };
  }

  if (daysRemaining <= 2) {
    return { status: "trial", serverNow, trialStartedAt: subscription.trialStartedAt, trialEndsAt, daysRemaining, severity: "warning", label: `Essai gratuit - ${daysRemaining} jours restants.` };
  }

  if (daysRemaining <= 7) {
    return { status: "trial", serverNow, trialStartedAt: subscription.trialStartedAt, trialEndsAt, daysRemaining, severity: "notice", label: `Essai gratuit - ${daysRemaining} jours restants.` };
  }

  return { status: "trial", serverNow, trialStartedAt: subscription.trialStartedAt, trialEndsAt, daysRemaining, severity: "info", label: `Essai gratuit - ${daysRemaining} jours restants.` };
}

export interface AuthOnboardingRepository {
  findUserByEmail(email: string): Promise<User | null>;
  createUserWithProfile(input: RegisterInput & { email: string; passwordHash: string; verificationTokenHash?: string; termsAcceptedAt: Date }): Promise<User>;
  verifyPassword(user: User, password: string): Promise<boolean>;
  createSession(userId: string, rememberMe?: boolean): Promise<{ id: string; expiresAt: Date }>;
  revokeSession(sessionId: string): Promise<void>;
  createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  updatePasswordWithResetToken(token: string, passwordHash: string): Promise<void>;
  createWorkspaceTransaction(input: {
    ownerUserId: string;
    workspace: CreateWorkspaceInput & { slug: string; currency: string; country: string };
    trialStartedAt: Date;
    trialEndsAt: Date;
  }): Promise<{ workspace: Workspace; subscription: Subscription }>;
  acceptInvitationForUser(token: string, userId: string): Promise<void>;
  trackActivationEvent(userId: string, event: string, metadata?: Record<string, unknown>): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
}

export interface SecureTokenGenerator {
  createToken(): Promise<{ rawToken: string; tokenHash: string }>;
}

export async function registerUser(
  repo: AuthOnboardingRepository,
  hasher: PasswordHasher,
  tokens: SecureTokenGenerator,
  input: RegisterInput,
  serverNow: Date
): Promise<User> {
  const email = normalizeEmail(input.email);
  const errors = validatePassword(input.password);

  if (!input.acceptedTerms) {
    errors.push("Vous devez accepter les conditions d'utilisation et la politique de confidentialite.");
  }

  if (input.password !== input.passwordConfirmation) {
    errors.push("Les mots de passe ne correspondent pas.");
  }

  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }

  const existingUser = await repo.findUserByEmail(email);
  if (existingUser) {
    throw new Error("Un compte existe deja avec cet email.");
  }

  await repo.trackActivationEvent("anonymous", "signup_started", { email });
  const passwordHash = await hasher.hash(input.password);
  const verificationToken = await tokens.createToken();
  const user = await repo.createUserWithProfile({
    ...input,
    email,
    passwordHash,
    verificationTokenHash: verificationToken.tokenHash,
    termsAcceptedAt: serverNow
  });

  await repo.trackActivationEvent(user.id, "signup_completed");
  return user;
}

export async function login(repo: AuthOnboardingRepository, input: LoginInput): Promise<{ user: User; sessionId: string; expiresAt: Date }> {
  const user = await repo.findUserByEmail(normalizeEmail(input.email));
  if (!user || user.status !== "active") {
    throw new Error("Email ou mot de passe incorrect.");
  }

  const ok = await repo.verifyPassword(user, input.password);
  if (!ok) {
    throw new Error("Email ou mot de passe incorrect.");
  }

  const session = await repo.createSession(user.id, input.rememberMe);
  return { user, sessionId: session.id, expiresAt: session.expiresAt };
}

export async function completeWorkspaceOnboarding(
  repo: AuthOnboardingRepository,
  ownerUserId: string,
  input: CreateWorkspaceInput,
  serverNow: Date
): Promise<{ workspace: Workspace; subscription: Subscription }> {
  const slug = makeWorkspaceSlug(input.name);
  const result = await repo.createWorkspaceTransaction({
    ownerUserId,
    workspace: {
      ...input,
      slug,
      currency: input.currency || "XOF",
      country: input.country || "CI"
    },
    trialStartedAt: serverNow,
    trialEndsAt: addTrialDays(serverNow, 14)
  });

  await repo.trackActivationEvent(ownerUserId, "workspace_created", { workspaceId: result.workspace.id });
  await repo.trackActivationEvent(ownerUserId, "subscription_started", { workspaceId: result.workspace.id, plan: "FREEMIUM" });
  await repo.trackActivationEvent(ownerUserId, "onboarding_completed", { workspaceId: result.workspace.id });

  return result;
}

export async function resetPassword(repo: AuthOnboardingRepository, hasher: PasswordHasher, input: ResetPasswordInput): Promise<void> {
  const errors = validatePassword(input.password);

  if (input.password !== input.passwordConfirmation) {
    errors.push("Les mots de passe ne correspondent pas.");
  }

  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }

  await repo.updatePasswordWithResetToken(input.token, await hasher.hash(input.password));
}
