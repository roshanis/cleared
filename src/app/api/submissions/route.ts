import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/request-guard";
import { chooseReviewer } from "@/lib/reviewer-choice";
import { canSubmit } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { SUPPORTED_JURISDICTIONS } from "@/lib/rubric";
import { checkSubmissionRateLimit } from "@/lib/submission-rate-limiter";
import { maxDocumentChars } from "@/lib/submission-limits";
import { createSubmission, getDb, findSubmissionReplay, IdempotencyConflictError } from "@/lib/store";

const bodySchema = z.object({
  title: z.string().max(200).optional().default(""),
  content: z.string().min(1, "Document is empty").refine(value => value.trim().length > 0, "Document is empty"),
  documentId: z.string().optional(),
  jurisdictions: z
    .array(z.enum(SUPPORTED_JURISDICTIONS))
    .min(1)
    .optional()
    .default(["US"]),
});

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
  const { title, content, documentId, jurisdictions } = parsed.data;
  const idempotencyKey = req.headers.get("Idempotency-Key") ?? undefined;
  if (idempotencyKey && !/^[a-zA-Z0-9_-]{8,128}$/.test(idempotencyKey)) {
    return NextResponse.json({ error: "Invalid request key." }, { status: 400 });
  }
  const documentLimit = maxDocumentChars();
  if (content.length > documentLimit) {
    return NextResponse.json(
      {
        error: `Document is too long. Limit it to ${documentLimit.toLocaleString()} characters.`,
      },
      { status: 400 },
    );
  }

  if (documentId) {
    const db = await getDb();
    const document = db.documents.find((d) => d.id === documentId);
    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    if (session.role === "author" && document.author !== session.name) {
      return NextResponse.json({ error: "Not your document." }, { status: 403 });
    }
  }

  const derivedTitle = title.trim() || content.match(/^Subject:\s*(.+)$/m)?.[1]?.trim() || "Untitled document";
  const replayInput = { title: derivedTitle, content, documentId, jurisdictions, actorId: session.userId, author: session.name, idempotencyKey };
  try {
    const replay = await findSubmissionReplay(replayInput);
    if (replay) return NextResponse.json({ documentId: replay.document.id, versionNumber: replay.version.number, runId: replay.run.id, reviewer: replay.run.reviewer, reviewerNote: reviewerNoteFor(replay.run.reviewer) });
  } catch (error) {
    if (error instanceof IdempotencyConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
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
  const reviewer = choice.reviewer;

  try {
  const { document, version, run } = await createSubmission({
    title: derivedTitle,
    content,
    author: session.name,
    actorId: session.userId,
    documentId,
    reviewer,
    jurisdictions: [...new Set(jurisdictions)],
    idempotencyKey,
  });

  return NextResponse.json({
    documentId: document.id,
    versionNumber: version.number,
    runId: run.id,
    reviewer: run.reviewer,
    reviewerNote: reviewerNoteFor(run.reviewer),
  });
  } catch (error) {
    if (error instanceof IdempotencyConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
}

function reviewerNoteFor(reviewer: "model" | "heuristic") {
  return reviewer === "heuristic" ? "This run uses limited demo checks. Inspect coverage before relying on the result." : null;
}

function formatRetryAfter(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}
