import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { MODEL_ID } from "@/agent/run";
import { heuristicFixes, modelFixes } from "@/agent/fixer";
import { canAccessDocument } from "@/lib/access";
import { applyFixes } from "@/lib/patch";
import { requireSameOrigin } from "@/lib/request-guard";
import { canSubmit } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { getDb } from "@/lib/store";

export const maxDuration = 60;

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
  if (!canSubmit(session.role)) {
    return NextResponse.json(
      { error: "Only authors and admins can draft fixes." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const db = await getDb();
  const run = db.runs.find((r) => r.id === id);
  if (!run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }
  const document = db.documents.find((d) => d.id === run.documentId);
  if (!canAccessDocument(session, document)) {
    return NextResponse.json({ error: "Not your document." }, { status: 403 });
  }
  const version = db.versions.find((v) => v.id === run.versionId);
  if (run.status !== "done" || !run.result || !version) {
    return NextResponse.json(
      { error: "The review has not finished — nothing to fix yet." },
      { status: 409 },
    );
  }
  if (run.result.findings.length === 0) {
    return NextResponse.json(
      { error: "No findings — this version already passes." },
      { status: 409 },
    );
  }

  const fixes =
    run.reviewer === "heuristic"
      ? heuristicFixes(run.result.findings)
      : await modelFixes({
          document: version.content,
          findings: run.result.findings,
          instructions: readFileSync(
            path.join(process.cwd(), "src", "prompts", "fixer.md"),
            "utf8",
          ),
          modelId: MODEL_ID,
        });

  const { patched, applied, unlocated } = applyFixes(version.content, fixes);

  return NextResponse.json({
    documentId: document.id,
    title: document.title,
    patched,
    applied,
    unlocated,
  });
}
