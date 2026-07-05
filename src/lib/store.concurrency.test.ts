/**
 * Concurrency tests — verifies that concurrent store operations both persist
 * correctly and that duplicate-decision races are detected atomically.
 *
 * Runs against the memory driver and the SQLite driver (using a per-test temp
 * file). Postgres cases are skipped unless DATABASE_URL is set.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { ReviewResult } from "@/schema";
import { createSqliteDriver } from "@/lib/db/sqlite";
import { setDriverForTests } from "@/lib/db/index";
import {
  getDb,
  resetStoreForTests,
  createSubmission,
  addDecision,
  updateRun,
} from "@/lib/store";

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Shared test cases — called for each driver variant
// ---------------------------------------------------------------------------

function sharedCases() {
  it("(a) two concurrent createSubmission calls both fully persist", async () => {
    const [r1, r2] = await Promise.all([
      createSubmission({
        title: "Doc Alpha",
        content: "Alpha content",
        author: "Maya Chen",
        reviewer: "heuristic",
      }),
      createSubmission({
        title: "Doc Beta",
        content: "Beta content",
        author: "Maya Chen",
        reviewer: "heuristic",
      }),
    ]);

    const db = await getDb();
    expect(db.documents).toHaveLength(2);
    expect(db.versions).toHaveLength(2);
    expect(db.runs).toHaveLength(2);
    expect(db.documents.map((d) => d.id)).toContain(r1.document.id);
    expect(db.documents.map((d) => d.id)).toContain(r2.document.id);
  });

  it("(b) createSubmission concurrent with addDecision on a ready run both persist", async () => {
    // Create a decidable run before the concurrent ops.
    const { run } = await createSubmission({
      title: "Pre-existing doc",
      content: "Some content",
      author: "Maya Chen",
      reviewer: "heuristic",
    });
    await updateRun(run.id, {
      status: "done",
      result: failResult,
      finishedAt: new Date().toISOString(),
    });

    const [subResult, decResult] = await Promise.all([
      createSubmission({
        title: "New Doc",
        content: "New content",
        author: "Maya Chen",
        reviewer: "heuristic",
      }),
      addDecision({
        runId: run.id,
        officer: "Devon Park",
        action: "reject",
        note: "Concurrent decision.",
        overrides: [{ findingIndex: 0, action: "accept" }],
      }),
    ]);

    const db = await getDb();
    // The new submission must have persisted.
    expect(db.documents.map((d) => d.id)).toContain(subResult.document.id);
    // The decision must have persisted.
    expect(decResult.status).toBe("created");
    expect(db.decisions).toHaveLength(1);
  });

  it("(c) two concurrent addDecision on same run → exactly one created, one duplicate", async () => {
    const { run } = await createSubmission({
      title: "Contested doc",
      content: "Some content",
      author: "Maya Chen",
      reviewer: "heuristic",
    });
    await updateRun(run.id, {
      status: "done",
      result: failResult,
      finishedAt: new Date().toISOString(),
    });

    const input = {
      runId: run.id,
      officer: "Devon Park",
      action: "reject" as const,
      note: "Race note",
      overrides: [{ findingIndex: 0, action: "accept" as const }],
    };

    const [r1, r2] = await Promise.all([
      addDecision(input),
      addDecision(input),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual(["created", "duplicate"]);

    const db = await getDb();
    expect(db.decisions).toHaveLength(1);
  });
}

// ---------------------------------------------------------------------------
// Memory driver variant
// ---------------------------------------------------------------------------

describe("concurrency: memory", () => {
  beforeEach(() => resetStoreForTests(false));
  sharedCases();
});

// ---------------------------------------------------------------------------
// SQLite driver variant
// ---------------------------------------------------------------------------

describe("concurrency: sqlite", () => {
  beforeEach(async () => {
    // Temp DB file so each test starts completely fresh.
    const dir = mkdtempSync(path.join(tmpdir(), "cleared-conc-"));
    const driver = createSqliteDriver(path.join(dir, "test.db"));
    // Override driver; onDriverChange resets store's ready-memo.
    setDriverForTests(driver);
    // Seed rubric v1 only (skip demo docs to keep tests fast).
    const saved = process.env.SEED_DEMO_DATA;
    process.env.SEED_DEMO_DATA = "0";
    try {
      await getDb();
    } finally {
      if (saved === undefined) {
        delete process.env.SEED_DEMO_DATA;
      } else {
        process.env.SEED_DEMO_DATA = saved;
      }
    }
  });

  sharedCases();
});

// ---------------------------------------------------------------------------
// Postgres driver variant — only when DATABASE_URL is set
// ---------------------------------------------------------------------------

describe.skipIf(!process.env.DATABASE_URL)("concurrency: postgres", () => {
  beforeEach(async () => {
    const { createPostgresDriver } = await import("@/lib/db/postgres");
    const driver = createPostgresDriver();
    setDriverForTests(driver);

    // Truncate all tables so each test is clean.
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
    });
    try {
      await pool.query(
        "TRUNCATE decisions, runs, versions, documents, rubrics, meta CASCADE",
      );
    } finally {
      await pool.end();
    }

    // init() recreates schema; getDb() seeds rubric v1.
    await driver.init();
    const saved = process.env.SEED_DEMO_DATA;
    process.env.SEED_DEMO_DATA = "0";
    try {
      await getDb();
    } finally {
      if (saved === undefined) {
        delete process.env.SEED_DEMO_DATA;
      } else {
        process.env.SEED_DEMO_DATA = saved;
      }
    }
  });

  sharedCases();
});
