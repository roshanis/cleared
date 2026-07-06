import { readFileSync } from "node:fs";
import path from "node:path";
import { reviewResultSchema, type ReviewResult } from "@/schema";
import {
  renderRubricMarkdown,
  severityOrder,
  sliceRubric,
  type CriterionArea,
  type RubricCriterion,
  type RubricDraft,
} from "@/lib/rubric";
import { heuristicReview } from "./heuristic";
import { applyJudgeGating, heuristicJudge, modelJudge } from "./judge";
import { mergeFindings, type ReviewerFinding } from "./merge";
import { modelReview } from "./model-reviewer";
import {
  partitionFindingsByJurisdiction,
  verdictsByJurisdiction,
  worstVerdict,
} from "./verdict";

export { partitionFindingsByJurisdiction };

export type ReviewerKind = "model" | "heuristic";

export const MODEL_ID = process.env.OPENAI_MODEL || "gpt-5.4-mini";

/** Model reviewers when a key is configured, deterministic demo reviewer otherwise. */
export function activeReviewer(): ReviewerKind {
  return process.env.OPENAI_API_KEY ? "model" : "heuristic";
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
  jurisdictions: string[] = ["US"],
): Promise<ReviewResult> {
  const sliced = sliceRubric(rubric, jurisdictions);

  let perReviewer: ReviewerFinding[][];
  if (reviewer === "heuristic") {
    perReviewer = reviewerAreas.map(({ area }) =>
      heuristicReview(
        document,
        sliced.criteria.filter((c) => c.area === area),
      ),
    );
  } else {
    perReviewer = await Promise.all(
      reviewerAreas.map(({ area, prompt }) =>
        modelReview({
          document,
          instructions: `${promptFile(prompt)}\n\n${renderRubricMarkdown(sliced, area)}`,
          modelId: MODEL_ID,
        }),
      ),
    );
  }

  const findings = mergeFindings(perReviewer, sliced.criteria);

  // The judge reviews the review; gating is deterministic and can only
  // escalate toward human review (see src/agent/judge.ts).
  const draftVerdict = worstVerdict(
    verdictsByJurisdiction(findings, sliced, jurisdictions).map(
      (v) => v.verdict,
    ),
  );
  const judgeOutput =
    reviewer === "heuristic"
      ? heuristicJudge(document, findings, sliced, jurisdictions)
      : await modelJudge({
          document,
          findings,
          rubric: sliced,
          draftVerdict,
          instructions: promptFile("judge"),
          modelId: MODEL_ID,
        });
  const gated = applyJudgeGating({
    findings,
    judge: judgeOutput,
    rubric: sliced,
    jurisdictions,
  });

  return reviewResultSchema.parse({
    verdict: gated.verdict,
    findings: gated.findings.map(
      ({ confidence: _confidence, ...finding }) => finding,
    ),
    summary:
      gated.summaryOverride ?? buildSummary(gated.verdict, gated.findings),
    jurisdictionVerdicts: gated.jurisdictionVerdicts,
    judge: gated.judge,
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
