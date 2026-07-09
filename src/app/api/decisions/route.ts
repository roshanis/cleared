import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/request-guard";
import { canDecide } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { addDecision } from "@/lib/store";

const bodySchema = z.object({
  runId: z.string(),
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().min(3, "A note is required for the audit trail."),
  overrides: z.array(
    z.object({
      findingIndex: z.number().int().min(0),
      action: z.enum(["accept", "dismiss"]),
    }),
  ),
});

export async function POST(req: Request) {
  const sameOriginError = requireSameOrigin(req);
  if (sameOriginError) return sameOriginError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (!canDecide(session.role)) {
    return NextResponse.json(
      { error: "Only compliance officers can record decisions." },
      { status: 403 },
    );
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const result = await addDecision({
    runId: parsed.data.runId,
    officer: session.name,
    actorId: session.userId,
    action: parsed.data.action,
    note: parsed.data.note,
    overrides: parsed.data.overrides,
  });
  if (result.status === "missing") {
    return NextResponse.json(
      { error: "That review has not finished." },
      { status: 409 },
    );
  }
  if (result.status === "not_decidable") {
    return NextResponse.json(
      { error: "Passing reviews do not require a human decision." },
      { status: 409 },
    );
  }
  if (result.status === "duplicate") {
    return NextResponse.json(
      { error: "A decision was already recorded for this review." },
      { status: 409 },
    );
  }
  if (result.status === "invalid_overrides") {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }
  return NextResponse.json({ decision: result.decision });
}
