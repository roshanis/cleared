import { NextResponse } from "next/server";
import { z } from "zod";
import { activeReviewer } from "@/agent/run";
import { requireSameOrigin } from "@/lib/request-guard";
import { canSubmit } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { SUPPORTED_JURISDICTIONS } from "@/lib/rubric";
import { createSubmission, getDb } from "@/lib/store";

const bodySchema = z.object({
  title: z.string().max(200).optional().default(""),
  content: z.string().min(1, "Document is empty").max(50_000),
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

  const derivedTitle =
    title.trim() ||
    content.match(/^Subject:\s*(.+)$/m)?.[1]?.trim() ||
    "Untitled document";

  const { document, version, run } = await createSubmission({
    title: derivedTitle,
    content,
    author: session.name,
    documentId,
    reviewer: activeReviewer(),
    jurisdictions: [...new Set(jurisdictions)],
  });

  return NextResponse.json({
    documentId: document.id,
    versionNumber: version.number,
    runId: run.id,
    reviewer: run.reviewer,
  });
}
