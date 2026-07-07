import { mkdirSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync, StatementSync } from "node:sqlite";
import {
  createSerialQueue,
  UniqueViolationError,
  rowToDocument,
  documentToRow,
  rowToVersion,
  versionToRow,
  rowToRun,
  runToRow,
  rowToDecision,
  decisionToRow,
  rowToRubric,
  rubricToRow,
  type SqlRow,
  type StoreDriver,
  type Tx,
} from "./driver";
import type { Db } from "@/lib/store";

export const DEFAULT_SQLITE_PATH = path.join(process.cwd(), ".data", "app.db");

// ---------------------------------------------------------------------------
// HMR-safe memoization: one DatabaseSync handle per absolute file path,
// stored on globalThis so hot-module-reloads reuse the same connection.
// ---------------------------------------------------------------------------

type GlobalWithHandles = typeof globalThis & {
  __clearedSqliteHandles?: Map<string, DatabaseSync>;
};

function getHandleMap(): Map<string, DatabaseSync> {
  const g = globalThis as GlobalWithHandles;
  if (!g.__clearedSqliteHandles) {
    g.__clearedSqliteHandles = new Map();
  }
  return g.__clearedSqliteHandles;
}

// ---------------------------------------------------------------------------
// Schema DDL — idempotent, runs on every init().
// ---------------------------------------------------------------------------

const SCHEMA_DDL = `
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rubrics (
    version      INTEGER PRIMARY KEY,
    author       TEXT NOT NULL,
    criteria     TEXT NOT NULL,
    fail_on      TEXT NOT NULL,
    golden_gate  TEXT,
    created_at   TEXT NOT NULL,
    published_at TEXT
  );

  CREATE TABLE IF NOT EXISTS documents (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    author     TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS versions (
    id          TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id),
    number      INTEGER NOT NULL,
    author      TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    UNIQUE(document_id, number)
  );

  CREATE TABLE IF NOT EXISTS runs (
    id             TEXT PRIMARY KEY,
    document_id    TEXT NOT NULL REFERENCES documents(id),
    version_id     TEXT NOT NULL REFERENCES versions(id),
    status         TEXT NOT NULL,
    reviewer       TEXT NOT NULL,
    rubric_version INTEGER NOT NULL REFERENCES rubrics(version),
    result         TEXT,
    error          TEXT,
    created_at     TEXT NOT NULL,
    finished_at    TEXT,
    jurisdictions  TEXT
  );

  CREATE TABLE IF NOT EXISTS decisions (
    id          TEXT PRIMARY KEY,
    run_id      TEXT NOT NULL UNIQUE REFERENCES runs(id),
    document_id TEXT NOT NULL REFERENCES documents(id),
    officer     TEXT NOT NULL,
    action      TEXT NOT NULL,
    note        TEXT NOT NULL,
    overrides   TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_runs_version_created
    ON runs(rubric_version, created_at);

  INSERT OR IGNORE INTO meta(key, value) VALUES ('schema_version', '2');
`;

/** v1 -> v2: pre-jurisdiction databases lack runs.jurisdictions. */
function migrate(instance: InstanceType<typeof import("node:sqlite").DatabaseSync>) {
  const row = instance
    .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
    .get() as { value?: string } | undefined;
  if (row?.value === "1") {
    instance.exec("ALTER TABLE runs ADD COLUMN jurisdictions TEXT");
    instance.exec("UPDATE meta SET value = '2' WHERE key = 'schema_version'");
  }
}

// ---------------------------------------------------------------------------
// Unique-constraint detection
// ---------------------------------------------------------------------------

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as Record<string, unknown>;
  // node:sqlite exposes numeric errcode on the thrown error
  if (e.errcode === 2067 || e.errcode === 1555) return true;
  // Fallback: match the well-known SQLite error message prefix
  if (
    typeof e.message === "string" &&
    e.message.includes("UNIQUE constraint failed")
  )
    return true;
  return false;
}

function mapUniqueOrThrow(err: unknown): never {
  if (isUniqueViolation(err)) {
    throw new UniqueViolationError(
      err instanceof Error ? err.message : "unique constraint violation",
    );
  }
  throw err;
}

// ---------------------------------------------------------------------------
// Tx factory — wraps a DatabaseSync in the Tx interface.
// Every method is a single prepared statement; all SQLite calls are sync but
// we return Promises so the interface is uniform with the other drivers.
// ---------------------------------------------------------------------------

function makeTx(db: DatabaseSync): Tx {
  // Helper: shorthand for prepare-then-get/all/run
  const stmt = (sql: string): StatementSync => db.prepare(sql);

  return {
    async getDocument(id) {
      const row = stmt("SELECT * FROM documents WHERE id = ?").get(id);
      return row ? rowToDocument(row as SqlRow) : null;
    },

    async nextVersionNumber(documentId) {
      const row = stmt(
        "SELECT MAX(number) AS max_num FROM versions WHERE document_id = ?",
      ).get(documentId) as { max_num: number | null } | undefined;
      return (row?.max_num ?? 0) + 1;
    },

    async getVersion(id) {
      const row = stmt("SELECT * FROM versions WHERE id = ?").get(id);
      return row ? rowToVersion(row as SqlRow) : null;
    },

    async getRun(id) {
      const row = stmt("SELECT * FROM runs WHERE id = ?").get(id);
      return row ? rowToRun(row as SqlRow) : null;
    },

    async getRubric(version) {
      const row = stmt("SELECT * FROM rubrics WHERE version = ?").get(version);
      return row ? rowToRubric(row as SqlRow) : null;
    },

    async latestPublishedRubric() {
      const row = stmt(
        "SELECT * FROM rubrics WHERE published_at IS NOT NULL ORDER BY version DESC LIMIT 1",
      ).get();
      return row ? rowToRubric(row as SqlRow) : null;
    },

    async maxRubricVersion() {
      const row = stmt("SELECT MAX(version) AS max_v FROM rubrics").get() as
        | { max_v: number | null }
        | undefined;
      return row?.max_v ?? 0;
    },

    async getDecisionByRunId(runId) {
      const row = stmt(
        "SELECT * FROM decisions WHERE run_id = ?",
      ).get(runId);
      return row ? rowToDecision(row as SqlRow) : null;
    },

    async clearAll() {
      stmt("DELETE FROM decisions").run();
      stmt("DELETE FROM runs").run();
      stmt("DELETE FROM versions").run();
      stmt("DELETE FROM documents").run();
      stmt("DELETE FROM rubrics").run();
    },

    async insertDocument(document) {
      const r = documentToRow(document);
      try {
        stmt(
          "INSERT INTO documents(id, title, author, created_at) VALUES (?, ?, ?, ?)",
        ).run(r.id, r.title, r.author, r.created_at);
      } catch (err) {
        mapUniqueOrThrow(err);
      }
    },

    async insertVersion(version) {
      const r = versionToRow(version);
      try {
        stmt(
          "INSERT INTO versions(id, document_id, number, author, content, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        ).run(
          r.id,
          r.document_id,
          r.number,
          r.author,
          r.content,
          r.created_at,
        );
      } catch (err) {
        mapUniqueOrThrow(err);
      }
    },

    async insertRun(run) {
      const r = runToRow(run);
      try {
        stmt(
          "INSERT INTO runs(id, document_id, version_id, status, reviewer, rubric_version, result, error, created_at, finished_at, jurisdictions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).run(
          r.id,
          r.document_id,
          r.version_id,
          r.status,
          r.reviewer,
          r.rubric_version,
          r.result,
          r.error,
          r.created_at,
          r.finished_at,
          r.jurisdictions,
        );
      } catch (err) {
        mapUniqueOrThrow(err);
      }
    },

    async claimRun(id) {
      // Atomic: only transitions queued|error → reviewing.
      const row = stmt(
        "UPDATE runs SET status='reviewing', error=NULL WHERE id=? AND status IN ('queued','error') RETURNING *",
      ).get(id);
      return row ? rowToRun(row as SqlRow) : null;
    },

    async updateRun(id, patch) {
      const fields: string[] = [];
      const values: unknown[] = [];
      if (patch.status !== undefined) {
        fields.push("status=?");
        values.push(patch.status);
      }
      if ("result" in patch) {
        fields.push("result=?");
        values.push(
          patch.result === null ? null : JSON.stringify(patch.result),
        );
      }
      if ("error" in patch) {
        fields.push("error=?");
        values.push(patch.error);
      }
      if ("finishedAt" in patch) {
        fields.push("finished_at=?");
        values.push(patch.finishedAt);
      }
      if (fields.length === 0) {
        const row = stmt("SELECT * FROM runs WHERE id=?").get(id);
        return row ? rowToRun(row as SqlRow) : null;
      }
      values.push(id);
      const row = stmt(
        `UPDATE runs SET ${fields.join(", ")} WHERE id=? RETURNING *`,
      ).get(...(values as Parameters<StatementSync["get"]>));
      return row ? rowToRun(row as SqlRow) : null;
    },

    async insertDecision(decision) {
      const r = decisionToRow(decision);
      try {
        stmt(
          "INSERT INTO decisions(id, run_id, document_id, officer, action, note, overrides, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ).run(
          r.id,
          r.run_id,
          r.document_id,
          r.officer,
          r.action,
          r.note,
          r.overrides,
          r.created_at,
        );
      } catch (err) {
        mapUniqueOrThrow(err);
      }
    },

    async insertRubric(rubric) {
      const r = rubricToRow(rubric);
      try {
        stmt(
          "INSERT INTO rubrics(version, author, criteria, fail_on, golden_gate, created_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ).run(
          r.version,
          r.author,
          r.criteria,
          r.fail_on,
          r.golden_gate,
          r.created_at,
          r.published_at,
        );
      } catch (err) {
        mapUniqueOrThrow(err);
      }
    },

    async updateRubric(version, patch) {
      const fields: string[] = [];
      const values: unknown[] = [];
      if ("goldenGate" in patch) {
        fields.push("golden_gate=?");
        values.push(
          patch.goldenGate === null ? null : JSON.stringify(patch.goldenGate),
        );
      }
      if ("publishedAt" in patch) {
        fields.push("published_at=?");
        values.push(patch.publishedAt);
      }
      if (fields.length === 0) {
        const row = stmt("SELECT * FROM rubrics WHERE version=?").get(version);
        return row ? rowToRubric(row as SqlRow) : null;
      }
      values.push(version);
      const row = stmt(
        `UPDATE rubrics SET ${fields.join(", ")} WHERE version=? RETURNING *`,
      ).get(...(values as Parameters<StatementSync["get"]>));
      return row ? rowToRubric(row as SqlRow) : null;
    },
  };
}

// ---------------------------------------------------------------------------
// Driver factory
// ---------------------------------------------------------------------------

/** Local durable driver on the built-in node:sqlite (Node >= 22.5). */
export function createSqliteDriver(
  filePath: string = DEFAULT_SQLITE_PATH,
): StoreDriver {
  const enqueue = createSerialQueue();
  let db: DatabaseSync | null = null;

  async function openDb(): Promise<DatabaseSync> {
    if (db) return db;

    const handles = getHandleMap();
    const cached = handles.get(filePath);
    if (cached) {
      db = cached;
      return db;
    }

    let DatabaseSync: (new (path: string) => DatabaseSync) | undefined;
    try {
      const mod = await import("node:sqlite");
      DatabaseSync = mod.DatabaseSync as unknown as new (
        path: string,
      ) => DatabaseSync;
    } catch {
      throw new Error(
        "Node >= 22.5 required for local SQLite, or set DATABASE_URL",
      );
    }

    mkdirSync(path.dirname(filePath), { recursive: true });

    const instance = new DatabaseSync!(filePath);

    // Set connection-level PRAGMAs (WAL is also persisted to the file).
    instance.exec("PRAGMA journal_mode=WAL");
    instance.exec("PRAGMA busy_timeout=5000");
    instance.exec("PRAGMA foreign_keys=ON");

    // Bootstrap schema (idempotent), then apply guarded migrations.
    instance.exec(SCHEMA_DDL);
    migrate(instance);

    db = instance;
    handles.set(filePath, instance);
    return db;
  }

  return {
    kind: "sqlite",

    async init(): Promise<void> {
      await enqueue(() => openDb());
    },

    snapshot(): Promise<Db> {
      return enqueue(async () => {
        const d = await openDb();
        return {
          documents: (
            d
              .prepare("SELECT * FROM documents ORDER BY rowid")
              .all() as SqlRow[]
          ).map(rowToDocument),
          versions: (
            d
              .prepare("SELECT * FROM versions ORDER BY rowid")
              .all() as SqlRow[]
          ).map(rowToVersion),
          runs: (
            d.prepare("SELECT * FROM runs ORDER BY rowid").all() as SqlRow[]
          ).map(rowToRun),
          decisions: (
            d
              .prepare("SELECT * FROM decisions ORDER BY rowid")
              .all() as SqlRow[]
          ).map(rowToDecision),
          rubrics: (
            d.prepare("SELECT * FROM rubrics ORDER BY rowid").all() as SqlRow[]
          ).map(rowToRubric),
        };
      });
    },

    transact<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return enqueue(async () => {
        const d = await openDb();
        d.exec("BEGIN IMMEDIATE");
        try {
          const result = await fn(makeTx(d));
          d.exec("COMMIT");
          return result;
        } catch (err) {
          try {
            d.exec("ROLLBACK");
          } catch {
            // Ignore rollback errors (e.g. if the transaction was already closed)
          }
          throw err;
        }
      });
    },
  };
}
