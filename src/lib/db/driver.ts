import type { ReviewResult } from "@/schema";
import type { ReviewerKind } from "@/agent/run";
import type { GoldenGateReport, RubricCriterion, RubricVersion, Severity } from "@/lib/rubric";
import type {
  Db,
  Decision,
  DocVersion,
  DocumentRecord,
  FindingOverride,
  ReviewRun,
  RunStatus,
} from "@/lib/store";

export type StorageKind = "memory" | "sqlite" | "postgres";

/** Normalized unique-constraint violation across all drivers. */
export class UniqueViolationError extends Error {
  constructor(message = "unique constraint violation") {
    super(message);
    this.name = "UniqueViolationError";
  }
}

export type RunPatch = Partial<
  Pick<ReviewRun, "status" | "result" | "error" | "finishedAt">
>;

export interface RubricPatch {
  goldenGate?: GoldenGateReport | null;
  publishedAt?: string | null;
}

/**
 * Per-entity primitives available inside a transaction. Every method is a
 * single statement; domain logic (validation, id generation) lives in
 * src/lib/store.ts on top of these.
 */
export interface Tx {
  getDocument(id: string): Promise<DocumentRecord | null>;
  nextVersionNumber(documentId: string): Promise<number>;
  getVersion(id: string): Promise<DocVersion | null>;
  getRun(id: string): Promise<ReviewRun | null>;
  getRubric(version: number): Promise<RubricVersion | null>;
  latestPublishedRubric(): Promise<RubricVersion | null>;
  maxRubricVersion(): Promise<number>;
  getDecisionByRunId(runId: string): Promise<Decision | null>;
  insertDocument(document: DocumentRecord): Promise<void>;
  /** Throws UniqueViolationError on a duplicate (document_id, number). */
  insertVersion(version: DocVersion): Promise<void>;
  insertRun(run: ReviewRun): Promise<void>;
  /**
   * Atomic claim: UPDATE … SET status='reviewing', error=NULL
   * WHERE id=? AND status IN ('queued','error') RETURNING *.
   * Returns the claimed run, or null when no transition happened.
   */
  claimRun(id: string): Promise<ReviewRun | null>;
  updateRun(id: string, patch: RunPatch): Promise<ReviewRun | null>;
  /** Throws UniqueViolationError on a duplicate run_id. */
  insertDecision(decision: Decision): Promise<void>;
  /** Throws UniqueViolationError on a duplicate version (primary key). */
  insertRubric(rubric: RubricVersion): Promise<void>;
  updateRubric(version: number, patch: RubricPatch): Promise<RubricVersion | null>;
}

export interface StoreDriver {
  kind: StorageKind;
  /** Idempotent: opens the store and bootstraps the schema. */
  init(): Promise<void>;
  /** Full snapshot of every table, insertion-ordered — the Db shape. */
  snapshot(): Promise<Db>;
  /** Run fn atomically; any throw rolls the whole unit of work back. */
  transact<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

// ---------------------------------------------------------------------------
// In-process serialization. Both the memory and sqlite drivers funnel all
// transactions (and snapshots — a single sqlite connection sees its own
// uncommitted writes) through one promise chain per driver instance.
// ---------------------------------------------------------------------------

export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = tail.then(work, work);
    tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };
}

// ---------------------------------------------------------------------------
// Row mappers — the ONE place snake_case columns and JSON TEXT blobs
// (result, overrides, criteria, fail_on, golden_gate) are translated to the
// existing camelCase domain types. Shared by the sqlite and postgres drivers.
// ---------------------------------------------------------------------------

export type SqlRow = Record<string, unknown>;

const text = (value: unknown): string => String(value);
const nullableText = (value: unknown): string | null =>
  value == null ? null : String(value);
const integer = (value: unknown): number => Number(value);
const json = <T>(value: unknown): T => JSON.parse(String(value)) as T;
const nullableJson = <T>(value: unknown): T | null =>
  value == null ? null : (JSON.parse(String(value)) as T);

export const rowToDocument = (row: SqlRow): DocumentRecord => ({
  id: text(row.id),
  title: text(row.title),
  author: text(row.author),
  createdAt: text(row.created_at),
});

export const documentToRow = (document: DocumentRecord) => ({
  id: document.id,
  title: document.title,
  author: document.author,
  created_at: document.createdAt,
});

export const rowToVersion = (row: SqlRow): DocVersion => ({
  id: text(row.id),
  documentId: text(row.document_id),
  number: integer(row.number),
  author: text(row.author),
  content: text(row.content),
  createdAt: text(row.created_at),
});

export const versionToRow = (version: DocVersion) => ({
  id: version.id,
  document_id: version.documentId,
  number: version.number,
  author: version.author,
  content: version.content,
  created_at: version.createdAt,
});

export const rowToRun = (row: SqlRow): ReviewRun => ({
  id: text(row.id),
  documentId: text(row.document_id),
  versionId: text(row.version_id),
  status: text(row.status) as RunStatus,
  reviewer: text(row.reviewer) as ReviewerKind,
  rubricVersion: integer(row.rubric_version),
  result: nullableJson<ReviewResult>(row.result),
  error: nullableText(row.error),
  createdAt: text(row.created_at),
  finishedAt: nullableText(row.finished_at),
});

export const runToRow = (run: ReviewRun) => ({
  id: run.id,
  document_id: run.documentId,
  version_id: run.versionId,
  status: run.status,
  reviewer: run.reviewer,
  rubric_version: run.rubricVersion,
  result: run.result === null ? null : JSON.stringify(run.result),
  error: run.error,
  created_at: run.createdAt,
  finished_at: run.finishedAt,
});

export const rowToDecision = (row: SqlRow): Decision => ({
  id: text(row.id),
  runId: text(row.run_id),
  documentId: text(row.document_id),
  officer: text(row.officer),
  action: text(row.action) as Decision["action"],
  note: text(row.note),
  overrides: json<FindingOverride[]>(row.overrides),
  createdAt: text(row.created_at),
});

export const decisionToRow = (decision: Decision) => ({
  id: decision.id,
  run_id: decision.runId,
  document_id: decision.documentId,
  officer: decision.officer,
  action: decision.action,
  note: decision.note,
  overrides: JSON.stringify(decision.overrides),
  created_at: decision.createdAt,
});

export const rowToRubric = (row: SqlRow): RubricVersion => ({
  version: integer(row.version),
  author: text(row.author),
  criteria: json<RubricCriterion[]>(row.criteria),
  failOn: json<Severity[]>(row.fail_on),
  goldenGate: nullableJson<GoldenGateReport>(row.golden_gate),
  createdAt: text(row.created_at),
  publishedAt: nullableText(row.published_at),
});

export const rubricToRow = (rubric: RubricVersion) => ({
  version: rubric.version,
  author: rubric.author,
  criteria: JSON.stringify(rubric.criteria),
  fail_on: JSON.stringify(rubric.failOn),
  golden_gate:
    rubric.goldenGate === null ? null : JSON.stringify(rubric.goldenGate),
  created_at: rubric.createdAt,
  published_at: rubric.publishedAt,
});
