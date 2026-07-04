import { promises as fs } from "node:fs";
import path from "node:path";
import type { ReviewResult } from "@/schema";
import type { ReviewerKind } from "@/agent/run";
import type { GoldenGateReport, RubricDraft, RubricVersion } from "./rubric";

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
// Drivers. Upstash Redis when configured (durable on Vercel), a JSON file in
// local dev, in-memory otherwise (tests; Vercel demo without a store — data
// then lives per serverless instance only, which the UI surfaces honestly).
// ---------------------------------------------------------------------------

interface Driver {
  name: "redis" | "file" | "memory";
  load(): Promise<Db | null>;
  save(db: Db): Promise<void>;
}

const globalStore = globalThis as unknown as { __clearedDb?: Db };

const memoryDriver = (): Driver => ({
  name: "memory",
  async load() {
    return globalStore.__clearedDb ?? null;
  },
  async save(db) {
    globalStore.__clearedDb = db;
  },
});

const FILE_PATH = path.join(process.cwd(), ".data", "db.json");

const fileDriver = (): Driver => ({
  name: "file",
  async load() {
    try {
      return JSON.parse(await fs.readFile(FILE_PATH, "utf8")) as Db;
    } catch {
      return null;
    }
  },
  async save(db) {
    await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
    await fs.writeFile(FILE_PATH, JSON.stringify(db, null, 2));
  },
});

const REDIS_KEY = "cleared:db";

const redisDriver = (): Driver => {
  let clientPromise: Promise<{
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown): Promise<unknown>;
  }> | null = null;
  const client = () =>
    (clientPromise ??= import("@upstash/redis").then(({ Redis }) =>
      Redis.fromEnv(),
    ));
  return {
    name: "redis",
    async load() {
      return (await client()).get<Db>(REDIS_KEY);
    },
    async save(db) {
      await (await client()).set(REDIS_KEY, db);
    },
  };
};

function pickDriver(): Driver {
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return redisDriver();
  }
  if (process.env.NODE_ENV === "test") return memoryDriver();
  if (process.env.VERCEL) return memoryDriver();
  return fileDriver();
}

let driverInstance: Driver | null = null;
const driver = () => (driverInstance ??= pickDriver());

export const storageKind = () => driver().name;

/** Load the database, seeding rubric + demo data on first run. */
export async function getDb(): Promise<Db> {
  let db = await driver().load();
  if (!db || db.rubrics.length === 0) {
    db = db ?? emptyDb();
    const { seedInto } = await import("./seed");
    await seedInto(db, { demoData: process.env.SEED_DEMO_DATA !== "0" });
    await driver().save(db);
  }
  return db;
}

/** Read-modify-write helper. Single-writer semantics per instance. */
export async function mutate<T>(fn: (db: Db) => T | Promise<T>): Promise<T> {
  const db = await getDb();
  const result = await fn(db);
  await driver().save(db);
  return result;
}

/** Test-only: reset the in-memory database. */
export async function resetStoreForTests(seedDemoData = false): Promise<Db> {
  const db = emptyDb();
  const { seedInto } = await import("./seed");
  await seedInto(db, { demoData: seedDemoData });
  globalStore.__clearedDb = db;
  driverInstance = memoryDriver();
  return db;
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
}

export async function createSubmission(input: SubmissionInput) {
  return mutate((db) => {
    let document = input.documentId
      ? db.documents.find((d) => d.id === input.documentId)
      : undefined;
    const now = new Date().toISOString();
    if (!document) {
      document = {
        id: newId("doc"),
        title: input.title || "Untitled document",
        author: input.author,
        createdAt: now,
      };
      db.documents.push(document);
    }
    const number =
      db.versions.filter((v) => v.documentId === document.id).length + 1;
    const version: DocVersion = {
      id: newId("ver"),
      documentId: document.id,
      number,
      content: input.content,
      createdAt: now,
    };
    db.versions.push(version);
    const run: ReviewRun = {
      id: newId("run"),
      documentId: document.id,
      versionId: version.id,
      status: "queued",
      reviewer: input.reviewer,
      rubricVersion: publishedRubric(db).version,
      result: null,
      error: null,
      createdAt: now,
      finishedAt: null,
    };
    db.runs.push(run);
    return { document, version, run };
  });
}

export async function updateRun(
  runId: string,
  patch: Partial<Pick<ReviewRun, "status" | "result" | "error" | "finishedAt">>,
): Promise<ReviewRun | null> {
  return mutate((db) => {
    const run = db.runs.find((r) => r.id === runId);
    if (!run) return null;
    Object.assign(run, patch);
    return run;
  });
}

export interface DecisionInput {
  runId: string;
  officer: string;
  action: "approve" | "reject";
  note: string;
  overrides: FindingOverride[];
}

export async function addDecision(input: DecisionInput): Promise<Decision | null> {
  return mutate((db) => {
    const run = db.runs.find((r) => r.id === input.runId);
    if (!run) return null;
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
    db.decisions.push(decision);
    return decision;
  });
}

export async function saveRubricDraft(
  draft: RubricDraft,
  author: string,
): Promise<RubricVersion> {
  return mutate((db) => {
    const version: RubricVersion = {
      ...draft,
      version: Math.max(0, ...db.rubrics.map((r) => r.version)) + 1,
      author,
      createdAt: new Date().toISOString(),
      publishedAt: null,
      goldenGate: null,
    };
    db.rubrics.push(version);
    return version;
  });
}

export async function setGoldenGate(
  version: number,
  report: GoldenGateReport,
): Promise<RubricVersion | null> {
  return mutate((db) => {
    const rubric = db.rubrics.find((r) => r.version === version);
    if (!rubric) return null;
    rubric.goldenGate = report;
    return rubric;
  });
}

export async function publishRubric(version: number): Promise<RubricVersion | null> {
  return mutate((db) => {
    const rubric = db.rubrics.find((r) => r.version === version);
    if (!rubric || !rubric.goldenGate) return null;
    rubric.publishedAt = new Date().toISOString();
    return rubric;
  });
}

// ---------------------------------------------------------------------------
// Queries
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
