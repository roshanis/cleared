/**
 * Unit tests for jurisdiction-aware partitioning and per-market verdicts.
 * These tests drive the implementation of partitionFindingsByJurisdiction()
 * and the jurisdictions parameter on runReview().
 */
import { describe, expect, it } from "vitest";
import { defaultRubricDraft, SUPPORTED_JURISDICTIONS, sliceRubric } from "@/lib/rubric";
import { partitionFindingsByJurisdiction, runReview } from "@/agent/run";
import type { ReviewerFinding } from "@/agent/merge";
import type { RubricCriterion } from "@/lib/rubric";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCriterion(
  id: string,
  jurisdictions?: string[],
): RubricCriterion {
  return { id, severity: "major", area: "content", description: `${id} rule`, jurisdictions };
}

function makeFinding(criterionId: string): ReviewerFinding {
  return {
    criterionId,
    severity: "major",
    quote: "test quote",
    explanation: "explanation",
    recommendation: "fix it",
    confidence: "high",
  };
}

// ---------------------------------------------------------------------------
// SUPPORTED_JURISDICTIONS constant
// ---------------------------------------------------------------------------

describe("SUPPORTED_JURISDICTIONS", () => {
  it("exports the three supported markets", () => {
    expect(SUPPORTED_JURISDICTIONS).toEqual(["US", "UK", "EU"]);
  });
});

// ---------------------------------------------------------------------------
// sliceRubric
// ---------------------------------------------------------------------------

describe("sliceRubric", () => {
  const criteria = [
    makeCriterion("GLOBAL"), // no jurisdictions → global
    makeCriterion("UK_ONLY", ["UK"]),
    makeCriterion("EU_ONLY", ["EU"]),
    makeCriterion("US_UK", ["US", "UK"]),
  ];
  const rubric = { criteria, failOn: ["critical", "major"] as const };

  it("includes global criteria for any jurisdiction", () => {
    const sliced = sliceRubric(rubric, ["US"]);
    expect(sliced.criteria.map((c) => c.id)).toContain("GLOBAL");
  });

  it("includes criteria matching the selected jurisdictions", () => {
    const sliced = sliceRubric(rubric, ["UK"]);
    expect(sliced.criteria.map((c) => c.id)).toContain("UK_ONLY");
    expect(sliced.criteria.map((c) => c.id)).toContain("GLOBAL");
  });

  it("excludes criteria whose jurisdictions do not intersect the selection", () => {
    const sliced = sliceRubric(rubric, ["US"]);
    expect(sliced.criteria.map((c) => c.id)).not.toContain("UK_ONLY");
    expect(sliced.criteria.map((c) => c.id)).not.toContain("EU_ONLY");
  });

  it("includes multi-jurisdiction criteria when any selected market matches", () => {
    const sliced = sliceRubric(rubric, ["US"]);
    expect(sliced.criteria.map((c) => c.id)).toContain("US_UK");
  });

  it("preserves failOn unchanged", () => {
    const sliced = sliceRubric(rubric, ["US"]);
    expect(sliced.failOn).toEqual(rubric.failOn);
  });
});

// ---------------------------------------------------------------------------
// partitionFindingsByJurisdiction
// ---------------------------------------------------------------------------

describe("partitionFindingsByJurisdiction", () => {
  const globalCriterion = makeCriterion("GLOBAL"); // no jurisdictions → global
  const ukCriterion = makeCriterion("UK_ONLY", ["UK"]);
  const euCriterion = makeCriterion("EU_ONLY", ["EU"]);
  const criteria = [globalCriterion, ukCriterion, euCriterion];

  const globalFinding = makeFinding("GLOBAL");
  const ukFinding = makeFinding("UK_ONLY");
  const euFinding = makeFinding("EU_ONLY");

  it("global findings (no jurisdictions tag) appear in every selected market", () => {
    const result = partitionFindingsByJurisdiction(
      [globalFinding],
      criteria,
      ["US", "UK", "EU"],
    );
    expect(result.get("US")).toContainEqual(expect.objectContaining({ criterionId: "GLOBAL" }));
    expect(result.get("UK")).toContainEqual(expect.objectContaining({ criterionId: "GLOBAL" }));
    expect(result.get("EU")).toContainEqual(expect.objectContaining({ criterionId: "GLOBAL" }));
  });

  it("UK-tagged findings only appear in the UK bucket", () => {
    const result = partitionFindingsByJurisdiction(
      [ukFinding],
      criteria,
      ["US", "UK", "EU"],
    );
    expect(result.get("UK")).toContainEqual(expect.objectContaining({ criterionId: "UK_ONLY" }));
    expect(result.get("US")).toEqual([]);
    expect(result.get("EU")).toEqual([]);
  });

  it("EU-tagged findings only appear in the EU bucket", () => {
    const result = partitionFindingsByJurisdiction(
      [euFinding],
      criteria,
      ["US", "UK", "EU"],
    );
    expect(result.get("EU")).toContainEqual(expect.objectContaining({ criterionId: "EU_ONLY" }));
    expect(result.get("US")).toEqual([]);
    expect(result.get("UK")).toEqual([]);
  });

  it("produces empty arrays for jurisdictions with no matching findings", () => {
    const result = partitionFindingsByJurisdiction([], criteria, ["US", "UK"]);
    expect(result.get("US")).toEqual([]);
    expect(result.get("UK")).toEqual([]);
  });

  it("findings for unknown criterion IDs are excluded from all buckets", () => {
    const unknownFinding = makeFinding("UNKNOWN");
    const result = partitionFindingsByJurisdiction(
      [unknownFinding],
      criteria,
      ["US"],
    );
    expect(result.get("US")).toEqual([]);
  });

  it("covers all selected jurisdictions as keys even with no findings", () => {
    const result = partitionFindingsByJurisdiction([], criteria, ["US", "UK", "EU"]);
    expect([...result.keys()].sort()).toEqual(["EU", "UK", "US"]);
  });
});

// ---------------------------------------------------------------------------
// runReview with jurisdictions
// ---------------------------------------------------------------------------

describe("runReview — jurisdiction-aware verdicts", () => {
  // A document that is US-compliant but lacks UK capital-at-risk warning.
  // It has investment keywords (fund, portfolio) but no "capital at risk".
  const ukFailDoc = [
    "Subject: Grow Your Portfolio",
    "",
    "Invest in our Meridian Growth Fund for competitive returns.",
    "",
    "Past performance is not indicative of future results, and all investments may lose value.",
    "Fees are described in our fee schedule and Form ADV.",
  ].join("\n");

  it("produces jurisdictionVerdicts when jurisdictions are provided", async () => {
    const result = await runReview(
      ukFailDoc,
      defaultRubricDraft,
      "heuristic",
      ["US", "UK"],
    );
    expect(result.jurisdictionVerdicts).toBeDefined();
    expect(result.jurisdictionVerdicts).toHaveLength(2);
  });

  it("US passes and UK fails for a doc missing capital-at-risk", async () => {
    const result = await runReview(
      ukFailDoc,
      defaultRubricDraft,
      "heuristic",
      ["US", "UK"],
    );
    const usV = result.jurisdictionVerdicts?.find((v) => v.jurisdiction === "US");
    const ukV = result.jurisdictionVerdicts?.find((v) => v.jurisdiction === "UK");
    expect(usV?.verdict).toBe("pass");
    expect(ukV?.verdict).toBe("fail");
  });

  it("overall verdict = worst market (fail if any market fails)", async () => {
    const result = await runReview(
      ukFailDoc,
      defaultRubricDraft,
      "heuristic",
      ["US", "UK"],
    );
    expect(result.verdict).toBe("fail");
  });

  it("single-jurisdiction call still works (backward compat with default US)", async () => {
    const doc = "Buy our fund. Past performance is not indicative of future results, and all investments may lose value. Fees are in the fee schedule and Form ADV.";
    const result = await runReview(doc, defaultRubricDraft, "heuristic");
    // No jurisdictionVerdicts for a single-market run (or length 1)
    // verdict should be deterministic
    expect(result.verdict).toBeDefined();
  });

  it("clean multimarket doc passes all three markets", async () => {
    const cleanDoc = [
      "Subject: Portfolio Review",
      "",
      "Your capital is at risk. Invest in our growth fund.",
      "",
      "Past performance is not indicative of future results, and all investments may lose value.",
      "Fees are described in our fee schedule and Form ADV.",
    ].join("\n");

    const result = await runReview(
      cleanDoc,
      defaultRubricDraft,
      "heuristic",
      ["US", "UK", "EU"],
    );
    expect(result.verdict).toBe("pass");
    result.jurisdictionVerdicts?.forEach(({ verdict }) => {
      expect(verdict).toBe("pass");
    });
  });
});
