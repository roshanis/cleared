import { z } from "zod";

export const severities = ["critical", "major", "minor"] as const;

export const findingSchema = z.object({
  criterionId: z
    .string()
    .describe("Rubric criterion this finding maps to, e.g. C2"),
  severity: z.enum(severities),
  quote: z
    .string()
    .describe("Exact verbatim text from the document that triggered the finding"),
  explanation: z.string().describe("One or two sentences on why this violates the criterion"),
  recommendation: z.string().describe("Concrete fix the author can apply"),
});

export const reviewResultSchema = z.object({
  verdict: z.enum(["pass", "fail", "needs_human_review"]),
  findings: z.array(findingSchema),
  summary: z
    .string()
    .describe("For the compliance officer: outcome first, then what needs their attention"),
});

export type Finding = z.infer<typeof findingSchema>;
export type ReviewResult = z.infer<typeof reviewResultSchema>;
