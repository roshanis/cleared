import type { ReviewResult } from "@/schema";
import type { RubricCriterion, RubricDraft } from "@/lib/rubric";
import type { ReviewerFinding } from "./merge";

/**
 * Verdict rules from the rubric, applied deterministically in code:
 * - a high-confidence finding at a fail-level severity fails the document
 * - a low-confidence fail-level finding (or any lesser finding) routes to a
 *   human — the agent never guesses `pass` when it found something
 * - no findings passes
 */
export function decideVerdict(
  findings: ReviewerFinding[],
  rubric: Pick<RubricDraft, "failOn">,
): ReviewResult["verdict"] {
  const failing = findings.filter((f) => rubric.failOn.includes(f.severity));
  if (failing.some((f) => (f.confidence ?? "high") === "high")) return "fail";
  if (findings.length > 0) return "needs_human_review";
  return "pass";
}

/**
 * Assign each finding to the selected markets its criterion applies in.
 * Global criteria (no jurisdictions tag) count for every selected market;
 * findings for criteria outside the rubric are dropped.
 */
export function partitionFindingsByJurisdiction(
  findings: ReviewerFinding[],
  criteria: RubricCriterion[],
  jurisdictions: string[],
): Map<string, ReviewerFinding[]> {
  const byId = new Map(criteria.map((c) => [c.id, c]));
  const buckets = new Map<string, ReviewerFinding[]>(
    jurisdictions.map((j) => [j, []]),
  );
  for (const finding of findings) {
    const criterion = byId.get(finding.criterionId);
    if (!criterion) continue;
    for (const jurisdiction of jurisdictions) {
      if (
        !criterion.jurisdictions ||
        criterion.jurisdictions.includes(jurisdiction)
      ) {
        buckets.get(jurisdiction)!.push(finding);
      }
    }
  }
  return buckets;
}

const verdictRank: Record<ReviewResult["verdict"], number> = {
  fail: 0,
  needs_human_review: 1,
  pass: 2,
};

export function worstVerdict(
  verdicts: ReviewResult["verdict"][],
): ReviewResult["verdict"] {
  return verdicts.reduce(
    (worst, v) => (verdictRank[v] < verdictRank[worst] ? v : worst),
    "pass" as ReviewResult["verdict"],
  );
}

/** Per-market verdicts plus the overall (worst) verdict for a finding set. */
export function verdictsByJurisdiction(
  findings: ReviewerFinding[],
  rubric: RubricDraft,
  jurisdictions: string[],
): { jurisdiction: string; verdict: ReviewResult["verdict"] }[] {
  const buckets = partitionFindingsByJurisdiction(
    findings,
    rubric.criteria,
    jurisdictions,
  );
  return jurisdictions.map((jurisdiction) => ({
    jurisdiction,
    verdict: decideVerdict(buckets.get(jurisdiction) ?? [], rubric),
  }));
}
