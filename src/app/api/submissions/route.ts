import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/request-guard";
import { chooseReviewer } from "@/lib/reviewer-choice";
import { canSubmit } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { SUPPORTED_JURISDICTIONS } from "@/lib/rubric";
import { checkSubmissionRateLimit } from "@/lib/submission-rate-limiter";
import { createSubmission, getDb } from "@/lib/store";

const bodySchema = z.object({
  title: z.string().max(200).optional().default(""),
  content: z.string().min(1, "Document is empty"),
  documentId: z.string().optional(),
  jurisdictions: z
    .array(z.enum(SUPPORTED_JURISDICTIONS))
    .min(1)
    .optional()
    .default(["US"]),
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
  const { title, content, documentId, jurisdictions } = parsed.data;
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
  const reviewerNote = choice.note;

  const { document, version, run } = await createSubmission({
    title: derivedTitle,
    content,
    author: session.name,
    actorId: session.userId,
    documentId,
    reviewer,
    jurisdictions: [...new Set(jurisdictions)],
  });

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
