import { describe, expect, it } from "vitest";
import { reconcileReviewerOutput } from "./model-reviewer";

const finding = (criterionId: string) => ({
  criterionId,
  quote: "q",
  explanation: "e",
});

describe("reconcileReviewerOutput", () => {
  it("retains a contradictory finding at low confidence", () => {
    const kept = reconcileReviewerOutput(
      [finding("C2"), finding("C3")],
      ["C3", "C5"],
    );
    expect(kept.map((f) => f.criterionId)).toEqual(["C2", "C3"]);
    expect(kept[1].confidence).toBe("low");
  });

  it("keeps all findings when there is no contradiction", () => {
    const kept = reconcileReviewerOutput([finding("C2")], ["C1", "C5"]);
    expect(kept).toHaveLength(1);
  });

  it("handles an empty compliant list", () => {
    expect(reconcileReviewerOutput([finding("C4")], [])).toHaveLength(1);
  });
});
