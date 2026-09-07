import { readFileSync } from "node:fs";
import path from "node:path";
import { reviewResultSchema, type ReviewResult, type Coverage } from "@/schema";
import { publicDemoEnabled, publicModelEnabled } from "@/lib/demo";
import {
  renderRubricMarkdown,
  severityOrder,
  sliceRubric,
  type CriterionArea,
  type RubricCriterion,
  type RubricDraft,
} from "@/lib/rubric";
import { heuristicReview, heuristicSupports } from "./heuristic";
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

/**
 * Model reviewers when a key is configured, deterministic demo reviewer
 * otherwise. A public demo only spends model budget behind the explicit
 * DEMO_PUBLIC_MODEL opt-in; otherwise visitors stay on the heuristic path.
 */
export function activeReviewer(): ReviewerKind {
  if (publicDemoEnabled() && !publicModelEnabled()) return "heuristic";
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
  let coverage: Coverage[];
  if (reviewer === "heuristic") {
    perReviewer = reviewerAreas.map(({ area }) =>
      heuristicReview(
        document,
        sliced.criteria.filter((c) => c.area === area),
      ),
    );
    const found = perReviewer.flat();
    coverage = sliced.criteria.map(criterion => ({
      criterionId: criterion.id,
      status: !heuristicSupports(criterion) ? "unsupported" : found.some(f => f.criterionId === criterion.id) ? "finding" : "checked",
      detail: !heuristicSupports(criterion)
        ? "The demo reviewer cannot evaluate this rule. Request a model or human review."
        : "Limited pattern check against the starter rule; context, paraphrases, and external sources are not fully verified.",
    }));
  } else {
    const reports = await Promise.all(
      reviewerAreas.map(({ area, prompt }) =>
        sliced.criteria.some(c => c.area === area) ? modelReview({
          document,
          instructions: `${promptFile(prompt)}\n\n${renderRubricMarkdown(sliced, area)}`,
          modelId: MODEL_ID,
          criteria: sliced.criteria.filter(c => c.area === area),
        }) : Promise.resolve({ findings: [], coverage: [] }),
      ),
    );
    perReviewer = reports.map(r => r.findings);
    coverage = reports.flatMap(r => r.coverage);
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

  coverage = coverage.map(check => gated.findings.some(f => f.criterionId === check.criterionId && f.confidence === "low")
    ? { ...check, status: "uncertain", detail: "This assessment is uncertain or its evidence was challenged. A human needs to resolve it." }
    : check);
  const gaps = coverage.filter(c => ["uncertain", "unsupported", "omitted"].includes(c.status));
  const verdict = gaps.length > 0 && gated.verdict === "pass" ? "needs_human_review" : gated.verdict;
  const jurisdictionVerdicts = gated.jurisdictionVerdicts.map(market => ({
    ...market,
    verdict: market.verdict === "pass" && gaps.some(gap => {
      const rule = sliced.criteria.find(c => c.id === gap.criterionId);
      return !rule?.jurisdictions || rule.jurisdictions.includes(market.jurisdiction);
    }) ? "needs_human_review" : market.verdict,
  }));

  return reviewResultSchema.parse({
    verdict,
    findings: gated.findings.map(
      ({ confidence: _confidence, ...finding }) => finding,
    ),
    summary: gaps.length > 0
      ? `${gated.findings.length} finding(s); ${gaps.length} rule assessment(s) need human attention. Review the coverage gaps before making a decision.`
      : buildSummary(verdict, gated.findings),
    jurisdictionVerdicts,
    judge: gated.judge,
    coverage,
  });
}



function buildSummary(
  verdict: ReviewResult["verdict"],
  findings: ReviewerFinding[],
): string {
  if (findings.length === 0) {
    return verdict === "pass" ? "No issues found under the checked rules. This automated result is not an approval or a verification of external facts." : "Human review needed. The verification stage could not confirm a clean review.";
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
