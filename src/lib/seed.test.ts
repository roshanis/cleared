import { describe, expect, it } from "vitest";
import { demoPersonaUsers, resetStoreForTests } from "./store";

describe("demo seed", () => {
  it("creates a lived-in demo workspace with decisions and open review work", async () => {
    const db = await resetStoreForTests(true);

    const decisionRunIds = new Set(db.decisions.map((decision) => decision.runId));
    const nonPassRuns = db.runs.filter(
      (run) => run.status === "done" && run.result && run.result.verdict !== "pass",
    );
    const undecidedNonPassRuns = nonPassRuns.filter(
      (run) => !decisionRunIds.has(run.id),
    );

    expect(db.documents.length).toBeGreaterThanOrEqual(5);
    expect(db.documents.every((document) => document.author === "Maya Chen")).toBe(
      true,
    );
    expect(db.decisions.length).toBeGreaterThanOrEqual(4);
    expect(db.users).toEqual(demoPersonaUsers);
    expect(db.runs.every((run) => run.actorId === demoPersonaUsers[0].id)).toBe(
      true,
    );
    expect(
      db.decisions.every(
        (decision) => decision.actorId === demoPersonaUsers[1].id,
      ),
    ).toBe(true);
    expect(db.decisions.map((decision) => decision.action)).toEqual(
      expect.arrayContaining(["approve", "reject"]),
    );
    expect(undecidedNonPassRuns.length).toBeGreaterThanOrEqual(2);

    for (const decision of db.decisions) {
      const run = db.runs.find((candidate) => candidate.id === decision.runId);
      expect(run?.result?.verdict).not.toBe("pass");
      expect(decision.overrides).toHaveLength(run?.result?.findings.length ?? -1);
      expect(new Set(decision.overrides.map((override) => override.findingIndex)).size).toBe(
        decision.overrides.length,
      );
    }
  });
});
