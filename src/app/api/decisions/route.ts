import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { addDecision, decisionForRun, getDb } from "@/lib/store";

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
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (session.role === "author") {
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

  const db = await getDb();
  const run = db.runs.find((r) => r.id === parsed.data.runId);
  if (!run || run.status !== "done" || !run.result) {
    return NextResponse.json(
      { error: "That review has not finished." },
      { status: 409 },
    );
  }
  if (decisionForRun(db, run.id)) {
    return NextResponse.json(
      { error: "A decision was already recorded for this review." },
      { status: 409 },
    );
  }

  const decision = await addDecision({
    runId: parsed.data.runId,
    officer: session.name,
    action: parsed.data.action,
    note: parsed.data.note,
    overrides: parsed.data.overrides,
  });
  return NextResponse.json({ decision });
}
