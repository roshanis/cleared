import { describe, expect, it } from "vitest";
import type { Session } from "./session";
import {
  assertAuthJsSecret,
  evaluateOAuthSignIn,
  isAdminEmailAllowed,
  isGoogleOAuthConfigured,
  loginAuthOptions,
  normalizeDemoSession,
  sessionFromAuthJsSession,
  sessionFromOAuthClaims,
} from "./oauth";

describe("normalizeDemoSession", () => {
  it("returns the unified Session shape for demo persona cookies", () => {
    const session = normalizeDemoSession({
      personaId: "maya",
      name: "Maya Chen",
      role: "author",
    });

    expect(session).toEqual<Session>({
      personaId: "maya",
      userId: "demo:maya",
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
      email: "Admin@Example.com",
      name: "Ada Admin",
      role: "admin",
      gen: 7,
    });

    expect(session).toEqual<Session>({
      personaId: "oauth:google:google-sub-123",
      userId: "oauth:google:google-sub-123",
      name: "Ada Admin",
      email: "admin@example.com",
      role: "admin",
      authMethod: "oauth",
      gen: 7,
    });
  });
});

describe("evaluateOAuthSignIn", () => {
  it("allows only the ADMIN_EMAIL identity and seeds it as admin", () => {
    expect(
      evaluateOAuthSignIn({
        email: "admin@example.com",
        provider: "google",
        providerAccountId: "google-sub-123",
        adminEmail: "ADMIN@example.com",
      }),
    ).toEqual({
      ok: true,
      claims: {
        provider: "google",
        providerAccountId: "google-sub-123",
        email: "admin@example.com",
        role: "admin",
        gen: 0,
      },
    });
  });

  it("rejects any other OAuth email before WS-2 invitations exist", () => {
    expect(
      evaluateOAuthSignIn({
        email: "writer@example.com",
        provider: "google",
        providerAccountId: "google-sub-456",
        adminEmail: "admin@example.com",
      }),
    ).toEqual({
      ok: false,
      reason: "unauthorized",
      message:
        "This Google account is not invited to Cleared. Ask an admin to add it in the next user-management round.",
    });
  });

  it("fails closed when ADMIN_EMAIL is missing", () => {
    expect(
      evaluateOAuthSignIn({
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

describe("isAdminEmailAllowed", () => {
  it("compares admin email case-insensitively", () => {
    expect(isAdminEmailAllowed("Admin@Example.com", "admin@example.com")).toBe(
      true,
    );
  });

  it("fails closed when ADMIN_EMAIL is missing", () => {
    expect(isAdminEmailAllowed("admin@example.com", undefined)).toBe(false);
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
        personaId: "oauth:google:sub-1",
        userId: "oauth:google:sub-1",
        name: "Ada Admin",
        email: "ADA@example.com",
        role: "admin",
        authMethod: "oauth",
        gen: 0,
      }),
    ).toEqual<Session>({
      personaId: "oauth:google:sub-1",
      userId: "oauth:google:sub-1",
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
        userId: "oauth:google:sub-1",
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
