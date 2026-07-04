import { describe, expect, it } from "vitest";
import { runReview } from "@/agent/run";
import { defaultRubricDraft } from "@/lib/rubric";
import { grade, loadGoldenCases } from "./grade";

// End-to-end eval: golden documents through the full pipeline (deterministic
// heuristic reviewers) and graded with the same harness the rubric publish
// gate uses. This is the regression gate for prompt/rubric/pipeline changes.
describe("golden set through the review pipeline", () => {
  for (const goldenCase of loadGoldenCases()) {
    it(`grades ${goldenCase.id} as expected`, async () => {
      const result = await runReview(goldenCase.input, defaultRubricDraft, "heuristic");
      const report = grade(result, goldenCase.expected);
      expect(report, JSON.stringify({ result, report }, null, 2)).toMatchObject({
        pass: true,
      });
    });
  }
});
