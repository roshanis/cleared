import { NextResponse } from "next/server";
import { runReview } from "@/agent/run";
import { canAccessRun } from "@/lib/access";
import { requireSameOrigin } from "@/lib/request-guard";
import { getSession } from "@/lib/session";
import { claimRunForReview, completeRun, failRun, getDb } from "@/lib/store";

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

  const claimed = await claimRunForReview(id);
  if (claimed.status === "missing") {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }
  if (claimed.status === "corrupt") {
    return NextResponse.json({ error: "Run is corrupt." }, { status: 500 });
  }
  if (claimed.status === "reviewing") {
    return NextResponse.json(
      { status: "reviewing", error: "Review is already in progress." },
      { status: 409 },
    );
  }
  if (claimed.status === "done") {
    return NextResponse.json({
      status: "done",
      result: claimed.run.result,
      reviewer: claimed.run.reviewer,
      documentId: claimed.run.documentId,
    });
  }

  try {
    const result = await runReview(
      claimed.version.content,
      claimed.rubric,
      claimed.run.reviewer,
    );
    await completeRun(id, result);
    return NextResponse.json({
      status: "done",
      result,
      reviewer: claimed.run.reviewer,
      documentId: claimed.run.documentId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(id, message);
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500 },
    );
  }
}
