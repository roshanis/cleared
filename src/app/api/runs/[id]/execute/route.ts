import { NextResponse } from "next/server";
import { runReview } from "@/agent/run";
import { getSession } from "@/lib/session";
import { getDb, updateRun } from "@/lib/store";

// Model reviews can take a minute; give the function room.
export const maxDuration = 300;

export async function POST(
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
  if (run.status === "done") {
    return NextResponse.json({
      status: "done",
      result: run.result,
      reviewer: run.reviewer,
      documentId: run.documentId,
    });
  }

  const version = db.versions.find((v) => v.id === run.versionId);
  const rubric = db.rubrics.find((r) => r.version === run.rubricVersion);
  if (!version || !rubric) {
    return NextResponse.json({ error: "Run is corrupt." }, { status: 500 });
  }

  await updateRun(id, { status: "reviewing" });
  try {
    const result = await runReview(version.content, rubric, run.reviewer);
    await updateRun(id, {
      status: "done",
      result,
      finishedAt: new Date().toISOString(),
    });
    return NextResponse.json({
      status: "done",
      result,
      reviewer: run.reviewer,
      documentId: run.documentId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateRun(id, {
      status: "error",
      error: message,
      finishedAt: new Date().toISOString(),
    });
    return NextResponse.json(
      { status: "error", error: message },
      { status: 500 },
    );
  }
}
