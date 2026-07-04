import { describe, expect, it } from "vitest";
import { decideVerdict } from "./verdict";
import type { ReviewerFinding } from "./merge";

const finding = (
  severity: ReviewerFinding["severity"],
  confidence: ReviewerFinding["confidence"] = "high",
): ReviewerFinding => ({
  criterionId: "CX",
  severity,
  quote: "q",
  explanation: "e",
  recommendation: "r",
  confidence,
});

const rubric = { failOn: ["critical", "major"] as ("critical" | "major" | "minor")[] };

describe("decideVerdict", () => {
  it("passes with no findings", () => {
    expect(decideVerdict([], rubric)).toBe("pass");
  });

  it("fails on a high-confidence finding at a fail-level severity", () => {
    expect(decideVerdict([finding("critical")], rubric)).toBe("fail");
    expect(decideVerdict([finding("major")], rubric)).toBe("fail");
  });

  it("routes minor-only findings to a human", () => {
    expect(decideVerdict([finding("minor")], rubric)).toBe("needs_human_review");
  });

  it("routes low-confidence fail-level findings to a human instead of failing", () => {
    expect(decideVerdict([finding("critical", "low")], rubric)).toBe(
      "needs_human_review",
    );
  });
});
