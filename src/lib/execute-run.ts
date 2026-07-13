import { runReview } from "@/agent/run";
import type { ReviewerKind } from "@/agent/run";
import type { ReviewResult } from "@/schema";
import { reviewErrorMessage } from "@/lib/review-error";
import { claimRunForReview, completeRun, failRun } from "@/lib/store";

export type ExecuteRunResult =
  | {
      status: "done";
      result: ReviewResult;
      reviewer: ReviewerKind;
      documentId: string;
    }
  | { status: "reviewing"; error: string }
  | { status: "error"; error: string }
  | { status: "missing" }
  | { status: "corrupt" };

export async function executeRun(runId: string): Promise<ExecuteRunResult> {
  const claimed = await claimRunForReview(runId);
  if (claimed.status === "missing") return { status: "missing" };
  if (claimed.status === "corrupt") return { status: "corrupt" };
  if (claimed.status === "reviewing") {
    return { status: "reviewing", error: "Review is already in progress." };
  }
  if (claimed.status === "done") {
    return {
      status: "done",
      result: claimed.run.result as ReviewResult,
      reviewer: claimed.run.reviewer,
      documentId: claimed.run.documentId,
    };
  }

  try {
    const result = await runReview(
      claimed.version.content,
      claimed.rubric,
      claimed.run.reviewer,
      claimed.run.jurisdictions ?? ["US"],
    );
    await completeRun(runId, result);
    return {
      status: "done",
      result,
      reviewer: claimed.run.reviewer,
      documentId: claimed.run.documentId,
    };
  } catch (error) {
    const message = reviewErrorMessage(error);
    await failRun(runId, message);
    return { status: "error", error: message };
  }
}
