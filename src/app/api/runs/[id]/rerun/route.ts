import { NextResponse } from "next/server";
import { canAccessRun } from "@/lib/access";
import { executeRun } from "@/lib/execute-run";
import { requireSameOrigin } from "@/lib/request-guard";
import { chooseReviewer } from "@/lib/reviewer-choice";
import { canRerun } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { checkSubmissionRateLimit } from "@/lib/submission-rate-limiter";
import { getDb, rerunVersion, requestRunId, ModelBudgetExceededError } from "@/lib/store";
import { dailyModelCap, secondsUntilNextUtcDay } from "@/lib/model-budget";
import { publicDemoEnabled } from "@/lib/demo";

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
  const run = db.runs.find((candidate) => candidate.id === id);
  if (!run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }
  if (!canAccessRun(session, db, run)) {
    return NextResponse.json({ error: "Not your review run." }, { status: 403 });
  }
  if (!canRerun(session.role)) {
    return NextResponse.json(
      { error: "Auditors can't re-run reviews." },
      { status: 403 },
    );
  }
  const idempotencyKey = req.headers.get("Idempotency-Key") ?? undefined;
  if (idempotencyKey && !/^[a-zA-Z0-9_-]{8,128}$/.test(idempotencyKey)) return NextResponse.json({ error: "Invalid request key." }, { status: 400 });
  const existing = idempotencyKey ? db.runs.find(candidate => candidate.id === requestRunId("rerun", session.userId, idempotencyKey, id)) : null;
  if (existing) {
    const outcome = await executeRun(existing.id);
    return NextResponse.json({ ...outcome, runId: existing.id, documentId: existing.documentId }, { status: outcome.status === "error" ? 500 : outcome.status === "reviewing" ? 202 : 200 });
  }
  if (run.status === "queued" || run.status === "reviewing") {
    return NextResponse.json(
      { status: "reviewing", error: "A review is already in progress." },
      { status: 409 },
    );
  }

  const rateLimit = checkSubmissionRateLimit(session.userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Too many submissions. Wait about ${formatRetryAfter(rateLimit.retryAfterSeconds)}, then try again.`,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const choice = await chooseReviewer();
  if (!choice.ok) {
    return NextResponse.json(
      {
        error:
          "The daily live-review budget is used up. Try again after the UTC daily reset or switch to the demo reviewer.",
        retryAfterSeconds: choice.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "Retry-After": String(choice.retryAfterSeconds) },
      },
    );
  }

  let reviewer = choice.reviewer;
  const input = () => ({
    versionId: run.versionId,
    reviewer,
    modelDailyCap: reviewer === "model" ? dailyModelCap() : undefined,
    actorId: session.userId,
    jurisdictions: run.jurisdictions,
    idempotencyKey,
    sourceRunId: id,
  });
  let created;
  try {
    created = await rerunVersion(input());
  } catch (error) {
    if (!(error instanceof ModelBudgetExceededError)) throw error;
    if (publicDemoEnabled()) {
      reviewer = "heuristic";
      created = await rerunVersion(input());
    } else {
      const retryAfterSeconds = secondsUntilNextUtcDay(new Date().toISOString());
      return NextResponse.json({ error: "The daily live-review budget is used up. Try again after the UTC daily reset.", retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } });
    }
  }
  if (created.status === "missing") {
    return NextResponse.json(
      { error: "Document version not found." },
      { status: 404 },
    );
  }

  const outcome = await executeRun(created.run.id);
  if (outcome.status === "missing") {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }
  if (outcome.status === "corrupt") {
    return NextResponse.json({ error: "Run is corrupt." }, { status: 500 });
  }
  if (outcome.status === "reviewing") {
    return NextResponse.json(
      { status: "reviewing", error: outcome.error, runId: created.run.id },
      { status: 202 },
    );
  }
  if (outcome.status === "error") {
    return NextResponse.json(
      { status: "error", error: outcome.error, runId: created.run.id },
      { status: 500 },
    );
  }
  return NextResponse.json({
    status: "done",
    result: outcome.result,
    reviewer: outcome.reviewer,
    documentId: outcome.documentId,
    runId: created.run.id,
    reviewerNote: created.run.reviewer === "heuristic" ? "This run uses limited demo checks. Inspect coverage before relying on the result." : null,
  });
}

function formatRetryAfter(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}
