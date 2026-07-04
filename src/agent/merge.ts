import type { Finding } from "@/schema";
import { severityRank, type RubricCriterion } from "@/lib/rubric";

/** A finding as reported by a reviewer, before orchestration. */
export interface ReviewerFinding extends Finding {
  confidence?: "high" | "low";
}

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function quotesOverlap(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return na === nb;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * Orchestrator merge step: combine reviewer outputs, drop findings on unknown
 * criteria, coerce severity to the rubric's declared value (the rubric owns
 * severity, not the reviewer), dedupe same-criterion overlapping quotes, and
 * sort most severe first.
 */
export function mergeFindings(
  reviewerFindings: ReviewerFinding[][],
  criteria: RubricCriterion[],
): ReviewerFinding[] {
  const byId = new Map(criteria.map((c) => [c.id, c]));
  const merged: ReviewerFinding[] = [];

  for (const finding of reviewerFindings.flat()) {
    const criterion = byId.get(finding.criterionId);
    if (!criterion) continue;
    const normalized: ReviewerFinding = {
      ...finding,
      severity: criterion.severity,
      confidence: finding.confidence ?? "high",
    };
    const dupe = merged.find(
      (f) =>
        f.criterionId === normalized.criterionId &&
        quotesOverlap(f.quote, normalized.quote),
    );
    if (dupe) {
      // Two reviewers agreeing raises confidence.
      if (normalized.confidence === "high") dupe.confidence = "high";
      continue;
    }
    merged.push(normalized);
  }

  return merged.sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] ||
      a.criterionId.localeCompare(b.criterionId),
  );
}
