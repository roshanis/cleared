import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { severityOrder } from "@/lib/rubric";
import type { ReviewerFinding } from "./merge";

const reviewerOutputSchema = z.object({
  findings: z.array(
    z.object({
      criterionId: z.string(),
      severity: z.enum(severityOrder),
      quote: z
        .string()
        .describe(
          "Exact verbatim text from the document; for missing-language criteria, quote the closest relevant line",
        ),
      explanation: z.string(),
      recommendation: z.string(),
      confidence: z
        .enum(["high", "low"])
        .describe("Use low when genuinely unsure this violates the criterion"),
    }),
  ),
});

export interface ModelReviewOptions {
  document: string;
  /** Reviewer prompt + rendered rubric slice for this reviewer's area. */
  instructions: string;
  /** OpenAI model id, e.g. "gpt-5.4-mini". */
  modelId: string;
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
      "Review the following document against your assigned rubric criteria.",
      "Report every candidate violation with an exact quote.",
      "",
      "<document>",
      opts.document,
      "</document>",
    ].join("\n"),
  });
  return object.findings;
}
