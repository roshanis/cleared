import { activeReviewer, type ReviewerKind } from "@/agent/run";
import { publicDemoEnabled } from "@/lib/demo";
import { dailyModelCap, modelBudgetStatus } from "@/lib/model-budget";
import { getDb } from "@/lib/store";

export type ReviewerChoice =
  | { ok: true; reviewer: ReviewerKind; note: string | null }
  | { ok: false; retryAfterSeconds: number };

export async function chooseReviewer(): Promise<ReviewerChoice> {
  const reviewer = activeReviewer();
  if (reviewer !== "model") return { ok: true, reviewer, note: null };
  const db = await getDb();
  const budget = modelBudgetStatus({
    runs: db.runs,
    nowIso: new Date().toISOString(),
    cap: dailyModelCap(),
  });
  if (budget.allowed) return { ok: true, reviewer, note: null };
  if (publicDemoEnabled()) {
    return {
      ok: true,
      reviewer: "heuristic",
      note: "Today's live-review budget is used up, so this public demo submission ran on the deterministic reviewer.",
    };
  }
  return { ok: false, retryAfterSeconds: budget.retryAfterSeconds };
}
