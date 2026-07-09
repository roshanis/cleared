import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { severityOrder } from "@/lib/rubric";
import type { ReviewerFinding } from "./merge";

const reviewerOutputSchema = z.object({
  compliantCriteria: z
    .array(z.string())
    .describe(
      "Criterion IDs the document COMPLIES with. Record every satisfied criterion here — never as a finding.",
    ),
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
}

/**
 * Resolve reviewer self-contradictions deterministically: a finding whose
 * criterion the reviewer itself listed as compliant is noise, not evidence —
 * the compliantCriteria outlet exists precisely so "checked, fine" notes
 * never masquerade as violations. The judge remains the backstop for false
 * positives that survive this.
 */
export function reconcileReviewerOutput<T extends { criterionId: string }>(
  findings: T[],
  compliantCriteria: string[],
): T[] {
  return findings.filter((f) => !compliantCriteria.includes(f.criterionId));
}

/** One reviewer subagent call via the Vercel AI SDK. */
export async function modelReview(
  opts: ModelReviewOptions,
): Promise<ReviewerFinding[]> {
  const { object } = await generateObject({
    model: openai(opts.modelId),
    schema: reviewerOutputSchema,
    system: opts.instructions,
    prompt: [
      "Review the document against your assigned rubric criteria, one criterion at a time:",
      "1. Decide whether the criterion applies to this document's content at all.",
      "2. If it requires specific language, check whether that language is present anywhere in the document.",
      "3. Report a finding ONLY for a violation: required language absent while its trigger content is present, or prohibited language present.",
      "4. If the document satisfies the criterion (or it does not apply), list its ID in compliantCriteria instead.",
      "",
      "<document>",
      opts.document,
      "</document>",
    ].join("\n"),
  });
  return reconcileReviewerOutput(object.findings, object.compliantCriteria);
}
