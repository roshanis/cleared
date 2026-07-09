import {
  createSerialQueue,
  UniqueViolationError,
  rowToDocument,
  documentToRow,
  rowToUser,
  userToRow,
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

// ---------------------------------------------------------------------------
// Pool — memoized on globalThis so it survives HMR
// ---------------------------------------------------------------------------

type GlobalWithPool = typeof globalThis & {
  __clearedPgPool?: import("pg").Pool;
};

async function getPool(): Promise<import("pg").Pool> {
  const g = globalThis as GlobalWithPool;
  if (g.__clearedPgPool) return g.__clearedPgPool;

  let pg: typeof import("pg");
  try {
    pg = (await import("pg")).default as unknown as typeof import("pg");
    // pg is CommonJS; the default export IS the module
    if (!pg.Pool) {
      const mod = await import("pg");
      pg = mod as unknown as typeof import("pg");
    }
  } catch {
    throw new Error(
      "pg package not found — npm install pg, or set DATABASE_URL to a Postgres URL",
    );
  }

  const connectionString =
    process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";

  // Enable SSL unless the host is localhost or sslmode=disable is in the URL
  const isLocal =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1") ||
    connectionString.includes("sslmode=disable");

  const pool = new pg.Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10_000,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  g.__clearedPgPool = pool;
  return pool;
}

// ---------------------------------------------------------------------------
// Schema DDL for Postgres (adds BIGSERIAL seq for insertion-order snapshot)
// ---------------------------------------------------------------------------

const SCHEMA_DDL = `
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rubrics (
    seq          BIGSERIAL,
    version      INTEGER PRIMARY KEY,
    author       TEXT NOT NULL,
    criteria     TEXT NOT NULL,
    fail_on      TEXT NOT NULL,
    golden_gate  TEXT,
    created_at   TEXT NOT NULL,
    published_at TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    seq          BIGSERIAL,
    id           TEXT PRIMARY KEY,
    email        TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role         TEXT NOT NULL,
    status       TEXT NOT NULL,
    session_gen  INTEGER NOT NULL,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS documents (
    seq        BIGSERIAL,
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    author     TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS versions (
    seq         BIGSERIAL,
    id          TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id),
    number      INTEGER NOT NULL,
    author      TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    UNIQUE(document_id, number)
  );

  CREATE TABLE IF NOT EXISTS runs (
    seq            BIGSERIAL,
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
    jurisdictions  TEXT,
    actor_id       TEXT
  );

  CREATE TABLE IF NOT EXISTS decisions (
    seq         BIGSERIAL,
    id          TEXT PRIMARY KEY,
    run_id      TEXT NOT NULL UNIQUE REFERENCES runs(id),
    document_id TEXT NOT NULL REFERENCES documents(id),
    officer     TEXT NOT NULL,
    action      TEXT NOT NULL,
    note        TEXT NOT NULL,
    overrides   TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    actor_id    TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_runs_version_created
    ON runs(rubric_version, created_at);

  INSERT INTO meta(key, value) VALUES ('schema_version', '3')
    ON CONFLICT (key) DO NOTHING;

  -- v1 -> v2 guarded migration: add runs.jurisdictions to older databases.
  ALTER TABLE runs ADD COLUMN IF NOT EXISTS jurisdictions TEXT;

  -- v2 -> v3 guarded migration: users and actor attribution.
  ALTER TABLE runs ADD COLUMN IF NOT EXISTS actor_id TEXT;
  ALTER TABLE decisions ADD COLUMN IF NOT EXISTS actor_id TEXT;
  UPDATE meta SET value = '3'
    WHERE key = 'schema_version' AND value IN ('1', '2');
`;

// ---------------------------------------------------------------------------
// Tx factory — wraps a pg.PoolClient with $1…$n placeholders
// ---------------------------------------------------------------------------

function makeTx(client: import("pg").PoolClient): Tx {
  // Helper: execute a parameterized query, return first row or null
  async function queryOne<T extends SqlRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    const res = await client.query(sql, params as import("pg").QueryConfigValues<string[]>);
    return (res.rows[0] as T | undefined) ?? null;
  }

  async function queryAll<T extends SqlRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const res = await client.query(sql, params as import("pg").QueryConfigValues<string[]>);
    return res.rows as T[];
  }

  async function queryRun(sql: string, params: unknown[] = []): Promise<void> {
    await client.query(sql, params as import("pg").QueryConfigValues<string[]>);
  }

  return {
    async createUser(user) {
      const r = userToRow(user);
      try {
        await queryRun(
          "INSERT INTO users(id, email, display_name, role, status, session_gen, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
          [
            r.id,
            r.email,
            r.display_name,
            r.role,
            r.status,
            r.session_gen,
            r.created_at,
            r.updated_at,
          ],
        );
      } catch (err) {
        mapUniqueOrThrow(err);
      }
    },

    async getUserByEmail(email) {
      const row = await queryOne("SELECT * FROM users WHERE email = $1", [
        email.trim().toLowerCase(),
      ]);
      return row ? rowToUser(row) : null;
    },

    async getUserById(id) {
      const row = await queryOne("SELECT * FROM users WHERE id = $1", [id]);
      return row ? rowToUser(row) : null;
    },

    async listUsers() {
      return (await queryAll("SELECT * FROM users ORDER BY seq")).map(rowToUser);
    },

    async updateUser(id, patch) {
      const fields: string[] = [];
      const values: unknown[] = [];
      let p = 1;
      if (patch.displayName !== undefined) {
        fields.push(`display_name=$${p++}`);
        values.push(patch.displayName);
      }
      if (patch.role !== undefined) {
        fields.push(`role=$${p++}`);
        values.push(patch.role);
      }
      if (patch.status !== undefined) {
        fields.push(`status=$${p++}`);
        values.push(patch.status);
      }
      if (patch.sessionGen !== undefined) {
        fields.push(`session_gen=$${p++}`);
        values.push(patch.sessionGen);
      }
      fields.push(`updated_at=$${p++}`);
      values.push(new Date().toISOString());
      values.push(id);
      const row = await queryOne(
        `UPDATE users SET ${fields.join(", ")} WHERE id=$${p} RETURNING *`,
        values,
      );
      return row ? rowToUser(row) : null;
    },

    async getDocument(id) {
      const row = await queryOne(
        "SELECT * FROM documents WHERE id = $1",
        [id],
      );
      return row ? rowToDocument(row) : null;
    },

    async nextVersionNumber(documentId) {
      const row = await queryOne<{ max_num: string | null }>(
        "SELECT MAX(number) AS max_num FROM versions WHERE document_id = $1",
        [documentId],
      );
      return (row?.max_num ? parseInt(row.max_num, 10) : 0) + 1;
    },

    async getVersion(id) {
      const row = await queryOne("SELECT * FROM versions WHERE id = $1", [id]);
      return row ? rowToVersion(row) : null;
    },

    async getRun(id) {
      const row = await queryOne("SELECT * FROM runs WHERE id = $1", [id]);
      return row ? rowToRun(row) : null;
    },

    async getRubric(version) {
      const row = await queryOne(
        "SELECT * FROM rubrics WHERE version = $1",
        [version],
      );
      return row ? rowToRubric(row) : null;
    },

    async latestPublishedRubric() {
      const row = await queryOne(
        "SELECT * FROM rubrics WHERE published_at IS NOT NULL ORDER BY version DESC LIMIT 1",
      );
      return row ? rowToRubric(row) : null;
    },

    async maxRubricVersion() {
      const row = await queryOne<{ max_v: string | null }>(
        "SELECT MAX(version) AS max_v FROM rubrics",
      );
      return row?.max_v ? parseInt(row.max_v, 10) : 0;
    },

    async getDecisionByRunId(runId) {
      const row = await queryOne(
        "SELECT * FROM decisions WHERE run_id = $1",
        [runId],
      );
      return row ? rowToDecision(row) : null;
    },

    async clearAll() {
      await queryRun("TRUNCATE decisions, runs, versions, documents, rubrics, users CASCADE");
    },

    async insertDocument(document) {
      const r = documentToRow(document);
      try {
        await queryRun(
          "INSERT INTO documents(id, title, author, created_at) VALUES ($1, $2, $3, $4)",
          [r.id, r.title, r.author, r.created_at],
        );
      } catch (err) {
        mapUniqueOrThrow(err);
      }
    },

    async insertVersion(version) {
      const r = versionToRow(version);
      try {
        await queryRun(
          "INSERT INTO versions(id, document_id, number, author, content, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
          [r.id, r.document_id, r.number, r.author, r.content, r.created_at],
        );
      } catch (err) {
        mapUniqueOrThrow(err);
      }
    },

    async insertRun(run) {
      const r = runToRow(run);
      try {
        await queryRun(
          "INSERT INTO runs(id, document_id, version_id, status, reviewer, rubric_version, result, error, created_at, finished_at, jurisdictions, actor_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
          [
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
            r.actor_id,
          ],
        );
      } catch (err) {
        mapUniqueOrThrow(err);
      }
    },

    async claimRun(id) {
      const row = await queryOne(
        "UPDATE runs SET status='reviewing', error=NULL WHERE id=$1 AND status IN ('queued','error') RETURNING *",
        [id],
      );
      return row ? rowToRun(row) : null;
    },

    async updateRun(id, patch) {
      const fields: string[] = [];
      const values: unknown[] = [];
      let p = 1;
      if (patch.status !== undefined) {
        fields.push(`status=$${p++}`);
        values.push(patch.status);
      }
      if ("result" in patch) {
        fields.push(`result=$${p++}`);
        values.push(
          patch.result === null ? null : JSON.stringify(patch.result),
        );
      }
      if ("error" in patch) {
        fields.push(`error=$${p++}`);
        values.push(patch.error);
      }
      if ("finishedAt" in patch) {
        fields.push(`finished_at=$${p++}`);
        values.push(patch.finishedAt);
      }
      if (fields.length === 0) {
        return queryOne("SELECT * FROM runs WHERE id=$1", [id]).then((r) =>
          r ? rowToRun(r) : null,
        );
      }
      values.push(id);
      const row = await queryOne(
        `UPDATE runs SET ${fields.join(", ")} WHERE id=$${p} RETURNING *`,
        values,
      );
      return row ? rowToRun(row) : null;
    },

    async insertDecision(decision) {
      const r = decisionToRow(decision);
      try {
        await queryRun(
          "INSERT INTO decisions(id, run_id, document_id, officer, action, note, overrides, created_at, actor_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
          [
            r.id,
            r.run_id,
            r.document_id,
            r.officer,
            r.action,
            r.note,
            r.overrides,
            r.created_at,
            r.actor_id,
          ],
        );
      } catch (err) {
        mapUniqueOrThrow(err);
      }
    },

    async insertRubric(rubric) {
      const r = rubricToRow(rubric);
      try {
        await queryRun(
          "INSERT INTO rubrics(version, author, criteria, fail_on, golden_gate, created_at, published_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [
            r.version,
            r.author,
            r.criteria,
            r.fail_on,
            r.golden_gate,
            r.created_at,
            r.published_at,
          ],
        );
      } catch (err) {
        mapUniqueOrThrow(err);
      }
    },

    async updateRubric(version, patch) {
      const fields: string[] = [];
      const values: unknown[] = [];
      let p = 1;
      if ("goldenGate" in patch) {
        fields.push(`golden_gate=$${p++}`);
        values.push(
          patch.goldenGate === null ? null : JSON.stringify(patch.goldenGate),
        );
      }
      if ("publishedAt" in patch) {
        fields.push(`published_at=$${p++}`);
        values.push(patch.publishedAt);
      }
      if (fields.length === 0) {
        return queryOne("SELECT * FROM rubrics WHERE version=$1", [version]).then(
          (r) => (r ? rowToRubric(r) : null),
        );
      }
      values.push(version);
      const row = await queryOne(
        `UPDATE rubrics SET ${fields.join(", ")} WHERE version=$${p} RETURNING *`,
        values,
      );
      return row ? rowToRubric(row) : null;
    },
  };
}

function mapUniqueOrThrow(err: unknown): never {
  if (isUniqueViolation(err)) {
    throw new UniqueViolationError(
      err instanceof Error ? err.message : "unique constraint violation",
    );
  }
  throw err;
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as Record<string, unknown>;
  return e.code === "23505";
}

// ---------------------------------------------------------------------------
// Driver factory
// ---------------------------------------------------------------------------

export function createPostgresDriver(): StoreDriver {
  // Postgres transactions are not serialized in-process (the DB handles
  // concurrency), but we still use a serial queue for snapshot() so the
  // returned arrays reflect a single consistent point in time.
  const snapshotQueue = createSerialQueue();

  return {
    kind: "postgres",

    async init(): Promise<void> {
      const pool = await getPool();
      const client = await pool.connect();
      try {
        await client.query(SCHEMA_DDL);
      } finally {
        client.release();
      }
    },

    snapshot(): Promise<Db> {
      return snapshotQueue(async () => {
        const pool = await getPool();
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const [users, docs, vers, runs, decs, rubs] = await Promise.all([
            client
              .query("SELECT * FROM users ORDER BY seq")
              .then((r) => r.rows.map(rowToUser)),
            client
              .query("SELECT * FROM documents ORDER BY seq")
              .then((r) => r.rows.map(rowToDocument)),
            client
              .query("SELECT * FROM versions ORDER BY seq")
              .then((r) => r.rows.map(rowToVersion)),
            client
              .query("SELECT * FROM runs ORDER BY seq")
              .then((r) => r.rows.map(rowToRun)),
            client
              .query("SELECT * FROM decisions ORDER BY seq")
              .then((r) => r.rows.map(rowToDecision)),
            client
              .query("SELECT * FROM rubrics ORDER BY seq")
              .then((r) => r.rows.map(rowToRubric)),
          ]);
          await client.query("COMMIT");
          return {
            users,
            documents: docs,
            versions: vers,
            runs: runs,
            decisions: decs,
            rubrics: rubs,
          };
        } catch (err) {
          await client.query("ROLLBACK");
          throw err;
        } finally {
          client.release();
        }
      });
    },

    async transact<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      const pool = await getPool();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(makeTx(client));
        await client.query("COMMIT");
        return result;
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // ignore rollback errors
        }
        throw err;
      } finally {
        client.release();
      }
    },
  };
}
