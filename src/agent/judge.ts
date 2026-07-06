import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import {
  defaultRubricDraft,
  renderRubricMarkdown,
  type RubricDraft,
} from "@/lib/rubric";
import { verdicts, type JudgeReport, type ReviewResult } from "@/schema";
import type { ReviewerFinding } from "./merge";
import { verdictsByJurisdiction, worstVerdict } from "./verdict";

/**
 * The judge reviews the review: it endorses or challenges each merged
 * finding and recommends a verdict. It has no authority of its own —
 * applyJudgeGating() below turns its opinion into deterministic outcomes,
 * and can only ever move a document TOWARD human review.
 */

const judgeOutputSchema = z.object({
  recommendedVerdict: z.enum(verdicts),
  rationale: z
    .string()
    .describe("One paragraph for the compliance officer: does the review hold up?"),
  challenges: z.array(
    z.object({
      findingIndex: z.number().int().min(0),
      reason: z
        .string()
        .describe("Why this finding may be a false positive or misquoted"),
    }),
  ),
});

export type JudgeOutput = z.infer<typeof judgeOutputSchema>;

export interface GatedReview {
  findings: ReviewerFinding[];
  verdict: ReviewResult["verdict"];
  jurisdictionVerdicts: { jurisdiction: string; verdict: ReviewResult["verdict"] }[];
  judge: JudgeReport;
  /** Set when the judge endorsed cleanly — its rationale replaces the summary. */
  summaryOverride?: string;
}

/**
 * Deterministic gating matrix — the auditability core:
 * - challenged findings drop to low confidence (a challenged fail-level
 *   finding therefore routes to human review via the existing verdict rule);
 * - any disagreement between the judge's recommendation and the rule verdict
 *   escalates to needs_human_review — the judge can never flip fail→pass or
 *   pass→fail on its own.
 */
export function applyJudgeGating({
  findings,
  judge,
  rubric,
  jurisdictions,
}: {
  findings: ReviewerFinding[];
  judge: JudgeOutput;
  rubric: RubricDraft;
  jurisdictions: string[];
}): GatedReview {
  const challenges = judge.challenges.filter(
    (c) => c.findingIndex >= 0 && c.findingIndex < findings.length,
  );
  const challenged = new Set(challenges.map((c) => c.findingIndex));
  const gatedFindings = findings.map((finding, i) =>
    challenged.has(i) ? { ...finding, confidence: "low" as const } : finding,
  );

  const jurisdictionVerdicts = verdictsByJurisdiction(
    gatedFindings,
    rubric,
    jurisdictions,
  );
  const ruleVerdict = worstVerdict(jurisdictionVerdicts.map((v) => v.verdict));
  const verdictAgreed = judge.recommendedVerdict === ruleVerdict;
  const verdict = verdictAgreed ? ruleVerdict : "needs_human_review";

  return {
    findings: gatedFindings,
    verdict,
    jurisdictionVerdicts,
    judge: { verdictAgreed, rationale: judge.rationale, challenges },
    summaryOverride:
      verdictAgreed && challenges.length === 0 ? judge.rationale : undefined,
  };
}

const normalize = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Demo-mode judge: a deterministic verifier. It challenges any finding whose
 * quote does not appear (whitespace-normalized) in the document, and
 * recommends whatever the rules say once those challenges are applied — it
 * disputes evidence, never verdict logic.
 */
export function heuristicJudge(
  document: string,
  findings: ReviewerFinding[],
  rubric: RubricDraft = defaultRubricDraft,
  jurisdictions: string[] = ["US"],
): JudgeOutput {
  const haystack = normalize(document);
  const challenges = findings.flatMap((finding, findingIndex) =>
    haystack.includes(normalize(finding.quote))
      ? []
      : [
          {
            findingIndex,
            reason:
              "The quoted passage could not be located in the document — possible misquote or fabrication.",
          },
        ],
  );

  const challengedSet = new Set(challenges.map((c) => c.findingIndex));
  const surviving = findings.map((f, i) =>
    challengedSet.has(i) ? { ...f, confidence: "low" as const } : f,
  );
  const recommendedVerdict = worstVerdict(
    verdictsByJurisdiction(surviving, rubric, jurisdictions).map(
      (v) => v.verdict,
    ),
  );

  return {
    recommendedVerdict,
    rationale:
      challenges.length === 0
        ? "Verified: every finding quotes the document verbatim and the verdict follows the rubric's rules."
        : `${challenges.length} finding quote${challenges.length === 1 ? "" : "s"} could not be located in the document; flagged for human review.`,
    challenges,
  };
}

/** Model-mode judge: one structured call reviewing the merged findings. */
export async function modelJudge({
  document,
  findings,
  rubric,
  draftVerdict,
  instructions,
  modelId,
}: {
  document: string;
  findings: ReviewerFinding[];
  rubric: RubricDraft;
  draftVerdict: ReviewResult["verdict"];
  instructions: string;
  modelId: string;
}): Promise<JudgeOutput> {
  const { object } = await generateObject({
    model: openai(modelId),
    schema: judgeOutputSchema,
    system: `${instructions}\n\n${renderRubricMarkdown(rubric)}`,
    prompt: [
      `The reviewers produced ${findings.length} finding(s) and the rules computed a draft verdict of "${draftVerdict}".`,
      "Findings (by index):",
      JSON.stringify(
        findings.map((f, index) => ({
          index,
          criterionId: f.criterionId,
          severity: f.severity,
          quote: f.quote,
          explanation: f.explanation,
        })),
        null,
        2,
      ),
      "",
      "<document>",
      document,
      "</document>",
    ].join("\n"),
  });
  return object;
}
