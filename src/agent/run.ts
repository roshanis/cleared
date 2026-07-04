import { readFileSync } from "node:fs";
import path from "node:path";
import { reviewResultSchema, type ReviewResult } from "@/schema";
import {
  renderRubricMarkdown,
  severityOrder,
  type CriterionArea,
  type RubricDraft,
} from "@/lib/rubric";
import { heuristicReview } from "./heuristic";
import { mergeFindings, type ReviewerFinding } from "./merge";
import { modelReview } from "./model-reviewer";
import { decideVerdict } from "./verdict";

export type ReviewerKind = "model" | "heuristic";

export const MODEL_ID = "anthropic/claude-opus-4-8";
const providerModelId = MODEL_ID.replace(/^anthropic\//, "");

/** Model reviewers when a key is configured, deterministic demo reviewer otherwise. */
export function activeReviewer(): ReviewerKind {
  return process.env.ANTHROPIC_API_KEY ? "model" : "heuristic";
}

const promptFile = (name: string) =>
  readFileSync(path.join(process.cwd(), "src", "prompts", `${name}.md`), "utf8");

const reviewerAreas: { area: CriterionArea; prompt: string }[] = [
  { area: "content", prompt: "reviewer-policy" },
  { area: "risk", prompt: "reviewer-risk" },
];

/**
 * The review pipeline: two reviewer subagents in parallel, then a
 * deterministic orchestration step in code (merge, dedupe, verdict rules).
 * Control flow lives here rather than in a model so verdicts are auditable.
 */
export async function runReview(
  document: string,
  rubric: RubricDraft,
  reviewer: ReviewerKind = activeReviewer(),
): Promise<ReviewResult> {
  let perReviewer: ReviewerFinding[][];
  if (reviewer === "heuristic") {
    perReviewer = reviewerAreas.map(({ area }) =>
      heuristicReview(
        document,
        rubric.criteria.filter((c) => c.area === area),
      ),
    );
  } else {
    perReviewer = await Promise.all(
      reviewerAreas.map(({ area, prompt }) =>
        modelReview({
          document,
          instructions: `${promptFile(prompt)}\n\n${renderRubricMarkdown(rubric, area)}`,
          modelId: providerModelId,
        }),
      ),
    );
  }

  const findings = mergeFindings(perReviewer, rubric.criteria);
  const verdict = decideVerdict(findings, rubric);
  return reviewResultSchema.parse({
    verdict,
    findings: findings.map(({ confidence: _confidence, ...finding }) => finding),
    summary: buildSummary(verdict, findings),
  });
}

function buildSummary(
  verdict: ReviewResult["verdict"],
  findings: ReviewerFinding[],
): string {
  if (findings.length === 0) {
    return "Pass: no rubric violations found. The document is clear to ship.";
  }
  const counts = severityOrder
    .map((s) => [s, findings.filter((f) => f.severity === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${s}`)
    .join(", ");
  const lead =
    verdict === "fail"
      ? "Fail"
      : verdict === "needs_human_review"
        ? "Needs human review"
        : "Pass";
  const top = findings[0];
  return `${lead}: ${findings.length} finding${findings.length === 1 ? "" : "s"} (${counts}). Most severe: ${top.criterionId} — ${top.explanation} See the findings panel for exact quotes and fixes.`;
}
