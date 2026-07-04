import { beforeEach, describe, expect, it } from "vitest";
import {
  addDecision,
  createSubmission,
  getDb,
  publishRubric,
  publishedRubric,
  resetStoreForTests,
  reviewQueue,
  saveRubricDraft,
  setGoldenGate,
  updateRun,
} from "./store";
import { defaultRubricDraft } from "./rubric";
import type { ReviewResult } from "@/schema";

const failResult: ReviewResult = {
  verdict: "fail",
  findings: [
    {
      criterionId: "C2",
      severity: "critical",
      quote: "guaranteed returns",
      explanation: "e",
      recommendation: "r",
    },
  ],
  summary: "s",
};

beforeEach(async () => {
  await resetStoreForTests(false);
});

describe("store", () => {
  it("seeds a published rubric on reset", async () => {
    const db = await getDb();
    expect(publishedRubric(db).version).toBe(1);
    expect(db.documents).toHaveLength(0);
  });

  it("submission → completed run → queue → decision lifecycle", async () => {
    const { document, run } = await createSubmission({
      title: "Test doc",
      content: "Some content",
      author: "Maya Chen",
      reviewer: "heuristic",
    });

    await updateRun(run.id, {
      status: "done",
      result: failResult,
      finishedAt: new Date().toISOString(),
    });

    let db = await getDb();
    let queue = reviewQueue(db);
    expect(queue).toHaveLength(1);
    expect(queue[0].document.id).toBe(document.id);

    const decision = await addDecision({
      runId: run.id,
      officer: "Devon Park",
      action: "reject",
      note: "Agreed with the agent.",
      overrides: [{ findingIndex: 0, action: "accept" }],
    });
    expect(decision?.documentId).toBe(document.id);

    db = await getDb();
    expect(reviewQueue(db)).toHaveLength(0);
  });

  it("resubmission adds a version to the same document", async () => {
    const first = await createSubmission({
      title: "Doc",
      content: "v1",
      author: "Maya Chen",
      reviewer: "heuristic",
    });
    const second = await createSubmission({
      title: "Doc",
      content: "v2",
      author: "Maya Chen",
      documentId: first.document.id,
      reviewer: "heuristic",
    });
    expect(second.document.id).toBe(first.document.id);
    expect(second.version.number).toBe(2);
  });

  it("rubric draft → gate → publish flow, publish requires a gate run", async () => {
    const draft = await saveRubricDraft(
      { ...defaultRubricDraft, failOn: ["critical"] },
      "Priya Nair",
    );
    expect(draft.version).toBe(2);
    expect(draft.publishedAt).toBeNull();

    // Publish before the gate has run is refused.
    expect(await publishRubric(draft.version)).toBeNull();

    await setGoldenGate(draft.version, {
      ranAt: new Date().toISOString(),
      reviewer: "heuristic",
      pass: true,
      cases: [],
    });
    const published = await publishRubric(draft.version);
    expect(published?.publishedAt).not.toBeNull();

    const db = await getDb();
    expect(publishedRubric(db).version).toBe(2);
  });
});
