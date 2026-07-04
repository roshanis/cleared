import { describe, expect, it } from "vitest";
import { defaultRubricDraft } from "@/lib/rubric";
import { mergeFindings, type ReviewerFinding } from "./merge";

const finding = (
  criterionId: string,
  quote: string,
  overrides: Partial<ReviewerFinding> = {},
): ReviewerFinding => ({
  criterionId,
  severity: "minor",
  quote,
  explanation: "e",
  recommendation: "r",
  ...overrides,
});

const criteria = defaultRubricDraft.criteria;

describe("mergeFindings", () => {
  it("coerces severity to the rubric's declared value", () => {
    const merged = mergeFindings([[finding("C2", "guaranteed returns")]], criteria);
    expect(merged[0].severity).toBe("critical");
  });

  it("drops findings on unknown criteria", () => {
    const merged = mergeFindings([[finding("C9", "whatever")]], criteria);
    expect(merged).toEqual([]);
  });

  it("dedupes same criterion with overlapping quotes across reviewers", () => {
    const merged = mergeFindings(
      [
        [finding("C2", "Lock in guaranteed 12% returns before Friday")],
        [finding("C2", "guaranteed 12% returns")],
      ],
      criteria,
    );
    expect(merged).toHaveLength(1);
  });

  it("keeps same criterion with distinct quotes as separate findings", () => {
    const merged = mergeFindings(
      [[finding("C2", "guaranteed 12% returns"), finding("C2", "as close to risk-free as investing gets")]],
      criteria,
    );
    expect(merged).toHaveLength(2);
  });

  it("sorts most severe first", () => {
    const merged = mergeFindings(
      [[finding("C5", "our fees"), finding("C4", "reply with your account number")]],
      criteria,
    );
    expect(merged.map((f) => f.criterionId)).toEqual(["C4", "C5"]);
  });

  it("upgrades confidence when a second reviewer agrees", () => {
    const merged = mergeFindings(
      [
        [finding("C3", "outperformed Vanguard", { confidence: "low" })],
        [finding("C3", "outperformed Vanguard", { confidence: "high" })],
      ],
      criteria,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].confidence).toBe("high");
  });
});
