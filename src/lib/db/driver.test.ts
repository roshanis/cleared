import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { ReviewResult } from "@/schema";
import { defaultRubricDraft, type RubricVersion } from "@/lib/rubric";
import type {
  Decision,
  DocVersion,
  DocumentRecord,
  ReviewRun,
  UserRecord,
} from "@/lib/store";
import { UniqueViolationError, type StoreDriver, type Tx } from "./driver";
import { createMemoryDriver } from "./memory";
import { createSqliteDriver } from "./sqlite";

// ---------------------------------------------------------------------------
// Fixtures — FK-valid graph: rubric v1 → document → version → run → decision.
// ---------------------------------------------------------------------------

const T0 = "2026-07-01T00:00:00.000Z";

const failResult: ReviewResult = {
  verdict: "fail",
  findings: [
    {
      criterionId: "C2",
      severity: "critical",
      quote: "guaranteed returns",
      explanation: "Promises performance.",
      recommendation: "Remove the guarantee.",
    },
  ],
  summary: "One critical finding.",
};

const rubricFixture = (over: Partial<RubricVersion> = {}): RubricVersion => ({
  ...defaultRubricDraft,
  version: 1,
  author: "Priya Nair",
  createdAt: T0,
  publishedAt: T0,
  goldenGate: null,
  ...over,
});

const documentFixture = (
  over: Partial<DocumentRecord> = {},
): DocumentRecord => ({
  id: "doc_1",
  title: "Test document",
  author: "Maya Chen",
  createdAt: T0,
  ...over,
});

const versionFixture = (over: Partial<DocVersion> = {}): DocVersion => ({
  id: "ver_1",
  documentId: "doc_1",
  number: 1,
  author: "Maya Chen",
  content: "Body text",
  createdAt: T0,
  ...over,
});

const runFixture = (over: Partial<ReviewRun> = {}): ReviewRun => ({
  id: "run_1",
  documentId: "doc_1",
  versionId: "ver_1",
  status: "queued",
  reviewer: "heuristic",
  rubricVersion: 1,
  result: null,
  error: null,
  createdAt: T0,
  finishedAt: null,
  ...over,
});

const decisionFixture = (over: Partial<Decision> = {}): Decision => ({
  id: "dec_1",
  runId: "run_1",
  documentId: "doc_1",
  officer: "Devon Park",
  action: "reject",
  note: "Agreed with the agent.",
  overrides: [{ findingIndex: 0, action: "accept" }],
  createdAt: T0,
  ...over,
});

const userFixture = (over: Partial<UserRecord> = {}): UserRecord => ({
  id: "usr_1",
  email: "writer@example.com",
  displayName: "Writer Example",
  role: "author",
  status: "invited",
  sessionGen: 0,
  createdAt: T0,
  updatedAt: T0,
  ...over,
});

/** Insert the base FK graph (rubric, document, version) plus a run. */
async function seedGraph(tx: Tx, run: ReviewRun = runFixture()) {
  await tx.insertRubric(rubricFixture());
  await tx.insertDocument(documentFixture());
  await tx.insertVersion(versionFixture());
  await tx.insertRun(run);
}

// ---------------------------------------------------------------------------
// Driver factories under contract. Postgres joins only when DATABASE_URL is
// set (no live database required for the default run).
// ---------------------------------------------------------------------------

const factories: Array<[string, () => Promise<StoreDriver>]> = [
  [
    "memory",
    async () => {
      const driver = createMemoryDriver();
      await driver.init();
      return driver;
    },
  ],
  [
    "sqlite",
    async () => {
      const dir = mkdtempSync(path.join(tmpdir(), "cleared-driver-"));
      const driver = createSqliteDriver(path.join(dir, "test.db"));
      await driver.init();
      return driver;
    },
  ],
];

if (process.env.DATABASE_URL) {
  factories.push([
    "postgres",
    async () => {
      const { createPostgresDriver } = await import("./postgres");
      const driver = createPostgresDriver();
      await driver.init();
      const { default: pg } = await import("pg");
      const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        max: 1,
      });
      await pool.query(
        "TRUNCATE decisions, runs, versions, documents, rubrics, users CASCADE",
      );
      await pool.end();
      return driver;
    },
  ]);
}

for (const [name, makeDriver] of factories) {
  describe(`driver contract: ${name}`, () => {
    let driver: StoreDriver;

    beforeEach(async () => {
      driver = await makeDriver();
    });

    it("round-trips every entity, preserving JSON fields", async () => {
      const rubric = rubricFixture({
        goldenGate: {
          ranAt: T0,
          reviewer: "heuristic",
          pass: true,
          cases: [
            {
              id: "001",
              pass: true,
              verdict: "pass",
              expectedVerdict: "pass",
              missingCriteria: [],
              extraCriteria: ["C5"],
            },
          ],
        },
      });
      const run = runFixture({
        status: "done",
        result: failResult,
        finishedAt: "2026-07-01T00:05:00.000Z",
        actorId: "usr_1",
      });
      const decision = decisionFixture({ actorId: "usr_2" });
      await driver.transact(async (tx) => {
        await tx.createUser(userFixture());
        await tx.createUser(
          userFixture({
            id: "usr_2",
            email: "officer@example.com",
            displayName: "Officer Example",
            role: "officer",
            status: "active",
          }),
        );
        await tx.insertRubric(rubric);
        await tx.insertDocument(documentFixture());
        await tx.insertVersion(versionFixture());
        await tx.insertRun(run);
        await tx.insertDecision(decision);
      });

      await driver.transact(async (tx) => {
        expect(await tx.getUserById("usr_1")).toEqual(userFixture());
        expect(await tx.getUserByEmail("WRITER@example.com")).toEqual(
          userFixture(),
        );
        expect(await tx.listUsers()).toEqual([
          userFixture(),
          userFixture({
            id: "usr_2",
            email: "officer@example.com",
            displayName: "Officer Example",
            role: "officer",
            status: "active",
          }),
        ]);
        expect(await tx.getDocument("doc_1")).toEqual(documentFixture());
        expect(await tx.getVersion("ver_1")).toEqual(versionFixture());
        expect(await tx.getRun("run_1")).toEqual(run);
        expect(await tx.getRubric(1)).toEqual(rubric);
        expect(await tx.getDecisionByRunId("run_1")).toEqual(decision);
        expect(await tx.getUserById("usr_missing")).toBeNull();
        expect(await tx.getUserByEmail("missing@example.com")).toBeNull();
        expect(await tx.getDocument("doc_missing")).toBeNull();
        expect(await tx.getRun("run_missing")).toBeNull();
        expect(await tx.getRubric(99)).toBeNull();
        expect(await tx.getDecisionByRunId("run_missing")).toBeNull();
      });

      const db = await driver.snapshot();
      expect(db.users).toEqual([
        userFixture(),
        userFixture({
          id: "usr_2",
          email: "officer@example.com",
          displayName: "Officer Example",
          role: "officer",
          status: "active",
        }),
      ]);
      expect(db.documents).toEqual([documentFixture()]);
      expect(db.versions).toEqual([versionFixture()]);
      expect(db.runs).toEqual([run]);
      expect(db.decisions).toEqual([decision]);
      expect(db.rubrics).toEqual([rubric]);
    });

    it("updates users and enforces unique email addresses", async () => {
      await driver.transact((tx) => tx.createUser(userFixture()));

      await expect(
        driver.transact((tx) =>
          tx.createUser(userFixture({ id: "usr_2", email: "WRITER@example.com" })),
        ),
      ).rejects.toThrow(UniqueViolationError);

      const updated = await driver.transact((tx) =>
        tx.updateUser("usr_1", {
          displayName: "Updated Writer",
          role: "officer",
          status: "active",
          sessionGen: 1,
        }),
      );
      expect(updated).toEqual(
        userFixture({
          displayName: "Updated Writer",
          role: "officer",
          status: "active",
          sessionGen: 1,
          updatedAt: updated?.updatedAt,
        }),
      );
      expect(updated?.updatedAt).not.toBe(T0);
      expect(
        await driver.transact((tx) =>
          tx.updateUser("missing", { status: "active" }),
        ),
      ).toBeNull();
    });

    it("computes nextVersionNumber per document and maxRubricVersion", async () => {
      await driver.transact(async (tx) => {
        expect(await tx.maxRubricVersion()).toBe(0);
        await tx.insertRubric(rubricFixture());
        await tx.insertRubric(rubricFixture({ version: 2, publishedAt: null }));
        expect(await tx.maxRubricVersion()).toBe(2);

        await tx.insertDocument(documentFixture());
        await tx.insertDocument(documentFixture({ id: "doc_2" }));
        expect(await tx.nextVersionNumber("doc_1")).toBe(1);
        await tx.insertVersion(versionFixture());
        await tx.insertVersion(
          versionFixture({ id: "ver_2", number: 2 }),
        );
        expect(await tx.nextVersionNumber("doc_1")).toBe(3);
        expect(await tx.nextVersionNumber("doc_2")).toBe(1);
      });
    });

    it("latestPublishedRubric returns the highest published version", async () => {
      await driver.transact(async (tx) => {
        expect(await tx.latestPublishedRubric()).toBeNull();
        await tx.insertRubric(rubricFixture());
        await tx.insertRubric(
          rubricFixture({ version: 2, publishedAt: "2026-07-02T00:00:00.000Z" }),
        );
        await tx.insertRubric(rubricFixture({ version: 3, publishedAt: null }));
        expect((await tx.latestPublishedRubric())?.version).toBe(2);
      });
    });

    it("claims a queued run", async () => {
      await driver.transact((tx) => seedGraph(tx));
      const claimed = await driver.transact((tx) => tx.claimRun("run_1"));
      expect(claimed?.status).toBe("reviewing");
      const db = await driver.snapshot();
      expect(db.runs[0].status).toBe("reviewing");
    });

    it("claims an errored run and clears its error", async () => {
      await driver.transact((tx) =>
        seedGraph(tx, runFixture({ status: "error", error: "boom" })),
      );
      const claimed = await driver.transact((tx) => tx.claimRun("run_1"));
      expect(claimed?.status).toBe("reviewing");
      expect(claimed?.error).toBeNull();
      const db = await driver.snapshot();
      expect(db.runs[0].error).toBeNull();
    });

    it("refuses to claim reviewing, done, or missing runs", async () => {
      await driver.transact(async (tx) => {
        await seedGraph(tx, runFixture({ status: "reviewing" }));
        await tx.insertRun(
          runFixture({ id: "run_done", status: "done", result: failResult }),
        );
      });
      expect(await driver.transact((tx) => tx.claimRun("run_1"))).toBeNull();
      expect(await driver.transact((tx) => tx.claimRun("run_done"))).toBeNull();
      expect(await driver.transact((tx) => tx.claimRun("run_missing"))).toBeNull();
      const db = await driver.snapshot();
      expect(db.runs.map((r) => r.status)).toEqual(["reviewing", "done"]);
    });

    it("rolls back the whole transaction when the callback throws", async () => {
      await expect(
        driver.transact(async (tx) => {
          await tx.insertRubric(rubricFixture());
          await tx.insertDocument(documentFixture());
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
      const db = await driver.snapshot();
      expect(db.documents).toHaveLength(0);
      expect(db.rubrics).toHaveLength(0);
    });

    it("rolls back a claim when the transaction later throws", async () => {
      await driver.transact((tx) => seedGraph(tx));
      await expect(
        driver.transact(async (tx) => {
          const claimed = await tx.claimRun("run_1");
          expect(claimed?.status).toBe("reviewing");
          throw new Error("corrupt");
        }),
      ).rejects.toThrow("corrupt");
      const db = await driver.snapshot();
      expect(db.runs[0].status).toBe("queued");
    });

    it("maps a duplicate decision run_id to UniqueViolationError", async () => {
      await driver.transact(async (tx) => {
        await seedGraph(tx, runFixture({ status: "done", result: failResult }));
        await tx.insertDecision(decisionFixture());
      });
      await expect(
        driver.transact((tx) =>
          tx.insertDecision(decisionFixture({ id: "dec_2" })),
        ),
      ).rejects.toThrow(UniqueViolationError);
      const db = await driver.snapshot();
      expect(db.decisions).toHaveLength(1);
    });

    it("maps a duplicate (document_id, number) to UniqueViolationError", async () => {
      await driver.transact(async (tx) => {
        await tx.insertRubric(rubricFixture());
        await tx.insertDocument(documentFixture());
        await tx.insertVersion(versionFixture());
      });
      await expect(
        driver.transact((tx) =>
          tx.insertVersion(versionFixture({ id: "ver_2" })),
        ),
      ).rejects.toThrow(UniqueViolationError);
      const db = await driver.snapshot();
      expect(db.versions).toHaveLength(1);
    });

    it("maps a duplicate rubric version to UniqueViolationError", async () => {
      await driver.transact((tx) => tx.insertRubric(rubricFixture()));
      await expect(
        driver.transact((tx) => tx.insertRubric(rubricFixture())),
      ).rejects.toThrow(UniqueViolationError);
    });

    it("updateRun patches fields and returns the merged run", async () => {
      await driver.transact((tx) => seedGraph(tx));
      const finishedAt = "2026-07-01T00:10:00.000Z";
      const updated = await driver.transact((tx) =>
        tx.updateRun("run_1", {
          status: "done",
          result: failResult,
          error: null,
          finishedAt,
        }),
      );
      expect(updated?.status).toBe("done");
      expect(updated?.result).toEqual(failResult);
      expect(updated?.finishedAt).toBe(finishedAt);
      expect(
        await driver.transact((tx) => tx.updateRun("run_missing", { status: "done" })),
      ).toBeNull();
      const db = await driver.snapshot();
      expect(db.runs[0].result).toEqual(failResult);
    });

    it("updateRubric sets goldenGate and publishedAt independently", async () => {
      await driver.transact((tx) =>
        tx.insertRubric(rubricFixture({ publishedAt: null })),
      );
      const report = {
        ranAt: T0,
        reviewer: "heuristic" as const,
        pass: true,
        cases: [],
      };
      const gated = await driver.transact((tx) =>
        tx.updateRubric(1, { goldenGate: report }),
      );
      expect(gated?.goldenGate).toEqual(report);
      expect(gated?.publishedAt).toBeNull();

      const published = await driver.transact((tx) =>
        tx.updateRubric(1, { publishedAt: "2026-07-02T00:00:00.000Z" }),
      );
      expect(published?.publishedAt).toBe("2026-07-02T00:00:00.000Z");
      expect(published?.goldenGate).toEqual(report);

      expect(
        await driver.transact((tx) => tx.updateRubric(99, { publishedAt: T0 })),
      ).toBeNull();
    });

    it("snapshot preserves insertion order", async () => {
      await driver.transact(async (tx) => {
        await tx.insertRubric(rubricFixture());
        await tx.insertDocument(documentFixture({ id: "doc_b", title: "B" }));
        await tx.insertDocument(documentFixture({ id: "doc_a", title: "A" }));
        await tx.insertVersion(versionFixture({ id: "ver_b", documentId: "doc_b" }));
        await tx.insertVersion(versionFixture({ id: "ver_a", documentId: "doc_a" }));
        await tx.insertRun(
          runFixture({ id: "run_b", documentId: "doc_b", versionId: "ver_b" }),
        );
        await tx.insertRun(
          runFixture({ id: "run_a", documentId: "doc_a", versionId: "ver_a" }),
        );
      });
      const db = await driver.snapshot();
      expect(db.documents.map((d) => d.id)).toEqual(["doc_b", "doc_a"]);
      expect(db.versions.map((v) => v.id)).toEqual(["ver_b", "ver_a"]);
      expect(db.runs.map((r) => r.id)).toEqual(["run_b", "run_a"]);
    });
  });
}
