import path from "node:path";
import { runReview } from "@/agent/run";
import { loadGoldenCases } from "../../evals/grade";
import { defaultRubricDraft } from "./rubric";
import { newId, publishedRubric, type Db } from "./store";

const daysAgo = (days: number, extraMinutes = 0) =>
  new Date(Date.now() - days * 86400e3 + extraMinutes * 60e3).toISOString();

const titleFrom = (input: string, fallback: string) => {
  const subject = input.match(/^Subject:\s*(.+)$/m);
  return subject ? subject[1].trim() : fallback;
};

/**
 * Idempotent seed: rubric v1 (published) always; demo data — the golden
 * documents reviewed through the real pipeline (deterministic heuristic
 * reviewers) plus one officer decision — unless disabled.
 */
export async function seedInto(
  db: Db,
  opts: { demoData?: boolean } = {},
): Promise<void> {
  const { demoData = true } = opts;

  if (db.rubrics.length === 0) {
    db.rubrics.push({
      ...defaultRubricDraft,
      version: 1,
      author: "Priya Nair",
      createdAt: daysAgo(40),
      publishedAt: daysAgo(40),
      goldenGate: null,
    });
  }

  if (!demoData || db.documents.length > 0) return;

  const rubric = publishedRubric(db);
  const goldens = loadGoldenCases(path.join(process.cwd(), "evals", "golden"));
  const ageByCase: Record<string, number> = {
    "001-compliant-review-notice": 6,
    "002-guaranteed-returns-pitch": 3,
    "003-unsubstantiated-comparison": 1,
  };

  for (const golden of goldens) {
    const age = ageByCase[golden.id] ?? 2;
    const createdAt = daysAgo(age);
    const document = {
      id: newId("doc"),
      title: titleFrom(golden.input, golden.id),
      author: "Maya Chen",
      createdAt,
    };
    db.documents.push(document);
    const version = {
      id: newId("ver"),
      documentId: document.id,
      number: 1,
      author: document.author,
      content: golden.input,
      createdAt,
    };
    db.versions.push(version);
    const result = await runReview(golden.input, rubric, "heuristic", golden.expected.jurisdictions);
    const run = {
      id: newId("run"),
      documentId: document.id,
      versionId: version.id,
      status: "done" as const,
      reviewer: "heuristic" as const,
      rubricVersion: rubric.version,
      result,
      error: null,
      createdAt,
      finishedAt: daysAgo(age, 1),
    };
    db.runs.push(run);

    // Devon has already handled the flagrant one — audit history has content;
    // the subtle one stays in the queue for the demo.
    if (golden.id === "002-guaranteed-returns-pitch") {
      db.decisions.push({
        id: newId("dec"),
        runId: run.id,
        documentId: document.id,
        officer: "Devon Park",
        action: "reject",
        note: "Agree with the agent on all counts — guarantee language plus an account-number request by email. Returned to the growth desk with the findings.",
        overrides: result.findings.map((_, findingIndex) => ({
          findingIndex,
          action: "accept" as const,
        })),
        createdAt: daysAgo(age, 45),
      });
    }
  }
}
