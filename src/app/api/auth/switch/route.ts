import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/request-guard";
import {
  getSession,
  personas,
  SESSION_COOKIE,
  switchTarget,
} from "@/lib/session";

const bodySchema = z.object({ personaId: z.string() });

/**
 * Demo persona switch. Requires an existing valid session — this endpoint
 * never mints a session for an unauthenticated caller.
 */
export async function POST(req: Request) {
  const sameOriginError = requireSameOrigin(req);
  if (sameOriginError) return sameOriginError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!personas.some((p) => p.id === parsed.data.personaId)) {
    return NextResponse.json({ error: "Unknown persona." }, { status: 400 });
  }
  let target: ReturnType<typeof switchTarget>;
  try {
    target = switchTarget(parsed.data.personaId);
  } catch {
    return NextResponse.json(
      { error: "Demo authentication is not configured." },
      { status: 500 },
    );
  }
  if (!target) {
    return NextResponse.json(
      { error: "Demo authentication is disabled." },
      { status: 403 },
    );
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, target.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
  return NextResponse.json({ ok: true, home: target.home });
}
