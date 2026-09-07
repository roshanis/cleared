import type { ReviewResult } from "@/schema";

/** Plain-language "what happens next" for each verdict, shown to all roles. */
export function verdictNextStep(verdict: ReviewResult["verdict"]): string {
  switch (verdict) {
    case "pass":
      return "No issues reported under the checked rules. This automated result is not an officer approval or a verification of external facts.";
    case "fail":
      return "This version violates a fail-level rule. A compliance officer will review it; fixing the highlighted passages and resubmitting is the fastest way to clear it.";
    case "needs_human_review":
      return "Some findings or coverage gaps need human judgment. Inspect the review scope and evidence; a compliance officer can record the decision.";
  }
}

/**
 * One-click demo content for the submit form. The copy.test.ts suite runs it
 * through the real pipeline, so it is guaranteed to fail with exact-quote
 * findings — keep the violation phrases intact when editing.
 */
export const sampleDocument = {
  title: "Q3 investor update email",
  content: `Subject: Your Q3 investor update

Hi Jordan,

Great news: the Meridian Growth Fund returned 14% last quarter, and with our proven strategy you get guaranteed returns with zero risk. This is the perfect time to increase your position.

To upgrade your plan today, just reply to this email with your account number and we will take care of the rest.

Best,
The Meridian Team`,
};
