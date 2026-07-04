import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { ReviewResult } from "../src/schema";

export const expectedReviewSchema = z.object({
  verdict: z.enum(["pass", "fail", "needs_human_review"]),
  requiredCriteria: z.array(z.string()),
  allowExtraFindings: z.boolean().optional().default(false),
});

export type ExpectedReview = z.infer<typeof expectedReviewSchema>;

export interface GoldenCase {
  id: string;
  input: string;
  expected: ExpectedReview;
}

export interface GradeReport {
  pass: boolean;
  verdictCorrect: boolean;
  missingCriteria: string[];
  extraCriteria: string[];
}

export function grade(actual: ReviewResult, expected: ExpectedReview): GradeReport {
  const found = new Set(actual.findings.map((f) => f.criterionId));
  const required = new Set(expected.requiredCriteria);
  const missingCriteria = [...required].filter((id) => !found.has(id));
  const extraCriteria = expected.allowExtraFindings
    ? []
    : [...found].filter((id) => !required.has(id));
  const verdictCorrect = actual.verdict === expected.verdict;
  return {
    pass: verdictCorrect && missingCriteria.length === 0 && extraCriteria.length === 0,
    verdictCorrect,
    missingCriteria,
    extraCriteria,
  };
}

export function loadGoldenCases(
  dir: string = path.join(process.cwd(), "evals", "golden"),
): GoldenCase[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => ({
      id: entry.name,
      input: readFileSync(path.join(dir, entry.name, "input.md"), "utf8"),
      expected: expectedReviewSchema.parse(
        JSON.parse(readFileSync(path.join(dir, entry.name, "expected.json"), "utf8")),
      ),
    }));
}
