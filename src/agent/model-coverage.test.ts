import { describe, expect, it, vi } from "vitest";
import { runReview } from "./run";
import { defaultRubricDraft } from "@/lib/rubric";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("ai", () => ({ generateObject: generate }));
vi.mock("@ai-sdk/openai", () => ({ openai: () => "mock-model" }));

describe("model coverage safety through the complete pipeline", () => {
  it("does not pass an omitted assigned criterion even if the judge recommends pass", async () => {
    generate.mockResolvedValueOnce({ object: { findings: [], compliantCriteria: [], notApplicableCriteria: [] } })
      .mockResolvedValueOnce({ object: { recommendedVerdict: "pass", rationale: "No findings to challenge.", challenges: [] } });
    const result = await runReview("A factual update.", { criteria: [defaultRubricDraft.criteria[0]], failOn: ["major"] }, "model", ["US"]);
    expect(result.verdict).toBe("needs_human_review");
    expect(result.jurisdictionVerdicts?.[0].verdict).toBe("needs_human_review");
    expect(result.coverage?.[0].status).toBe("omitted");
    expect(result.findings).toEqual([]);
    expect(generate).toHaveBeenCalledTimes(2);
    generate.mockReset();
  });

  it("retains contradictory evidence instead of silently clearing the document", async () => {
    generate.mockResolvedValueOnce({ object: { findings: [{ criterionId: "C2", severity: "critical", quote: "Guaranteed returns.", explanation: "Guarantee", recommendation: "Remove", evidenceType: "quote", confidence: "high" }], compliantCriteria: ["C2"], notApplicableCriteria: [] } })
      .mockResolvedValueOnce({ object: { recommendedVerdict: "pass", rationale: "No issue.", challenges: [] } });
    const result = await runReview("Guaranteed returns.", { criteria: [defaultRubricDraft.criteria.find(c => c.id === "C2")!], failOn: ["critical"] }, "model", ["US"]);
    expect(result.verdict).toBe("needs_human_review");
    expect(result.findings).toHaveLength(1);
    expect(result.coverage?.[0].status).toBe("uncertain");
    generate.mockReset();
  });
});
