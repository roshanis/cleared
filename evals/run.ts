// Eval CLI: golden set through the full pipeline, graded. Uses the model
// reviewers when ANTHROPIC_API_KEY is set, the deterministic heuristic
// otherwise. Exits non-zero on any failure so it can gate CI.
import { activeReviewer, runReview } from "../src/agent/run";
import { defaultRubricDraft } from "../src/lib/rubric";
import { grade, loadGoldenCases } from "./grade";

const reviewer = activeReviewer();
console.log(`reviewer: ${reviewer}\n`);

let failures = 0;
for (const goldenCase of loadGoldenCases()) {
  const result = await runReview(goldenCase.input, defaultRubricDraft, reviewer);
  const report = grade(result, goldenCase.expected);
  const status = report.pass ? "PASS" : "FAIL";
  console.log(
    `${status}  ${goldenCase.id}  verdict=${result.verdict} (expected ${goldenCase.expected.verdict})` +
      (report.missingCriteria.length
        ? `  missing=${report.missingCriteria.join(",")}`
        : "") +
      (report.extraCriteria.length
        ? `  extra=${report.extraCriteria.join(",")}`
        : ""),
  );
  if (!report.pass) failures += 1;
}

if (failures > 0) {
  console.error(`\n${failures} golden case(s) failed`);
  process.exit(1);
}
console.log("\nall golden cases passed");
