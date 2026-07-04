import { z } from "zod";

export const severityOrder = ["critical", "major", "minor"] as const;
export type Severity = (typeof severityOrder)[number];

export const severityRank: Record<Severity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
};

export const criterionAreas = ["content", "risk"] as const;
export type CriterionArea = (typeof criterionAreas)[number];

export const rubricCriterionSchema = z.object({
  id: z.string().min(1).max(8),
  severity: z.enum(severityOrder),
  area: z.enum(criterionAreas),
  description: z.string().min(1),
});

export type RubricCriterion = z.infer<typeof rubricCriterionSchema>;

export const rubricDraftSchema = z.object({
  criteria: z.array(rubricCriterionSchema).min(1),
  failOn: z.array(z.enum(severityOrder)).min(1),
});

export type RubricDraft = z.infer<typeof rubricDraftSchema>;

export interface GoldenGateCase {
  id: string;
  pass: boolean;
  verdict: string;
  expectedVerdict: string;
  missingCriteria: string[];
  extraCriteria: string[];
}

export interface GoldenGateReport {
  ranAt: string;
  reviewer: "model" | "heuristic";
  pass: boolean;
  cases: GoldenGateCase[];
}

export interface RubricVersion extends RubricDraft {
  version: number;
  author: string;
  createdAt: string;
  publishedAt: string | null;
  goldenGate: GoldenGateReport | null;
}

/** Mirrors src/prompts/rubric.md — the seed for rubric version 1. */
export const defaultRubricDraft: RubricDraft = {
  criteria: [
    {
      id: "C1",
      severity: "major",
      area: "content",
      description:
        'The document contains a risk disclaimer equivalent to "past performance is not indicative of future results" AND states that investments may lose value. A C1 finding means the disclaimer is missing or materially weakened.',
    },
    {
      id: "C2",
      severity: "critical",
      area: "content",
      description:
        'The document makes no guarantee of investment performance or returns. Triggers include "guaranteed", "risk-free", "can\'t lose", or promising a specific future return rate.',
    },
    {
      id: "C3",
      severity: "major",
      area: "content",
      description:
        "The document makes no comparative claim naming a competitor unless the claim cites substantiation (a dated study or published benchmark).",
    },
    {
      id: "C4",
      severity: "critical",
      area: "risk",
      description:
        "The document does not request or expose sensitive personal data (SSN, full account numbers, passwords) through an unsecured channel such as email reply.",
    },
    {
      id: "C5",
      severity: "minor",
      area: "risk",
      description:
        "Any statement about fees or costs refers the reader to the full fee schedule (or Form ADV). C5 applies only when fees are mentioned.",
    },
  ],
  failOn: ["critical", "major"],
};

/** Render the structured rubric to markdown for prompt injection. */
export function renderRubricMarkdown(
  rubric: RubricDraft,
  area?: CriterionArea,
): string {
  const criteria = area
    ? rubric.criteria.filter((c) => c.area === area)
    : rubric.criteria;
  const rows = criteria
    .map((c) => `| ${c.id} | ${c.severity} | ${c.description} |`)
    .join("\n");
  return [
    "# Compliance Rubric",
    "",
    "## Criteria",
    "",
    "| ID | Severity | Criterion |",
    "|----|----------|-----------|",
    rows,
    "",
    "## Verdict rules",
    "",
    `- \`fail\` — at least one finding at severity: ${rubric.failOn.join(" or ")}.`,
    "- `needs_human_review` — findings below the fail threshold only, or genuine reviewer uncertainty.",
    "- `pass` — no findings.",
    "",
  ].join("\n");
}
