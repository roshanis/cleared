import { describe, expect, it } from "vitest";
import { grade, loadGoldenCases, type ExpectedReview } from "./grade";
import type { ReviewResult } from "../src/schema";

const finding = (criterionId: string): ReviewResult["findings"][number] => ({
  criterionId,
  severity: "major",
  quote: "quoted text",
  explanation: "why it violates",
  recommendation: "how to fix",
});

const result = (
  verdict: ReviewResult["verdict"],
  criteria: string[],
): ReviewResult => ({
  verdict,
  findings: criteria.map(finding),
  summary: "summary",
});

const expected = (
  verdict: ExpectedReview["verdict"],
  requiredCriteria: string[],
  allowExtraFindings = false,
): ExpectedReview => ({ verdict, requiredCriteria, allowExtraFindings });

describe("grade", () => {
  it("passes when verdict and criteria match exactly", () => {
    const report = grade(result("fail", ["C1", "C2"]), expected("fail", ["C1", "C2"]));
    expect(report.pass).toBe(true);
    expect(report.missingCriteria).toEqual([]);
    expect(report.extraCriteria).toEqual([]);
  });

  it("fails on verdict mismatch even when findings match", () => {
    const report = grade(result("pass", ["C1"]), expected("fail", ["C1"]));
    expect(report.pass).toBe(false);
    expect(report.verdictCorrect).toBe(false);
  });

  it("reports missing required criteria", () => {
    const report = grade(result("fail", ["C1"]), expected("fail", ["C1", "C4"]));
    expect(report.pass).toBe(false);
    expect(report.missingCriteria).toEqual(["C4"]);
  });

  it("reports extra findings as false positives by default", () => {
    const report = grade(result("fail", ["C1", "C3"]), expected("fail", ["C1"]));
    expect(report.pass).toBe(false);
    expect(report.extraCriteria).toEqual(["C3"]);
  });

  it("tolerates extra findings when allowExtraFindings is set", () => {
    const report = grade(result("fail", ["C1", "C3"]), expected("fail", ["C1"], true));
    expect(report.pass).toBe(true);
    expect(report.extraCriteria).toEqual([]);
  });
});

describe("golden set", () => {
  it("loads and validates every golden case", () => {
    const cases = loadGoldenCases();
    expect(cases.length).toBeGreaterThanOrEqual(3);
    for (const c of cases) {
      expect(c.input.length, c.id).toBeGreaterThan(0);
    }
  });

  it("grades a perfect answer as passing for every golden case", () => {
    for (const c of loadGoldenCases()) {
      const perfect = result(c.expected.verdict, c.expected.requiredCriteria);
      expect(grade(perfect, c.expected).pass, c.id).toBe(true);
    }
  });
});
