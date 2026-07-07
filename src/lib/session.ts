import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { publicDemoEnabled } from "./demo";
import { signToken, verifyToken } from "./token";

export type Role = "author" | "officer" | "admin" | "auditor";

export interface Session {
  personaId: string;
  name: string;
  role: Role;
}

/**
 * Demo authentication: sign in as a persona, optionally gated by a shared
 * access code (APP_ACCESS_CODE). Swap for a real auth provider before opening
 * this to untrusted users — the role model and requireRole() call sites stay.
 */
export const personas: readonly {
  id: string;
  name: string;
  role: Role;
  tagline: string;
  sees: string;
}[] = [
  {
    id: "maya",
    name: "Maya Chen",
    role: "author",
    tagline: "Content author — submits documents and fixes findings",
    sees: "Submit page, your documents, review results",
  },
  {
    id: "devon",
    name: "Devon Park",
    role: "officer",
    tagline: "Compliance officer — owns the review queue and decisions",
    sees: "Review queue, decisions, dashboard",
  },
  {
    id: "priya",
    name: "Priya Nair",
    role: "admin",
    tagline: "Compliance lead — rubric, dashboard, and everything below",
    sees: "Everything + rubric editor",
  },
  {
    id: "sam",
    name: "Sam Osei",
    role: "auditor",
    tagline: "Auditor — read-only history, decisions, and CSV export",
    sees: "Documents, audit log, CSV export",
  },
];

/** Single source of truth for role → home page mapping. */
export const homeByRole: Record<Role, string> = {
  author: "/documents",
  officer: "/queue",
  admin: "/dashboard",
  auditor: "/audit",
};

export const SESSION_COOKIE = "cleared_session";
const WEEK_MS = 7 * 24 * 3600 * 1000;

const isProduction = () => process.env.NODE_ENV === "production";

const secret = () => {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (isProduction()) {
    throw new Error("AUTH_SECRET is required in production.");
  }
  return "cleared-dev-secret";
};

export function demoAuthEnabled(): boolean {
  if (process.env.DEMO_AUTH === "1") return true;
  if (process.env.DEMO_AUTH === "0") return false;
  return !isProduction();
}

export function sessionTokenFor(personaId: string): string | null {
  if (!demoAuthEnabled()) return null;
  const persona = personas.find((p) => p.id === personaId);
  if (!persona) return null;
  return signToken(
    {
      personaId: persona.id,
      name: persona.name,
      role: persona.role,
      exp: Date.now() + WEEK_MS,
    },
    secret(),
  );
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyToken<Session & { exp: number }>(token, secret());
  if (!payload || payload.exp < Date.now()) return null;
  const { personaId, name, role } = payload;
  return { personaId, name, role };
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await requireSession();
  if (roles.length > 0 && !roles.includes(session.role)) redirect("/");
  return session;
}

export function accessCodeOk(code: string | undefined): boolean {
  if (!demoAuthEnabled()) return false;
  if (publicDemoEnabled()) return true;
  const required = process.env.APP_ACCESS_CODE;
  if (!required) return !isProduction();
  return code === required;
}

/**
 * Demo persona switch: the token and role home for a visitor who is already
 * signed in. Null when the persona is unknown or demo auth is off — the
 * switch route never mints a session the login gate would not have granted.
 */
export function switchTarget(
  personaId: string,
): { token: string; home: string } | null {
  const persona = personas.find((p) => p.id === personaId);
  if (!persona) return null;
  const token = sessionTokenFor(personaId);
  if (!token) return null;
  return { token, home: homeByRole[persona.role] };
}
