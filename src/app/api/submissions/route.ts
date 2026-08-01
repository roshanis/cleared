import { NextResponse } from "next/server";
import { z } from "zod";
import { activeReviewer, type ReviewerKind } from "@/agent/run";
import { canAccessDocument } from "@/lib/access";
import { publicDemoEnabled } from "@/lib/demo";
import {
  dailyModelCap,
  modelBudgetStatus,
  secondsUntilNextUtcDay,
} from "@/lib/model-budget";
import { requireSameOrigin } from "@/lib/request-guard";
import { canSubmit } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { SUPPORTED_JURISDICTIONS } from "@/lib/rubric";
import { checkSubmissionRateLimit } from "@/lib/submission-rate-limiter";
import { ModelBudgetExceededError, createSubmission, getDb } from "@/lib/store";

const bodySchema = z.object({
  title: z.string().max(200).optional().default(""),
  content: z.string().min(1, "Document is empty"),
  documentId: z.string().optional(),
  jurisdictions: z.array(z.enum(SUPPORTED_JURISDICTIONS)).min(1).optional(),
});

const DEFAULT_MAX_DOCUMENT_CHARS = 50_000;

export async function POST(req: Request) {
  const sameOriginError = requireSameOrigin(req);
  if (sameOriginError) return sameOriginError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (!canSubmit(session.role)) {
    return NextResponse.json(
      { error: "Only authors and admins can submit documents." },
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
  const { title, content, documentId, jurisdictions: requestedJurisdictions } =
    parsed.data;
  const documentLimit = maxDocumentChars();
  if (content.length > documentLimit) {
    return NextResponse.json(
      {
        error: `Document is too long. Limit it to ${documentLimit.toLocaleString()} characters.`,
      },
      { status: 400 },
    );
  }

  // A resubmit that does not name markets inherits the previous run's, so
  // market-specific criteria stay in force instead of resetting to US-only.
  let inheritedJurisdictions: string[] | undefined;
  if (documentId) {
    const db = await getDb();
    const document = db.documents.find((d) => d.id === documentId);
    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    if (!canAccessDocument(session, document)) {
      return NextResponse.json({ error: "Not your document." }, { status: 403 });
    }
    const previousRun = db.runs
      .filter((r) => r.documentId === documentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const inherited = previousRun?.jurisdictions?.filter((j) =>
      (SUPPORTED_JURISDICTIONS as readonly string[]).includes(j),
    );
    if (inherited?.length) inheritedJurisdictions = inherited;
  }
  const jurisdictions =
    requestedJurisdictions ?? inheritedJurisdictions ?? ["US"];

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

  const derivedTitle =
    title.trim() ||
    content.match(/^Subject:\s*(.+)$/m)?.[1]?.trim() ||
    "Untitled document";

  let reviewer: ReviewerKind = activeReviewer();
  let reviewerNote: string | null = null;
  if (reviewer === "model") {
    const db = await getDb();
    const budget = modelBudgetStatus({
      runs: db.runs,
      nowIso: new Date().toISOString(),
      cap: dailyModelCap(),
    });
    if (!budget.allowed && publicDemoEnabled()) {
      reviewer = "heuristic";
      reviewerNote =
        "Today's live-review budget is used up, so this public demo submission ran on the deterministic reviewer.";
    } else if (!budget.allowed) {
      return NextResponse.json(
        {
          error:
            "The daily live-review budget is used up. Try again after the UTC daily reset or switch to the demo reviewer.",
          retryAfterSeconds: budget.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(budget.retryAfterSeconds) },
        },
      );
    }
  }

  const submissionInput = () => ({
    title: derivedTitle,
    content,
    author: session.name,
    actorId: session.userId,
    documentId,
    reviewer,
    jurisdictions: [...new Set(jurisdictions)],
    modelDailyCap: reviewer === "model" ? dailyModelCap() : undefined,
  });

  let submission;
  try {
    submission = await createSubmission(submissionInput());
  } catch (err) {
    // The pre-check above reads a snapshot; the store re-checks the budget
    // inside the insert transaction so concurrent submissions cannot
    // overshoot the cap together.
    if (!(err instanceof ModelBudgetExceededError)) throw err;
    if (publicDemoEnabled()) {
      reviewer = "heuristic";
      reviewerNote =
        "Today's live-review budget is used up, so this public demo submission ran on the deterministic reviewer.";
      submission = await createSubmission(submissionInput());
    } else {
      const retryAfterSeconds = secondsUntilNextUtcDay(
        new Date().toISOString(),
      );
      return NextResponse.json(
        {
          error:
            "The daily live-review budget is used up. Try again after the UTC daily reset or switch to the demo reviewer.",
          retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds) },
        },
      );
    }
  }
  const { document, version, run } = submission;

  return NextResponse.json({
    documentId: document.id,
    versionNumber: version.number,
    runId: run.id,
    reviewer: run.reviewer,
    reviewerNote,
  });
}

function maxDocumentChars(): number {
  const raw = process.env.MAX_DOCUMENT_CHARS?.trim();
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_MAX_DOCUMENT_CHARS;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MAX_DOCUMENT_CHARS;
}

function formatRetryAfter(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}
