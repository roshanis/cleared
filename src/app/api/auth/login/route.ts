import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/request-guard";
import { accessCodeOk, SESSION_COOKIE, sessionTokenFor } from "@/lib/session";

const bodySchema = z.object({
  personaId: z.string(),
  accessCode: z.string().optional(),
});

export async function POST(req: Request) {
  const sameOriginError = requireSameOrigin(req);
  if (sameOriginError) return sameOriginError;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!accessCodeOk(parsed.data.accessCode)) {
    return NextResponse.json({ error: "Wrong access code." }, { status: 403 });
  }
  let token: string | null;
  try {
    token = sessionTokenFor(parsed.data.personaId);
  } catch {
    return NextResponse.json(
      { error: "Demo authentication is not configured." },
      { status: 500 },
    );
  }
  if (!token) {
    return NextResponse.json(
      { error: "Demo authentication is disabled." },
      { status: 403 },
    );
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
  return NextResponse.json({ ok: true });
}
