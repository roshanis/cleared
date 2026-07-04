import type { ReviewResult } from "@/schema";
import type { RubricDraft } from "@/lib/rubric";
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
