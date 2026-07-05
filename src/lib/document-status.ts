import type { ReviewResult } from "@/schema";

/**
 * The computed status of a document from the author's perspective.
 *
 * - `none`          — no completed review run yet (run absent or in progress)
 * - `clear`         — verdict is pass, no officer decision needed
 * - `action_needed` — verdict is fail, awaiting author fix
 * - `in_review`     — verdict is needs_human_review, awaiting officer decision
 * - `approved`      — an officer approved the run
 * - `rejected`      — an officer rejected the run; author should resubmit
 */
export type DocumentStatusKind =
  | "action_needed"
  | "in_review"
  | "rejected"
  | "approved"
  | "clear"
  | "none";

export function documentStatus({
  verdict,
  hasDecision,
  decisionAction,
}: {
  verdict: ReviewResult["verdict"] | null;
  hasDecision: boolean;
  decisionAction?: "approve" | "reject" | null;
}): DocumentStatusKind {
  if (!verdict) return "none";
  if (hasDecision) {
    return decisionAction === "approve" ? "approved" : "rejected";
  }
  if (verdict === "pass") return "clear";
  if (verdict === "fail") return "action_needed";
  return "in_review"; // needs_human_review
}
