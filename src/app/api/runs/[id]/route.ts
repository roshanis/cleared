import { NextResponse } from "next/server";
import { canAccessRun } from "@/lib/access";
import { getSession } from "@/lib/session";
import { getDb } from "@/lib/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
  return NextResponse.json({
    id: run.id,
    status: run.status,
    reviewer: run.reviewer,
    result: run.result,
    error: run.error,
    documentId: run.documentId,
  });
}
