import { NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { getSession } from "@/lib/session";
import { decisionForRun, getDb } from "@/lib/store";

/** Full audit export: one row per review run, with the human decision if any. */
export async function GET() {
  const session = await getSession();
  if (!session || session.role === "author") {
    return NextResponse.json(
      { error: "Only compliance staff can export the audit log." },
      { status: 403 },
    );
  }
  const db = await getDb();
  const rows = db.runs
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((run) => {
      const document = db.documents.find((d) => d.id === run.documentId);
      const version = db.versions.find((v) => v.id === run.versionId);
      const decision = decisionForRun(db, run.id);
      return {
        document: document?.title ?? run.documentId,
        author: document?.author ?? "",
        version: version?.number ?? "",
        version_author: version?.author ?? document?.author ?? "",
        submitted_at: run.createdAt,
        reviewer: run.reviewer,
        rubric_version: run.rubricVersion,
        status: run.status,
        agent_verdict: run.result?.verdict ?? "",
        findings: run.result?.findings.length ?? "",
        finding_criteria:
          run.result?.findings.map((f) => f.criterionId).join(" ") ?? "",
        officer: decision?.officer ?? "",
        decision: decision?.action ?? "",
        decision_note: decision?.note ?? "",
        decided_at: decision?.createdAt ?? "",
      };
    });

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cleared-audit.csv"',
    },
  });
}
