import { describe, expect, it } from "vitest";
import { runReview } from "@/agent/run";
import { defaultRubricDraft } from "./rubric";
import { sampleDocument, verdictNextStep } from "./copy";

describe("verdictNextStep", () => {
  it("gives a distinct plain-language next step for every verdict", () => {
    const steps = (["pass", "fail", "needs_human_review"] as const).map(
      verdictNextStep,
    );
    for (const step of steps) expect(step.length).toBeGreaterThan(20);
    expect(new Set(steps).size).toBe(3);
  });

  it("tells authors a human will look at flagged documents", () => {
    expect(verdictNextStep("fail")).toMatch(/compliance officer/i);
    expect(verdictNextStep("needs_human_review")).toMatch(/compliance officer/i);
  });
});

describe("sampleDocument", () => {
  it("reliably fails the demo review with exact-quote findings", async () => {
    const result = await runReview(
      sampleDocument.content,
      defaultRubricDraft,
      "heuristic",
    );
    expect(result.verdict).toBe("fail");
    const criteria = result.findings.map((f) => f.criterionId);
    expect(criteria).toContain("C2");
    expect(criteria).toContain("C4");
    // Every quote must appear verbatim so the inline highlights render.
    for (const finding of result.findings) {
      expect(sampleDocument.content).toContain(finding.quote);
    }
  });
});
