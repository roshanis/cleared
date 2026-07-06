import { describe, expect, it } from "vitest";
import { sampleDocument } from "@/lib/copy";
import { applyFixes } from "@/lib/patch";
import { defaultRubricDraft } from "@/lib/rubric";
import { heuristicFixes } from "./fixer";
import { runReview } from "./run";

describe("heuristicFixes", () => {
  it("produces a fix for every finding it knows how to fix", async () => {
    const result = await runReview(
      sampleDocument.content,
      defaultRubricDraft,
      "heuristic",
    );
    const fixes = heuristicFixes(result.findings);
    expect(fixes.length).toBe(result.findings.length);
  });

  it("THE PROOF LOOP: sample fails → demo fixes applied → resubmit passes", async () => {
    const before = await runReview(
      sampleDocument.content,
      defaultRubricDraft,
      "heuristic",
    );
    expect(before.verdict).toBe("fail");

    const fixes = heuristicFixes(before.findings);
    const { patched, unlocated } = applyFixes(sampleDocument.content, fixes);
    expect(unlocated).toHaveLength(0);

    const after = await runReview(patched, defaultRubricDraft, "heuristic");
    expect(after.verdict).toBe("pass");
    expect(after.findings).toHaveLength(0);
  });

  it("the fixed document also passes UK rules when the warning is included", async () => {
    const before = await runReview(
      sampleDocument.content,
      defaultRubricDraft,
      "heuristic",
      ["US", "UK"],
    );
    const fixes = heuristicFixes(before.findings);
    const { patched } = applyFixes(sampleDocument.content, fixes);
    const after = await runReview(patched, defaultRubricDraft, "heuristic", [
      "US",
      "UK",
    ]);
    expect(after.verdict).toBe("pass");
  });
});
