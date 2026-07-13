import { NextResponse } from "next/server";
import { canAccessRun } from "@/lib/access";
import { executeRun } from "@/lib/execute-run";
import { requireSameOrigin } from "@/lib/request-guard";
import { getSession } from "@/lib/session";
import { getDb } from "@/lib/store";

// Model reviews can take a minute; give the function room.
export const maxDuration = 300;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sameOriginError = requireSameOrigin(req);
  if (sameOriginError) return sameOriginError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const { id } = await params;
  const db = await getDb();
  const run = db.runs.find((r) => r.id === id);
  if (!run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }
  if (!canAccessRun(session, db, run)) {
    return NextResponse.json({ error: "Not your review run." }, { status: 403 });
  }

  const outcome = await executeRun(id);
  if (outcome.status === "missing") {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }
  if (outcome.status === "corrupt") {
    return NextResponse.json({ error: "Run is corrupt." }, { status: 500 });
  }
  if (outcome.status === "reviewing") {
    return NextResponse.json(
      { status: "reviewing", error: outcome.error },
      { status: 409 },
    );
  }
  if (outcome.status === "error") {
    return NextResponse.json(
      { status: "error", error: outcome.error },
      { status: 500 },
    );
  }
  return NextResponse.json({
    status: "done",
    result: outcome.result,
    reviewer: outcome.reviewer,
    documentId: outcome.documentId,
  });
}
