import type { Role, Session } from "./session";
import {
  createUser,
  getUserByEmail,
  listUsers,
  newId,
  updateUser,
} from "./store";

export type OAuthProvider = "google";

export interface OAuthClaims {
  provider: OAuthProvider;
  providerAccountId: string;
  userId: string;
  email: string;
  name?: string | null;
  role: Role;
  gen: number;
}

type OAuthSignInInput = {
  email?: string | null;
  name?: string | null;
  provider?: string | null;
  providerAccountId?: string | null;
  adminEmail?: string | null;
};

type OAuthSignInResult =
  | { ok: true; claims: OAuthClaims }
  | {
      ok: false;
      reason:
        | "missing_identity"
        | "missing_admin_email"
        | "unauthorized"
        | "deactivated";
      message: string;
    };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function oauthConfigured(
  env?: { AUTH_GOOGLE_ID?: string; AUTH_GOOGLE_SECRET?: string },
): boolean {
  const source = env ?? process.env;
  return Boolean(source.AUTH_GOOGLE_ID && source.AUTH_GOOGLE_SECRET);
}

export const isGoogleOAuthConfigured = oauthConfigured;

export function assertAuthJsSecret({
  nodeEnv,
  oauthConfigured,
  authSecret,
}: {
  nodeEnv: string | undefined;
  oauthConfigured: boolean;
  authSecret: string | undefined;
}) {
  if (nodeEnv === "production" && oauthConfigured && !authSecret) {
    throw new Error(
      "AUTH_SECRET is required when OAuth is configured in production.",
    );
  }
}

export function normalizeDemoSession(input: {
  personaId: string;
  name: string;
  role: Role;
  gen?: number;
}): Session {
  return {
    personaId: input.personaId,
    userId: demoUserIdForPersona(input.personaId) ?? `demo:${input.personaId}`,
    name: input.name,
    email: null,
    role: input.role,
    authMethod: "demo",
    gen: input.gen ?? 0,
  };
}

export function sessionFromOAuthClaims(claims: OAuthClaims): Session {
  return {
    personaId: claims.userId,
    userId: claims.userId,
    name: claims.name?.trim() || normalizeEmail(claims.email),
    email: normalizeEmail(claims.email),
    role: claims.role,
    authMethod: "oauth",
    gen: claims.gen,
  };
}

export async function resolveOAuthSignIn(
  input: OAuthSignInInput,
): Promise<OAuthSignInResult> {
  const email = input.email ? normalizeEmail(input.email) : "";
  const adminEmail = input.adminEmail ? normalizeEmail(input.adminEmail) : "";
  if (input.provider !== "google" || !input.providerAccountId || !email) {
    return {
      ok: false,
      reason: "missing_identity",
      message:
        "Google did not return a stable account identity. Try again or contact the operator.",
    };
  }
  const displayName = input.name?.trim() || email;
  const existing = await getUserByEmail(email);

  if (existing) {
    if (existing.status === "deactivated") {
      return {
        ok: false,
        reason: "deactivated",
        message: "This Cleared account has been deactivated.",
      };
    }
    const activated =
      existing.status === "invited"
        ? await updateUser(existing.id, {
            status: "active",
            displayName,
          })
        : existing;
    const user = activated ?? existing;
    return {
      ok: true,
      claims: {
        provider: "google",
        providerAccountId: input.providerAccountId,
        userId: user.id,
        email: user.email,
        name: user.displayName,
        role: user.role,
        gen: user.sessionGen,
      },
    };
  }

  if (!adminEmail) {
    return {
      ok: false,
      reason: "missing_admin_email",
      message:
        "OAuth sign-in is not ready: set ADMIN_EMAIL to seed the first admin.",
    };
  }
  const users = await listUsers();
  const hasAdmin = users.some(
    (user) =>
      user.role === "admin" &&
      user.status !== "deactivated" &&
      !isDemoUserId(user.id),
  );
  if (hasAdmin || email !== adminEmail) {
    return {
      ok: false,
      reason: "unauthorized",
      message:
        "This Google account is not invited to Cleared. Ask an admin to invite it.",
    };
  }
  const now = new Date().toISOString();
  const user = await createUser({
    id: newId("usr"),
    email,
    displayName,
    role: "admin",
    status: "active",
    sessionGen: 0,
    createdAt: now,
    updatedAt: now,
  });
  return {
    ok: true,
    claims: {
      provider: "google",
      providerAccountId: input.providerAccountId,
      userId: user.id,
      email,
      name: user.displayName,
      role: "admin",
      gen: 0,
    },
  };
}

function isDemoUserId(userId: string): boolean {
  return (
    userId === "00000000-0000-4000-8000-000000000001" ||
    userId === "00000000-0000-4000-8000-000000000002" ||
    userId === "00000000-0000-4000-8000-000000000003" ||
    userId === "00000000-0000-4000-8000-000000000004"
  );
}

function demoUserIdForPersona(personaId: string): string | null {
  switch (personaId) {
    case "maya":
      return "00000000-0000-4000-8000-000000000001";
    case "devon":
      return "00000000-0000-4000-8000-000000000002";
    case "priya":
      return "00000000-0000-4000-8000-000000000003";
    case "sam":
      return "00000000-0000-4000-8000-000000000004";
    default:
      return null;
  }
}

function roleFromUnknown(value: unknown): Role | null {
  return value === "author" ||
    value === "officer" ||
    value === "admin" ||
    value === "auditor"
    ? value
    : null;
}

export function sessionFromAuthJsSession(input: unknown): Session | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const authMethod = record.authMethod;
  const role = roleFromUnknown(record.role);
  const userId = typeof record.userId === "string" ? record.userId : "";
  const personaId =
    typeof record.personaId === "string" ? record.personaId : userId;
  const name = typeof record.name === "string" ? record.name : "";
  const email =
    typeof record.email === "string" ? normalizeEmail(record.email) : null;
  const gen = typeof record.gen === "number" ? record.gen : null;
  if (authMethod !== "oauth" || !role || !userId || !personaId || gen === null) {
    return null;
  }
  return {
    personaId,
    userId,
    name: name || email || userId,
    email,
    role,
    authMethod: "oauth",
    gen,
  };
}

export type LoginAuthState =
  | {
      showDemoPersonas: boolean;
      showGoogle: boolean;
      state: "ready";
      message: string | null;
    }
  | {
      showDemoPersonas: false;
      showGoogle: false;
      state: "oauth_not_configured";
      message: string;
    };

export function loginAuthOptions({
  demoAuthEnabled,
  oauthConfigured,
}: {
  demoAuthEnabled: boolean;
  oauthConfigured: boolean;
}): LoginAuthState {
  if (!demoAuthEnabled && !oauthConfigured) {
    return {
      showDemoPersonas: false,
      showGoogle: false,
      state: "oauth_not_configured",
      message:
        "OAuth is not configured for this deployment. Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, or enable demo auth intentionally.",
    };
  }
  return {
    showDemoPersonas: demoAuthEnabled,
    showGoogle: oauthConfigured,
    state: "ready",
    message: null,
  };
}

export function oauthLoginErrorMessage(reason: string | undefined): string | null {
  switch (reason) {
    case "missing_identity":
      return "Google did not return a stable account identity. Try again or contact the operator.";
    case "missing_admin_email":
      return "OAuth sign-in is not ready: set ADMIN_EMAIL to seed the first admin.";
    case "unauthorized":
    case "AccessDenied":
      return "This Google account is not invited to Cleared. Ask an admin to invite it.";
    case "deactivated":
      return "This Cleared account has been deactivated.";
    case "Configuration":
      return "OAuth is not configured for this deployment. Check the Auth.js and Google OAuth environment variables.";
    default:
      return null;
  }
}
