import type { ReviewResult } from "@/schema";
import type { ReviewerKind } from "@/agent/run";
import type { GoldenGateReport, RubricDraft, RubricVersion } from "./rubric";
import {
  getDriver,
  setDriverForTests,
  onDriverChange,
} from "./db/index";
import { createMemoryDriver } from "./db/memory";
import { UniqueViolationError } from "./db/driver";
import type { StorageKind, Tx } from "./db/driver";

// ---------------------------------------------------------------------------
// Domain types — kept verbatim so no import site changes.
// ---------------------------------------------------------------------------

export interface DocumentRecord {
  id: string;
  title: string;
  author: string;
  createdAt: string;
}

export interface DocVersion {
  id: string;
  documentId: string;
  number: number;
  author: string;
  content: string;
  createdAt: string;
}

export type RunStatus = "queued" | "reviewing" | "done" | "error";

export interface ReviewRun {
  id: string;
  documentId: string;
  versionId: string;
  status: RunStatus;
  reviewer: ReviewerKind;
  rubricVersion: number;
  result: ReviewResult | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  /** Target markets for this review; absent on pre-jurisdiction runs. */
  jurisdictions?: string[];
}

export interface FindingOverride {
  findingIndex: number;
  action: "accept" | "dismiss";
}

export interface Decision {
  id: string;
  runId: string;
  documentId: string;
  officer: string;
  action: "approve" | "reject";
  note: string;
  overrides: FindingOverride[];
  createdAt: string;
}

export interface Db {
  documents: DocumentRecord[];
  versions: DocVersion[];
  runs: ReviewRun[];
  decisions: Decision[];
  rubrics: RubricVersion[];
}

export const emptyDb = (): Db => ({
  documents: [],
  versions: [],
  runs: [],
  decisions: [],
  rubrics: [],
});

export const newId = (prefix: string) =>
  `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;

// ---------------------------------------------------------------------------
// Ready-memo — initialises the driver and seeds on first boot.
// Resets whenever setDriverForTests() fires a driver-change event.
// ---------------------------------------------------------------------------

let readyPromise: Promise<void> | null = null;

onDriverChange(() => {
  readyPromise = null;
});

async function initStore(): Promise<void> {
  const driver = getDriver();
  await driver.init();

  // Fast-path: check whether seed is needed before running reviews.
  const maxVer = await driver.transact((tx) => tx.maxRubricVersion());
  if (maxVer > 0) return;

  // Build seed data OUTSIDE any transaction (seedInto runs async reviews).
  const seedDb = emptyDb();
  const { seedInto } = await import("./seed");
  await seedInto(seedDb, { demoData: process.env.SEED_DEMO_DATA !== "0" });

  // Bulk-insert in one transaction; swallow UniqueViolationError as a seed race.
  await driver.transact((tx) => insertSeed(tx, seedDb, { ignoreUnique: true }));
}

async function buildSeedDb(demoData: boolean): Promise<Db> {
  const seedDb = emptyDb();
  const { seedInto } = await import("./seed");
  await seedInto(seedDb, { demoData });
  return seedDb;
}

async function insertSeed(
  tx: Tx,
  seedDb: Db,
  opts: { ignoreUnique?: boolean } = {},
): Promise<void> {
  const run = async (insert: () => Promise<void>) => {
    try {
      await insert();
    } catch (e) {
      if (!opts.ignoreUnique || !(e instanceof UniqueViolationError)) throw e;
    }
  };

  for (const rubric of seedDb.rubrics) {
    await run(() => tx.insertRubric(rubric));
  }
  for (const doc of seedDb.documents) {
    await run(() => tx.insertDocument(doc));
  }
  for (const ver of seedDb.versions) {
    await run(() => tx.insertVersion(ver));
  }
  for (const reviewRun of seedDb.runs) {
    await run(() => tx.insertRun(reviewRun));
  }
  for (const dec of seedDb.decisions) {
    await run(() => tx.insertDecision(dec));
  }
}

function ensureReady(): Promise<void> {
  return (readyPromise ??= initStore());
}

/** Transaction entry point for all ops: seeds on first boot, then runs fn. */
async function transact<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  await ensureReady();
  return getDriver().transact(fn);
}

/** Returns the storage kind of the active driver. */
export function storageKind(): StorageKind {
  return getDriver().kind;
}

/** Load a full snapshot of the database, seeding on first boot. */
export async function getDb(): Promise<Db> {
  await ensureReady();
  return getDriver().snapshot();
}

// ---------------------------------------------------------------------------
// Test-only reset
// ---------------------------------------------------------------------------

/**
 * Replace the driver with a fresh in-memory instance, seed it, mark it ready,
 * and return the initial snapshot. Keeps the same signature as before.
 */
export async function resetStoreForTests(seedDemoData = false): Promise<Db> {
  const mem = createMemoryDriver();
  await mem.init();

  // Fires onDriverChange → resets readyPromise to null.
  setDriverForTests(mem);

  // Seed the fresh driver manually (we control demoData here).
  const seedDb = await buildSeedDb(seedDemoData);
  await mem.transact((tx) => insertSeed(tx, seedDb));

  // Mark ready so getDb() skips initStore() for this driver.
  readyPromise = Promise.resolve();

  return mem.snapshot();
}

export interface ResetDemoDataResult {
  documents: number;
  decisions: number;
}

export async function resetDemoData(): Promise<ResetDemoDataResult> {
  await ensureReady();
  const seedDb = await buildSeedDb(true);

  await getDriver().transact(async (tx) => {
    await tx.clearAll();
    await insertSeed(tx, seedDb);
  });

  return {
    documents: seedDb.documents.length,
    decisions: seedDb.decisions.length,
  };
}

// ---------------------------------------------------------------------------
// Domain operations
// ---------------------------------------------------------------------------

export function publishedRubric(db: Db): RubricVersion {
  const published = db.rubrics
    .filter((r) => r.publishedAt !== null)
    .sort((a, b) => b.version - a.version);
  if (published.length === 0) {
    throw new Error("no published rubric — store was not seeded");
  }
  return published[0];
}

export interface SubmissionInput {
  title: string;
  content: string;
  author: string;
  documentId?: string;
  reviewer: ReviewerKind;
  jurisdictions?: string[];
}

async function doCreateSubmission(
  input: SubmissionInput,
): Promise<{ document: DocumentRecord; version: DocVersion; run: ReviewRun }> {
  return transact(async (tx) => {
    const now = new Date().toISOString();

    // Find or create the document.
    let document: DocumentRecord;
    if (input.documentId) {
      const found = await tx.getDocument(input.documentId);
      if (found) {
        document = found;
      } else {
        document = {
          id: newId("doc"),
          title: input.title || "Untitled document",
          author: input.author,
          createdAt: now,
        };
        await tx.insertDocument(document);
      }
    } else {
      document = {
        id: newId("doc"),
        title: input.title || "Untitled document",
        author: input.author,
        createdAt: now,
      };
      await tx.insertDocument(document);
    }

    const number = await tx.nextVersionNumber(document.id);
    const version: DocVersion = {
      id: newId("ver"),
      documentId: document.id,
      number,
      author: input.author,
      content: input.content,
      createdAt: now,
    };
    // May throw UniqueViolationError on (document_id, number) conflict.
    await tx.insertVersion(version);

    const rubric = await tx.latestPublishedRubric();
    if (!rubric) throw new Error("no published rubric — store was not seeded");

    const run: ReviewRun = {
      id: newId("run"),
      documentId: document.id,
      versionId: version.id,
      status: "queued",
      reviewer: input.reviewer,
      rubricVersion: rubric.version,
      result: null,
      error: null,
      createdAt: now,
      finishedAt: null,
      jurisdictions: input.jurisdictions,
    };
    await tx.insertRun(run);

    return { document, version, run };
  });
}

export async function createSubmission(input: SubmissionInput) {
  try {
    return await doCreateSubmission(input);
  } catch (err) {
    if (err instanceof UniqueViolationError) {
      // Retry once on a (document_id, number) version conflict.
      return doCreateSubmission(input);
    }
    throw err;
  }
}

export type ClaimRunResult =
  | {
      status: "claimed";
      run: ReviewRun;
      version: DocVersion;
      rubric: RubricVersion;
    }
  | { status: "done"; run: ReviewRun }
  | { status: "reviewing"; run: ReviewRun }
  | { status: "missing" }
  | { status: "corrupt" };

// Sentinel thrown inside the transaction to trigger rollback and signal
// that the claimed run's version/rubric could not be found.
const CORRUPT = Symbol("corrupt");

export async function claimRunForReview(runId: string): Promise<ClaimRunResult> {
  try {
    return await transact(async (tx): Promise<ClaimRunResult> => {
      const claimed = await tx.claimRun(runId);

      if (!claimed) {
        // The run wasn't transitioned — find out why.
        const run = await tx.getRun(runId);
        if (!run) return { status: "missing" };
        if (run.status === "done") return { status: "done", run };
        if (run.status === "reviewing") return { status: "reviewing", run };
        // Unexpected state — treat as corrupt.
        return { status: "corrupt" };
      }

      // Load version and rubric in the same transaction.
      const version = await tx.getVersion(claimed.versionId);
      const rubric = await tx.getRubric(claimed.rubricVersion);
      if (!version || !rubric) {
        // Throw a sentinel so the transaction rolls back, reverting the claim.
        throw CORRUPT;
      }

      return { status: "claimed", run: claimed, version, rubric };
    });
  } catch (err) {
    if (err === CORRUPT) return { status: "corrupt" };
    throw err;
  }
}

export async function completeRun(
  runId: string,
  result: ReviewResult,
): Promise<ReviewRun | null> {
  return updateRun(runId, {
    status: "done",
    result,
    error: null,
    finishedAt: new Date().toISOString(),
  });
}

export async function failRun(
  runId: string,
  message: string,
): Promise<ReviewRun | null> {
  return updateRun(runId, {
    status: "error",
    error: message,
    finishedAt: new Date().toISOString(),
  });
}

export async function updateRun(
  runId: string,
  patch: Partial<Pick<ReviewRun, "status" | "result" | "error" | "finishedAt">>,
): Promise<ReviewRun | null> {
  return transact((tx) => tx.updateRun(runId, patch));
}

export interface DecisionInput {
  runId: string;
  officer: string;
  action: "approve" | "reject";
  note: string;
  overrides: FindingOverride[];
}

export type AddDecisionResult =
  | { status: "created"; decision: Decision }
  | { status: "missing" }
  | { status: "not_decidable" }
  | { status: "duplicate" }
  | { status: "invalid_overrides"; message: string };

export async function addDecision(
  input: DecisionInput,
): Promise<AddDecisionResult> {
  try {
    return await transact(async (tx): Promise<AddDecisionResult> => {
      const run = await tx.getRun(input.runId);
      if (!run || run.status !== "done" || !run.result) {
        return { status: "missing" };
      }
      if (run.result.verdict === "pass") {
        return { status: "not_decidable" };
      }
      const findingCount = run.result.findings.length;
      const indexes = new Set(
        input.overrides.map((override) => override.findingIndex),
      );
      const invalidIndexes =
        indexes.size !== input.overrides.length ||
        input.overrides.length !== findingCount ||
        input.overrides.some(
          (override) =>
            override.findingIndex < 0 || override.findingIndex >= findingCount,
        );
      if (invalidIndexes) {
        return {
          status: "invalid_overrides",
          message:
            "Every finding must have exactly one accept/dismiss override.",
        };
      }
      const decision: Decision = {
        id: newId("dec"),
        runId: input.runId,
        documentId: run.documentId,
        officer: input.officer,
        action: input.action,
        note: input.note,
        overrides: input.overrides,
        createdAt: new Date().toISOString(),
      };
      // insertDecision throws UniqueViolationError on duplicate run_id.
      await tx.insertDecision(decision);
      return { status: "created", decision };
    });
  } catch (err) {
    if (err instanceof UniqueViolationError) return { status: "duplicate" };
    throw err;
  }
}

async function doSaveRubricDraft(
  draft: RubricDraft,
  author: string,
): Promise<RubricVersion> {
  return transact(async (tx) => {
    const nextVersion = (await tx.maxRubricVersion()) + 1;
    const rubric: RubricVersion = {
      ...draft,
      version: nextVersion,
      author,
      createdAt: new Date().toISOString(),
      publishedAt: null,
      goldenGate: null,
    };
    // May throw UniqueViolationError if another draft was saved concurrently.
    await tx.insertRubric(rubric);
    return rubric;
  });
}

export async function saveRubricDraft(
  draft: RubricDraft,
  author: string,
): Promise<RubricVersion> {
  try {
    return await doSaveRubricDraft(draft, author);
  } catch (err) {
    if (err instanceof UniqueViolationError) {
      // Retry once on version PK conflict.
      return doSaveRubricDraft(draft, author);
    }
    throw err;
  }
}

export async function setGoldenGate(
  version: number,
  report: GoldenGateReport,
): Promise<RubricVersion | null> {
  return transact((tx) =>
    tx.updateRubric(version, { goldenGate: report }),
  );
}

export async function publishRubric(
  version: number,
): Promise<RubricVersion | null> {
  return transact(async (tx) => {
    const rubric = await tx.getRubric(version);
    if (!rubric || !rubric.goldenGate?.pass) return null;
    return tx.updateRubric(version, { publishedAt: new Date().toISOString() });
  });
}

// ---------------------------------------------------------------------------
// Queries — pure helpers that operate on a Db snapshot (unchanged).
// ---------------------------------------------------------------------------

export function latestRunForVersion(db: Db, versionId: string): ReviewRun | null {
  return (
    db.runs
      .filter((r) => r.versionId === versionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  );
}

export function decisionForRun(db: Db, runId: string): Decision | null {
  return db.decisions.find((d) => d.runId === runId) ?? null;
}

export interface QueueItem {
  run: ReviewRun;
  document: DocumentRecord;
  version: DocVersion;
}

/** Runs awaiting a human decision: fail / needs_human_review, undecided. */
export function reviewQueue(db: Db): QueueItem[] {
  return db.runs
    .filter(
      (run) =>
        run.status === "done" &&
        run.result !== null &&
        run.result.verdict !== "pass" &&
        !decisionForRun(db, run.id),
    )
    .map((run) => ({
      run,
      document: db.documents.find((d) => d.id === run.documentId)!,
      version: db.versions.find((v) => v.id === run.versionId)!,
    }))
    .sort((a, b) => a.run.createdAt.localeCompare(b.run.createdAt));
}
