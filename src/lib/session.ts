import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signToken, verifyToken } from "./token";

export type Role = "author" | "officer" | "admin";

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
}[] = [
  {
    id: "maya",
    name: "Maya Chen",
    role: "author",
    tagline: "Content author — submits documents and fixes findings",
  },
  {
    id: "devon",
    name: "Devon Park",
    role: "officer",
    tagline: "Compliance officer — owns the review queue and decisions",
  },
  {
    id: "priya",
    name: "Priya Nair",
    role: "admin",
    tagline: "Compliance lead — rubric, dashboard, and everything below",
  },
  {
    id: "sam",
    name: "Sam Osei",
    role: "admin",
    tagline: "Auditor — document history and CSV export",
  },
];

export const SESSION_COOKIE = "cleared_session";
const WEEK_MS = 7 * 24 * 3600 * 1000;

const secret = () => process.env.AUTH_SECRET ?? "cleared-dev-secret";

export function sessionTokenFor(personaId: string): string | null {
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
  const required = process.env.APP_ACCESS_CODE;
  if (!required) return true;
  return code === required;
}
