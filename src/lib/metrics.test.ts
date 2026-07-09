/**
 * Percentile convention used by computeUtilizationMetrics: nearest-rank.
 *   index = Math.ceil(p * n) - 1  (0-based, sorted ascending)
 * For n=1: p50 = p95 = values[0]
 * For n=2: p50 = values[0], p95 = values[1]
 */

import { describe, expect, it } from "vitest";
import { computeUtilizationMetrics } from "./metrics";
import type { Db, Decision, ReviewRun } from "./store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_NOW = new Date("2026-07-07T12:00:00.000Z"); // Tuesday ISO week 2026-W28

function emptyDb(): Db {
  return {
    users: [],
    documents: [],
    versions: [],
    runs: [],
    decisions: [],
    rubrics: [],
  };
}

function makeDoc(id: string, author: string, createdAt = "2026-07-01T00:00:00.000Z") {
  return { id, title: "Doc", author, createdAt };
}

function makeRun(
  overrides: Partial<ReviewRun> & { id: string; documentId: string },
): ReviewRun {
  return {
    versionId: "ver_1",
    status: "done",
    reviewer: "heuristic",
    rubricVersion: 1,
    result: null,
    error: null,
    createdAt: "2026-07-07T08:00:00.000Z",
    finishedAt: "2026-07-07T08:01:00.000Z",
    ...overrides,
  };
}

function makeDecision(overrides: Partial<Decision> & { id: string; runId: string }): Decision {
  return {
    documentId: "doc_1",
    officer: "Devon Park",
    action: "approve",
    note: "Looks good",
    overrides: [],
    createdAt: "2026-07-07T09:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Empty store
// ---------------------------------------------------------------------------

describe("computeUtilizationMetrics — empty store", () => {
  it("returns empty/null for all six metrics", () => {
    const db = emptyDb();
    const m = computeUtilizationMetrics(db, BASE_NOW);

    expect(m.reviewsPerAuthorThisWeek).toEqual([]);
    expect(m.timeToFirstVerdict).toEqual({ p50: null, p95: null });
    expect(m.timeToOfficerDecision).toEqual({ p50: null, p95: null });
    expect(m.pctNeedsHumanReview).toBeNull();
    expect(m.modelErrorRate).toBeNull();
    expect(m.reviewsTodayVsCap.today).toBe(0);
    expect(m.reviewsTodayVsCap.cap).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Reviews per author this week
// ---------------------------------------------------------------------------

describe("computeUtilizationMetrics — reviewsPerAuthorThisWeek", () => {
  it("counts runs within the current ISO week by document author", () => {
    const db = emptyDb();
    db.documents.push(makeDoc("doc_1", "Maya Chen"));
    db.documents.push(makeDoc("doc_2", "Devon Park"));

    // Two runs this week for Maya, one for Devon
    db.runs.push(makeRun({ id: "r1", documentId: "doc_1", createdAt: "2026-07-06T08:00:00.000Z" })); // Mon
    db.runs.push(makeRun({ id: "r2", documentId: "doc_1", createdAt: "2026-07-07T08:00:00.000Z" })); // Tue
    db.runs.push(makeRun({ id: "r3", documentId: "doc_2", createdAt: "2026-07-07T10:00:00.000Z" })); // Tue
    // Run from last week — should not count
    db.runs.push(makeRun({ id: "r4", documentId: "doc_1", createdAt: "2026-06-30T08:00:00.000Z" })); // last Mon

    const m = computeUtilizationMetrics(db, BASE_NOW);
    // Sort by count desc for assertion
    const sorted = [...m.reviewsPerAuthorThisWeek].sort((a, b) => b.count - a.count);
    expect(sorted).toEqual([
      { author: "Maya Chen", count: 2 },
      { author: "Devon Park", count: 1 },
    ]);
  });

  it("excludes runs from the next ISO week", () => {
    const db = emptyDb();
    db.documents.push(makeDoc("doc_1", "Maya Chen"));
    db.runs.push(makeRun({ id: "r1", documentId: "doc_1", createdAt: "2026-07-13T00:00:00.000Z" })); // next Mon
    const m = computeUtilizationMetrics(db, BASE_NOW);
    expect(m.reviewsPerAuthorThisWeek).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Time to first verdict
// ---------------------------------------------------------------------------

describe("computeUtilizationMetrics — timeToFirstVerdict", () => {
  it("is null when there are no done runs with finishedAt", () => {
    const db = emptyDb();
    db.runs.push(makeRun({ id: "r1", documentId: "doc_1", status: "error", finishedAt: null }));
    const m = computeUtilizationMetrics(db, BASE_NOW);
    expect(m.timeToFirstVerdict).toEqual({ p50: null, p95: null });
  });

  it("computes minutes from createdAt to finishedAt for a single done run", () => {
    const db = emptyDb();
    db.runs.push(makeRun({
      id: "r1",
      documentId: "doc_1",
      status: "done",
      createdAt: "2026-07-07T08:00:00.000Z",
      finishedAt: "2026-07-07T08:05:00.000Z", // 5 minutes
    }));
    const m = computeUtilizationMetrics(db, BASE_NOW);
    // n=1: p50 = p95 = 5
    expect(m.timeToFirstVerdict.p50).toBeCloseTo(5);
    expect(m.timeToFirstVerdict.p95).toBeCloseTo(5);
  });

  it("p50 and p95 with n=2 — nearest-rank", () => {
    const db = emptyDb();
    db.runs.push(makeRun({
      id: "r1", documentId: "doc_1", status: "done",
      createdAt: "2026-07-07T08:00:00.000Z",
      finishedAt: "2026-07-07T08:02:00.000Z", // 2 min
    }));
    db.runs.push(makeRun({
      id: "r2", documentId: "doc_1", status: "done",
      createdAt: "2026-07-07T09:00:00.000Z",
      finishedAt: "2026-07-07T09:10:00.000Z", // 10 min
    }));
    const m = computeUtilizationMetrics(db, BASE_NOW);
    // sorted = [2, 10]; nearest-rank p50 index = ceil(0.5*2)-1=0 → 2; p95 index = ceil(0.95*2)-1=1 → 10
    expect(m.timeToFirstVerdict.p50).toBeCloseTo(2);
    expect(m.timeToFirstVerdict.p95).toBeCloseTo(10);
  });
});

// ---------------------------------------------------------------------------
// Time to officer decision
// ---------------------------------------------------------------------------

describe("computeUtilizationMetrics — timeToOfficerDecision", () => {
  it("is null when there are no decisions", () => {
    const db = emptyDb();
    db.runs.push(makeRun({ id: "r1", documentId: "doc_1", status: "done" }));
    const m = computeUtilizationMetrics(db, BASE_NOW);
    expect(m.timeToOfficerDecision).toEqual({ p50: null, p95: null });
  });

  it("computes minutes from run finishedAt to decision createdAt for a single pair", () => {
    const db = emptyDb();
    db.runs.push(makeRun({
      id: "r1", documentId: "doc_1", status: "done",
      finishedAt: "2026-07-07T08:00:00.000Z",
    }));
    db.decisions.push(makeDecision({
      id: "d1", runId: "r1",
      createdAt: "2026-07-07T08:30:00.000Z", // 30 min later
    }));
    const m = computeUtilizationMetrics(db, BASE_NOW);
    expect(m.timeToOfficerDecision.p50).toBeCloseTo(30);
    expect(m.timeToOfficerDecision.p95).toBeCloseTo(30);
  });

  it("p50/p95 with n=2 decisions — nearest-rank", () => {
    const db = emptyDb();
    db.runs.push(makeRun({ id: "r1", documentId: "doc_1", status: "done", finishedAt: "2026-07-07T08:00:00.000Z" }));
    db.runs.push(makeRun({ id: "r2", documentId: "doc_1", status: "done", finishedAt: "2026-07-07T09:00:00.000Z" }));
    db.decisions.push(makeDecision({ id: "d1", runId: "r1", createdAt: "2026-07-07T08:10:00.000Z" })); // 10 min
    db.decisions.push(makeDecision({ id: "d2", runId: "r2", createdAt: "2026-07-07T10:00:00.000Z" })); // 60 min
    const m = computeUtilizationMetrics(db, BASE_NOW);
    // sorted = [10, 60]; p50 index 0 → 10; p95 index 1 → 60
    expect(m.timeToOfficerDecision.p50).toBeCloseTo(10);
    expect(m.timeToOfficerDecision.p95).toBeCloseTo(60);
  });
});

// ---------------------------------------------------------------------------
// % needs_human_review
// ---------------------------------------------------------------------------

describe("computeUtilizationMetrics — pctNeedsHumanReview", () => {
  it("is null with no done runs", () => {
    const db = emptyDb();
    const m = computeUtilizationMetrics(db, BASE_NOW);
    expect(m.pctNeedsHumanReview).toBeNull();
  });

  it("is 0 when no done run has needs_human_review", () => {
    const db = emptyDb();
    db.runs.push(makeRun({ id: "r1", documentId: "doc_1", status: "done", result: { verdict: "pass", findings: [], jurisdictionVerdicts: {} } as never }));
    const m = computeUtilizationMetrics(db, BASE_NOW);
    expect(m.pctNeedsHumanReview).toBe(0);
  });

  it("counts needs_human_review verdicts over all done runs", () => {
    const db = emptyDb();
    db.runs.push(makeRun({ id: "r1", documentId: "doc_1", status: "done", result: { verdict: "needs_human_review", findings: [], jurisdictionVerdicts: {} } as never }));
    db.runs.push(makeRun({ id: "r2", documentId: "doc_1", status: "done", result: { verdict: "pass", findings: [], jurisdictionVerdicts: {} } as never }));
    db.runs.push(makeRun({ id: "r3", documentId: "doc_1", status: "done", result: { verdict: "fail", findings: [], jurisdictionVerdicts: {} } as never }));
    const m = computeUtilizationMetrics(db, BASE_NOW);
    expect(m.pctNeedsHumanReview).toBeCloseTo(1 / 3);
  });
});

// ---------------------------------------------------------------------------
// Model error rate
// ---------------------------------------------------------------------------

describe("computeUtilizationMetrics — modelErrorRate", () => {
  it("is null when there are no model runs", () => {
    const db = emptyDb();
    db.runs.push(makeRun({ id: "r1", documentId: "doc_1", reviewer: "heuristic", status: "done" }));
    const m = computeUtilizationMetrics(db, BASE_NOW);
    expect(m.modelErrorRate).toBeNull();
  });

  it("is 0 when model runs have no errors", () => {
    const db = emptyDb();
    db.runs.push(makeRun({ id: "r1", documentId: "doc_1", reviewer: "model", status: "done" }));
    const m = computeUtilizationMetrics(db, BASE_NOW);
    expect(m.modelErrorRate).toBe(0);
  });

  it("counts error-status model runs over all model runs", () => {
    const db = emptyDb();
    db.runs.push(makeRun({ id: "r1", documentId: "doc_1", reviewer: "model", status: "error" }));
    db.runs.push(makeRun({ id: "r2", documentId: "doc_1", reviewer: "model", status: "done" }));
    db.runs.push(makeRun({ id: "r3", documentId: "doc_1", reviewer: "model", status: "done" }));
    db.runs.push(makeRun({ id: "r4", documentId: "doc_1", reviewer: "heuristic", status: "error" })); // not model
    const m = computeUtilizationMetrics(db, BASE_NOW);
    expect(m.modelErrorRate).toBeCloseTo(1 / 3);
  });
});

// ---------------------------------------------------------------------------
// Reviews today vs cap
// ---------------------------------------------------------------------------

describe("computeUtilizationMetrics — reviewsTodayVsCap", () => {
  it("counts model runs from the same UTC day", () => {
    const db = emptyDb();
    const now = new Date("2026-07-07T12:00:00.000Z");
    db.runs.push(makeRun({ id: "r1", documentId: "doc_1", reviewer: "model", createdAt: "2026-07-07T01:00:00.000Z" }));
    db.runs.push(makeRun({ id: "r2", documentId: "doc_1", reviewer: "model", createdAt: "2026-07-07T11:00:00.000Z" }));
    db.runs.push(makeRun({ id: "r3", documentId: "doc_1", reviewer: "heuristic", createdAt: "2026-07-07T10:00:00.000Z" })); // not model
    db.runs.push(makeRun({ id: "r4", documentId: "doc_1", reviewer: "model", createdAt: "2026-07-06T23:59:59.000Z" })); // yesterday
    const m = computeUtilizationMetrics(db, now);
    expect(m.reviewsTodayVsCap.today).toBe(2);
    expect(m.reviewsTodayVsCap.cap).toBeGreaterThan(0);
  });
});
