import { beforeEach, describe, expect, it } from "vitest";
import {
  createSubmission,
  ModelBudgetExceededError,
  getDb,
  publishRubric,
  rerunVersion,
  resetStoreForTests,
  saveRubricDraft,
  setGoldenGate,
  updateRun,
} from "./store";
import { defaultRubricDraft } from "./rubric";

beforeEach(async () => {
  await resetStoreForTests(false);
});

describe("rerunVersion", () => {
  it("enforces the transactional model budget without charging an idempotent replay", async () => {
    const original = await createSubmission({ title: "Budget", content: "Synthetic", author: "Author", reviewer: "heuristic" });
    const input = { versionId: original.version.id, reviewer: "model" as const, actorId: "writer", idempotencyKey: "budget-replay", modelDailyCap: 1 };
    const first = await rerunVersion(input);
    expect(first.status).toBe("created");
    await expect(rerunVersion(input)).resolves.toEqual(first);
    await expect(rerunVersion({ ...input, idempotencyKey: "budget-second" })).rejects.toBeInstanceOf(ModelBudgetExceededError);
    expect((await getDb()).runs.filter(run => run.reviewer === "model")).toHaveLength(1);
  });

  it("creates a second queued run for the same document version using the current published rubric", async () => {
    const original = await createSubmission({
      title: "Existing version",
      content: "This customer email promises guaranteed returns.",
      author: "Maya Chen",
      actorId: "usr_author",
      reviewer: "heuristic",
    });
    await updateRun(original.run.id, {
      status: "done",
      result: {
        verdict: "pass",
        findings: [],
        summary: "Original review completed.",
      },
      error: null,
      finishedAt: "2026-07-01T00:00:00.000Z",
    });
    const draft = await saveRubricDraft(defaultRubricDraft, "Priya Nair");
    await setGoldenGate(draft.version, {
      ranAt: "2026-07-02T00:00:00.000Z",
      reviewer: "heuristic",
      pass: true,
      cases: [],
    });
    await publishRubric(draft.version);

    const result = await rerunVersion({
      versionId: original.version.id,
      reviewer: "heuristic",
      actorId: "usr_author",
    });

    expect(result.status).toBe("created");
    if (result.status !== "created") throw new Error("unreachable");
    expect(result.run.id).not.toBe(original.run.id);
    expect(result.run.documentId).toBe(original.document.id);
    expect(result.run.versionId).toBe(original.version.id);
    expect(result.run.status).toBe("queued");
    expect(result.run.rubricVersion).toBe(draft.version);
    expect(result.run.actorId).toBe("usr_author");

    const db = await getDb();
    const runsForVersion = db.runs.filter(
      (run) => run.versionId === original.version.id,
    );
    const originalStored = db.runs.find((run) => run.id === original.run.id);

    expect(runsForVersion).toHaveLength(2);
    expect(originalStored).toMatchObject({
      id: original.run.id,
      status: "done",
      rubricVersion: 1,
      error: null,
      finishedAt: "2026-07-01T00:00:00.000Z",
    });
  });

  it("returns missing for a bogus version id", async () => {
    await expect(
      rerunVersion({
        versionId: "ver_missing",
        reviewer: "heuristic",
      }),
    ).resolves.toEqual({ status: "missing" });
  });

  it("carries jurisdictions onto the new run", async () => {
    const original = await createSubmission({
      title: "Jurisdiction version",
      content: "Plain document.",
      author: "Maya Chen",
      reviewer: "heuristic",
    });

    const result = await rerunVersion({
      versionId: original.version.id,
      reviewer: "heuristic",
      jurisdictions: ["US", "EU"],
    });

    expect(result.status).toBe("created");
    if (result.status !== "created") throw new Error("unreachable");
    expect(result.run.jurisdictions).toEqual(["US", "EU"]);
  });
});
