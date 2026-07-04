import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { activeReviewer, runReview } from "@/agent/run";
import { grade, loadGoldenCases } from "../../../../../evals/grade";
import type { GoldenGateReport } from "@/lib/rubric";
import { getSession } from "@/lib/session";
import { getDb, setGoldenGate } from "@/lib/store";

export const maxDuration = 300;

const bodySchema = z.object({ version: z.number().int() });

/**
 * The publish gate: run every golden case through the pipeline with the
 * candidate rubric and grade the outcomes, so a rubric change can't reach
 * production with unreviewed regressions.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (session?.role !== "admin") {
    return NextResponse.json(
      { error: "Only compliance leads can run the gate." },
      { status: 403 },
    );
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const db = await getDb();
  const rubric = db.rubrics.find((r) => r.version === parsed.data.version);
  if (!rubric) {
    return NextResponse.json({ error: "Rubric version not found." }, { status: 404 });
  }

  const reviewer = activeReviewer();
  const goldens = loadGoldenCases(path.join(process.cwd(), "evals", "golden"));
  const cases = [];
  for (const golden of goldens) {
    const result = await runReview(golden.input, rubric, reviewer);
    const report = grade(result, golden.expected);
    cases.push({
      id: golden.id,
      pass: report.pass,
      verdict: result.verdict,
      expectedVerdict: golden.expected.verdict,
      missingCriteria: report.missingCriteria,
      extraCriteria: report.extraCriteria,
    });
  }

  const report: GoldenGateReport = {
    ranAt: new Date().toISOString(),
    reviewer,
    pass: cases.every((c) => c.pass),
    cases,
  };
  await setGoldenGate(rubric.version, report);
  return NextResponse.json({ report });
}
