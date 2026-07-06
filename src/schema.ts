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

export const verdicts = ["pass", "fail", "needs_human_review"] as const;

export const jurisdictionVerdictSchema = z.object({
  jurisdiction: z.string(),
  verdict: z.enum(verdicts),
});

export const judgeChallengeSchema = z.object({
  findingIndex: z.number().int().min(0),
  reason: z.string(),
});

export const judgeReportSchema = z.object({
  /** Whether the judge's recommended verdict matched the rule verdict. */
  verdictAgreed: z.boolean(),
  rationale: z.string(),
  challenges: z.array(judgeChallengeSchema),
});

export const reviewResultSchema = z.object({
  verdict: z.enum(verdicts),
  findings: z.array(findingSchema),
  summary: z
    .string()
    .describe("For the compliance officer: outcome first, then what needs their attention"),
  /** Per-market verdicts; absent on runs from before jurisdiction support. */
  jurisdictionVerdicts: z.array(jurisdictionVerdictSchema).optional(),
  /** Judge review of the review; absent on runs from before the judge. */
  judge: judgeReportSchema.optional(),
});

export type JudgeReport = z.infer<typeof judgeReportSchema>;

export type JurisdictionVerdict = z.infer<typeof jurisdictionVerdictSchema>;

export type Finding = z.infer<typeof findingSchema>;
export type ReviewResult = z.infer<typeof reviewResultSchema>;
