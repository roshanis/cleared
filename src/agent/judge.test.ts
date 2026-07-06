import { describe, expect, it } from "vitest";
import { defaultRubricDraft } from "@/lib/rubric";
import { applyJudgeGating, heuristicJudge, type JudgeOutput } from "./judge";
import { runReview } from "./run";
import type { ReviewerFinding } from "./merge";

function finding(
  criterionId: string,
  severity: "critical" | "major" | "minor" = "critical",
  quote = "guaranteed returns",
): ReviewerFinding {
  return {
    criterionId,
    severity,
    quote,
    explanation: "e",
    recommendation: "r",
    confidence: "high",
  };
}

const endorseAll = (verdict: JudgeOutput["recommendedVerdict"]): JudgeOutput => ({
  recommendedVerdict: verdict,
  rationale: "The findings are accurate and the verdict follows the rubric.",
  challenges: [],
});

describe("applyJudgeGating — the deterministic gating matrix", () => {
  const rubric = defaultRubricDraft;

  it("endorse-all + agreement: verdict stands, rationale becomes the summary", () => {
    const findings = [finding("C2")];
    const gated = applyJudgeGating({
      findings,
      judge: endorseAll("fail"),
      rubric,
      jurisdictions: ["US"],
    });
    expect(gated.verdict).toBe("fail");
    expect(gated.summaryOverride).toContain("accurate");
    expect(gated.judge.verdictAgreed).toBe(true);
  });

  it("a challenged fail-level finding demotes to low confidence and routes to human review", () => {
    const findings = [finding("C2")];
    const gated = applyJudgeGating({
      findings,
      judge: {
        recommendedVerdict: "needs_human_review",
        rationale: "The quote reads as historical description, not a promise.",
        challenges: [{ findingIndex: 0, reason: "Possible false positive." }],
      },
      rubric,
      jurisdictions: ["US"],
    });
    expect(gated.findings[0].confidence).toBe("low");
    expect(gated.verdict).toBe("needs_human_review");
    expect(gated.judge.challenges).toHaveLength(1);
  });

  it("judge can never relax fail to pass: disagreement escalates to human review", () => {
    const findings = [finding("C2")];
    const gated = applyJudgeGating({
      findings,
      judge: endorseAll("pass"), // judge says pass, rules say fail
      rubric,
      jurisdictions: ["US"],
    });
    expect(gated.verdict).toBe("needs_human_review");
    expect(gated.judge.verdictAgreed).toBe(false);
  });

  it("judge can never invent a fail: recommending fail on a clean doc escalates, not fails", () => {
    const gated = applyJudgeGating({
      findings: [],
      judge: endorseAll("fail"), // judge says fail, rules say pass
      rubric,
      jurisdictions: ["US"],
    });
    expect(gated.verdict).toBe("needs_human_review");
    expect(gated.verdict).not.toBe("fail");
  });

  it("challenges with out-of-range finding indexes are ignored", () => {
    const findings = [finding("C2")];
    const gated = applyJudgeGating({
      findings,
      judge: {
        recommendedVerdict: "fail",
        rationale: "r",
        challenges: [{ findingIndex: 5, reason: "bogus" }],
      },
      rubric,
      jurisdictions: ["US"],
    });
    expect(gated.findings[0].confidence).toBe("high");
    expect(gated.judge.challenges).toHaveLength(0);
  });

  it("per-market verdicts reflect demotions", () => {
    // C6 is UK-tagged and fail-level (major); challenging it moves UK to
    // needs_human_review while US stays pass.
    const findings = [finding("C6", "major", "Subject: promo")];
    const gated = applyJudgeGating({
      findings,
      judge: {
        recommendedVerdict: "needs_human_review",
        rationale: "r",
        challenges: [{ findingIndex: 0, reason: "uncertain" }],
      },
      rubric,
      jurisdictions: ["US", "UK"],
    });
    const uk = gated.jurisdictionVerdicts.find((v) => v.jurisdiction === "UK");
    const us = gated.jurisdictionVerdicts.find((v) => v.jurisdiction === "US");
    expect(uk?.verdict).toBe("needs_human_review");
    expect(us?.verdict).toBe("pass");
  });
});

describe("heuristicJudge — deterministic quote verifier", () => {
  const document =
    "Subject: Big news\n\nWe promise guaranteed returns with zero risk.";

  it("endorses findings whose quotes appear in the document", () => {
    const judge = heuristicJudge(document, [
      finding("C2", "critical", "guaranteed returns with zero risk"),
    ]);
    expect(judge.challenges).toHaveLength(0);
  });

  it("tolerates re-wrapped whitespace in quotes", () => {
    const judge = heuristicJudge(document, [
      finding("C2", "critical", "guaranteed   returns\nwith zero risk"),
    ]);
    expect(judge.challenges).toHaveLength(0);
  });

  it("challenges fabricated quotes", () => {
    const judge = heuristicJudge(document, [
      finding("C2", "critical", "we will double your money overnight"),
    ]);
    expect(judge.challenges).toHaveLength(1);
    expect(judge.challenges[0].findingIndex).toBe(0);
  });
});

describe("runReview with the judge in the loop (demo mode)", () => {
  it("an honest heuristic review is endorsed and keeps its verdict", async () => {
    const doc =
      "Subject: Pitch\n\nWe promise guaranteed returns with zero risk. Reply to this email with your account number.";
    const result = await runReview(doc, defaultRubricDraft, "heuristic");
    expect(result.verdict).toBe("fail");
    expect(result.judge).toBeDefined();
    expect(result.judge?.verdictAgreed).toBe(true);
    expect(result.judge?.challenges).toHaveLength(0);
  });
});
