import { NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/request-guard";
import { demoAuthEnabled, getSession } from "@/lib/session";
import { resetDemoData } from "@/lib/store";

export async function POST(req: Request) {
  const sameOriginError = requireSameOrigin(req);
  if (sameOriginError) return sameOriginError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json(
      { error: "Only compliance leads can reset demo data." },
      { status: 403 },
    );
  }
  if (!demoAuthEnabled()) {
    return NextResponse.json(
      { error: "Demo reset is only available when demo auth is enabled." },
      { status: 403 },
    );
  }

  const seeded = await resetDemoData();
  return NextResponse.json({ ok: true, seeded });
}
