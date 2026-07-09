import { beforeEach, describe, expect, it } from "vitest";
import type { Session } from "./session";
import {
  assertAuthJsSecret,
  isGoogleOAuthConfigured,
  loginAuthOptions,
  normalizeDemoSession,
  resolveOAuthSignIn,
  sessionFromAuthJsSession,
  sessionFromOAuthClaims,
} from "./oauth";
import { createUser, getUserByEmail, resetStoreForTests } from "./store";

beforeEach(async () => {
  await resetStoreForTests(false);
});

describe("normalizeDemoSession", () => {
  it("returns the unified Session shape for demo persona cookies", () => {
    const session = normalizeDemoSession({
      personaId: "maya",
      name: "Maya Chen",
      role: "author",
    });

    expect(session).toEqual<Session>({
      personaId: "maya",
      userId: "00000000-0000-4000-8000-000000000001",
      name: "Maya Chen",
      email: null,
      role: "author",
      authMethod: "demo",
      gen: 0,
    });
  });
});

describe("sessionFromOAuthClaims", () => {
  it("returns the same Session shape for an allowed Google OAuth identity", () => {
    const session = sessionFromOAuthClaims({
      provider: "google",
      providerAccountId: "google-sub-123",
      userId: "usr_admin",
      email: "Admin@Example.com",
      name: "Ada Admin",
      role: "admin",
      gen: 7,
    });

    expect(session).toEqual<Session>({
      personaId: "usr_admin",
      userId: "usr_admin",
      name: "Ada Admin",
      email: "admin@example.com",
      role: "admin",
      authMethod: "oauth",
      gen: 7,
    });
  });
});

describe("resolveOAuthSignIn", () => {
  it("bootstraps ADMIN_EMAIL as the first active admin user", async () => {
    const result = await resolveOAuthSignIn({
      email: "admin@example.com",
      name: "Ada Admin",
      provider: "google",
      providerAccountId: "google-sub-123",
      adminEmail: "ADMIN@example.com",
    });

    expect(result).toMatchObject({
      ok: true,
      claims: {
        provider: "google",
        providerAccountId: "google-sub-123",
        email: "admin@example.com",
        name: "Ada Admin",
        role: "admin",
        gen: 0,
      },
    });
    if (!result.ok) throw new Error("unreachable");
    const user = await getUserByEmail("admin@example.com");
    expect(user).toMatchObject({
      id: result.claims.userId,
      email: "admin@example.com",
      displayName: "Ada Admin",
      role: "admin",
      status: "active",
    });
  });

  it("bootstraps ADMIN_EMAIL even when demo persona users were seeded", async () => {
    await resetStoreForTests(true);

    const result = await resolveOAuthSignIn({
      email: "admin@example.com",
      name: "Ada Admin",
      provider: "google",
      providerAccountId: "google-sub-123",
      adminEmail: "admin@example.com",
    });

    expect(result).toMatchObject({
      ok: true,
      claims: {
        email: "admin@example.com",
        role: "admin",
      },
    });
  });

  it("activates an invited user on first sign-in with the assigned role", async () => {
    await createUser({
      id: "usr_writer",
      email: "writer@example.com",
      displayName: "Writer Invite",
      role: "officer",
      status: "invited",
      sessionGen: 0,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });

    const result = await resolveOAuthSignIn({
      email: "WRITER@example.com",
      name: "Wendy Writer",
      provider: "google",
      providerAccountId: "google-sub-456",
      adminEmail: "admin@example.com",
    });

    expect(result).toEqual({
      ok: true,
      claims: {
        provider: "google",
        providerAccountId: "google-sub-456",
        userId: "usr_writer",
        email: "writer@example.com",
        name: "Wendy Writer",
        role: "officer",
        gen: 0,
      },
    });
    expect(await getUserByEmail("writer@example.com")).toMatchObject({
      status: "active",
      displayName: "Wendy Writer",
      role: "officer",
    });
  });

  it("rejects uninvited OAuth users after bootstrap", async () => {
    await createUser({
      id: "usr_admin",
      email: "admin@example.com",
      displayName: "Ada Admin",
      role: "admin",
      status: "active",
      sessionGen: 0,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });

    expect(
      await resolveOAuthSignIn({
        email: "writer@example.com",
        provider: "google",
        providerAccountId: "google-sub-456",
        adminEmail: "admin@example.com",
      }),
    ).toEqual({
      ok: false,
      reason: "unauthorized",
      message:
        "This Google account is not invited to Cleared. Ask an admin to invite it.",
    });
  });

  it("rejects deactivated users", async () => {
    await createUser({
      id: "usr_writer",
      email: "writer@example.com",
      displayName: "Wendy Writer",
      role: "author",
      status: "deactivated",
      sessionGen: 2,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });

    expect(
      await resolveOAuthSignIn({
        email: "writer@example.com",
        provider: "google",
        providerAccountId: "google-sub-456",
        adminEmail: "admin@example.com",
      }),
    ).toEqual({
      ok: false,
      reason: "deactivated",
      message: "This Cleared account has been deactivated.",
    });
  });

  it("fails closed when ADMIN_EMAIL is missing before bootstrap", async () => {
    expect(
      await resolveOAuthSignIn({
        email: "admin@example.com",
        provider: "google",
        providerAccountId: "google-sub-123",
        adminEmail: undefined,
      }),
    ).toEqual({
      ok: false,
      reason: "missing_admin_email",
      message:
        "OAuth sign-in is not ready: set ADMIN_EMAIL to seed the first admin.",
    });
  });
});

describe("isGoogleOAuthConfigured", () => {
  it("requires both Google OAuth env vars", () => {
    expect(
      isGoogleOAuthConfigured({
        AUTH_GOOGLE_ID: "id",
        AUTH_GOOGLE_SECRET: "secret",
      }),
    ).toBe(true);
    expect(isGoogleOAuthConfigured({ AUTH_GOOGLE_ID: "id" })).toBe(false);
    expect(isGoogleOAuthConfigured({ AUTH_GOOGLE_SECRET: "secret" })).toBe(
      false,
    );
  });
});

describe("sessionFromAuthJsSession", () => {
  it("accepts the unified OAuth session emitted by Auth.js", () => {
    expect(
      sessionFromAuthJsSession({
        personaId: "usr_admin",
        userId: "usr_admin",
        name: "Ada Admin",
        email: "ADA@example.com",
        role: "admin",
        authMethod: "oauth",
        gen: 0,
      }),
    ).toEqual<Session>({
      personaId: "usr_admin",
      userId: "usr_admin",
      name: "Ada Admin",
      email: "ada@example.com",
      role: "admin",
      authMethod: "oauth",
      gen: 0,
    });
  });

  it("rejects incomplete Auth.js sessions", () => {
    expect(
      sessionFromAuthJsSession({
        userId: "usr_admin",
        role: "admin",
        authMethod: "oauth",
      }),
    ).toBeNull();
  });
});

describe("assertAuthJsSecret", () => {
  it("requires AUTH_SECRET for production OAuth sessions", () => {
    expect(() =>
      assertAuthJsSecret({
        nodeEnv: "production",
        oauthConfigured: true,
        authSecret: undefined,
      }),
    ).toThrow("AUTH_SECRET is required when OAuth is configured in production.");
  });

  it("does not require AUTH_SECRET when OAuth is not configured", () => {
    expect(() =>
      assertAuthJsSecret({
        nodeEnv: "production",
        oauthConfigured: false,
        authSecret: undefined,
      }),
    ).not.toThrow();
  });
});

describe("loginAuthOptions", () => {
  it("shows Google only when OAuth credentials are configured", () => {
    expect(
      loginAuthOptions({ demoAuthEnabled: true, oauthConfigured: true }),
    ).toMatchObject({ showDemoPersonas: true, showGoogle: true });

    expect(
      loginAuthOptions({ demoAuthEnabled: true, oauthConfigured: false }),
    ).toMatchObject({ showDemoPersonas: true, showGoogle: false });
  });

  it("shows an honest not-configured state when no auth path is available", () => {
    expect(
      loginAuthOptions({ demoAuthEnabled: false, oauthConfigured: false }),
    ).toEqual({
      showDemoPersonas: false,
      showGoogle: false,
      state: "oauth_not_configured",
      message:
        "OAuth is not configured for this deployment. Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, or enable demo auth intentionally.",
    });
  });
});
