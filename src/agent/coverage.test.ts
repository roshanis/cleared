import { describe, expect, it } from "vitest";
import { runReview } from "./run";
import { defaultRubricDraft } from "@/lib/rubric";
import { reconcileReviewerOutput, assessModelCoverage } from "./model-reviewer";

const disclaimer = " Past performance is not indicative of future results. Investments may lose value.";

describe("review blind spots", () => {
  it.each([
    ["No investment is risk-free. Our product guarantees a 20% return.", "US", "C2"],
    ["According to our newsletter, markets are busy. Our fund beats Vanguard.", "US", "C3"],
    ["Our first green fund is certified. Our other fund is sustainable.", "EU", "C7"],
    ["Email your password to our support team.", "US", "C4"],
  ])("does not miss a later or paraphrased claim: %s", async (text, market, criterion) => {
    const result = await runReview(text + disclaimer, defaultRubricDraft, "heuristic", [market]);
    expect(result.verdict).not.toBe("pass");
    expect(result.findings.map(f => f.criterionId)).toContain(criterion);
  });

  it("routes unsupported checks to a human without inventing violations", async () => {
    const result = await runReview("Approval reference absent.", {
      criteria: [{ id: "C8", severity: "major", area: "content", description: "Require an approval reference." }],
      failOn: ["major"],
    }, "heuristic", ["US"]);
    expect(result.verdict).toBe("needs_human_review");
    expect(result.findings).toEqual([]);
    expect(result.coverage).toEqual([expect.objectContaining({ criterionId: "C8", status: "unsupported" })]);
    expect(result.jurisdictionVerdicts?.[0].verdict).toBe("needs_human_review");
  });

  it("does not claim support when a built-in rule description was changed", async () => {
    const result = await runReview(disclaimer, {
      criteria: [{ ...defaultRubricDraft.criteria[0], description: "Require an approval reference." }],
      failOn: ["major"],
    }, "heuristic");
    expect(result.coverage?.[0].status).toBe("unsupported");
    expect(result.verdict).toBe("needs_human_review");
  });

  it("records missing-language evidence as absence, not an offending quote", async () => {
    const result = await runReview("Subject: Hello\nBuy our fund.", defaultRubricDraft, "heuristic");
    expect(result.findings.find(f => f.criterionId === "C1")?.evidenceType).toBe("absence");
  });

  it("preserves contradictions as uncertainty, and exposes omitted checks", () => {
    const finding = { criterionId: "C2", confidence: "high" as const };
    expect(reconcileReviewerOutput([finding], ["C2"])).toEqual([
      expect.objectContaining({ criterionId: "C2", confidence: "low" }),
    ]);
    const coverage = assessModelCoverage(defaultRubricDraft.criteria.slice(0, 3), {
      findings: [finding], compliantCriteria: ["C2"], notApplicableCriteria: [],
    });
    expect(coverage.find(c => c.criterionId === "C2")?.status).toBe("uncertain");
    expect(coverage.find(c => c.criterionId === "C1")?.status).toBe("omitted");
  });
});
