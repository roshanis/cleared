import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { severityOrder, type RubricCriterion } from "@/lib/rubric";
import type { Coverage } from "@/schema";
import type { ReviewerFinding } from "./merge";

const reviewerOutputSchema = z.object({
  compliantCriteria: z
    .array(z.string())
    .describe(
      "Criterion IDs the document COMPLIES with. Record every satisfied criterion here — never as a finding.",
    ),
  notApplicableCriteria: z.array(z.string()).describe("Assigned criterion IDs whose trigger is absent. Keep these separate from checks satisfied by the document."),
  findings: z
    .array(
      z.object({
        criterionId: z.string(),
        severity: z.enum(severityOrder),
        quote: z
          .string()
          .describe(
            "Exact verbatim text from the document; for missing-language criteria, quote the closest relevant line",
          ),
        explanation: z
          .string()
          .describe("Why this text VIOLATES the criterion"),
        recommendation: z.string(),
        evidenceType: z.enum(["quote", "absence"]).describe("Use absence for required language missing from the document; its quote is context, not offending text."),
        confidence: z
          .enum(["high", "low"])
          .describe("Use low when genuinely unsure this violates the criterion"),
      }),
    )
    .describe(
      "Violations only. A criterion the document satisfies must never appear here.",
    ),
});

export interface ModelReviewOptions {
  document: string;
  /** Reviewer prompt + rendered rubric slice for this reviewer's area. */
  instructions: string;
  /** OpenAI model id, e.g. "gpt-5.4-mini". */
  modelId: string;
  criteria: RubricCriterion[];
}

/**
 * Preserve contradictory evidence for human review rather than silently
 * preferring a compliant assertion. Coverage records the disagreement too.
 */
export function reconcileReviewerOutput<T extends { criterionId: string }>(
  findings: T[],
  compliantCriteria: string[],
): (T & { confidence?: "high" | "low" })[] {
  return findings.map(f => compliantCriteria.includes(f.criterionId)
    ? { ...f, confidence: "low" as const } : f);
}

export function assessModelCoverage(
  criteria: RubricCriterion[],
  output: { findings: { criterionId: string; confidence?: "high" | "low" }[]; compliantCriteria: string[]; notApplicableCriteria: string[] },
): Coverage[] {
  return criteria.map(({ id }) => {
    const findings = output.findings.filter(f => f.criterionId === id);
    const checked = output.compliantCriteria.includes(id);
    const na = output.notApplicableCriteria.includes(id);
    const contradiction = Number(findings.length > 0) + Number(checked) + Number(na) > 1;
    const status: Coverage["status"] = contradiction || findings.some(f => f.confidence === "low")
      ? "uncertain" : findings.length ? "finding" : checked ? "checked" : na ? "not_applicable" : "omitted";
    const details: Record<Coverage["status"], string> = {
      uncertain: contradiction ? "The reviewer returned conflicting assessments. Human judgment is required." : "The reviewer was uncertain about this finding.",
      finding: "The reviewer reported an issue. Inspect the evidence before deciding.",
      checked: "The reviewer reported no issues under this rule. External facts were not independently verified.",
      not_applicable: "The reviewer reported that this rule's trigger was absent.",
      omitted: "The reviewer did not account for this assigned rule. This is not a completed check.",
      unsupported: "This rule was not evaluated.",
    };
    return { criterionId: id, status, detail: details[status] };
  });
}

/** One reviewer subagent call via the Vercel AI SDK. */
export async function modelReview(
  opts: ModelReviewOptions,
): Promise<{ findings: ReviewerFinding[]; coverage: Coverage[] }> {
  const { object } = await generateObject({
    model: openai(opts.modelId),
    schema: reviewerOutputSchema,
    system: opts.instructions,
    prompt: [
      "Review the document against your assigned rubric criteria, one criterion at a time:",
      "1. Decide whether the criterion applies to this document's content at all.",
      "2. If it requires specific language, check whether that language is present anywhere in the document.",
      "3. Report a finding ONLY for a violation: required language absent while its trigger content is present, or prohibited language present.",
      "4. Account for EVERY assigned criterion: findings for violations, compliantCriteria for satisfied checks, notApplicableCriteria only when its trigger is absent. Never omit a criterion or list it in conflicting categories.",
      "5. Inspect every relevant claim, including later repetitions. A disclaimer or supporting source for one claim does not excuse another. Citation text is not independent verification of its truth.",
      "",
      "<document>",
      opts.document,
      "</document>",
    ].join("\n"),
  });
  const assigned = new Set(opts.criteria.map(c => c.id));
  return {
    findings: reconcileReviewerOutput(object.findings, [...object.compliantCriteria, ...object.notApplicableCriteria]).filter(f => assigned.has(f.criterionId)),
    coverage: assessModelCoverage(opts.criteria, object),
  };
}
