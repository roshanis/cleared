import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createSqliteDriver } from "./db/sqlite";
import { setDriverForTests } from "./db";
import { createSubmission, getDb, rerunVersion, resetStoreForTests, findSubmissionReplay } from "./store";

beforeEach(() => resetStoreForTests(false));
afterEach(() => vi.unstubAllEnvs());
const input = { title: "Review", content: "Content", author: "Author", actorId: "writer-1", reviewer: "heuristic" as const, jurisdictions: ["UK"], idempotencyKey: "same-request" };
describe("durable request identity", () => {
  it("persists a replay across SQLite driver instances", async () => {
    vi.stubEnv("SEED_DEMO_DATA", "0");
    const file = path.join(mkdtempSync(path.join(tmpdir(), "cleared-idempotency-")), "test.db");
    setDriverForTests(createSqliteDriver(file));
    const first = await createSubmission(input);
    setDriverForTests(createSqliteDriver(file));
    const replay = await createSubmission(input);
    expect(replay.run.id).toBe(first.run.id);
    expect((await getDb()).documents).toHaveLength(1);
    expect((await getDb()).runs).toHaveLength(1);
  });
  it("concurrent retries produce one document, version and run", async () => {
    const results = await Promise.all([createSubmission(input), createSubmission(input)]);
    expect(results[0].run.id).toBe(results[1].run.id);
    const db = await getDb();
    expect(db.documents).toHaveLength(1); expect(db.versions).toHaveLength(1); expect(db.runs).toHaveLength(1);
    expect((await findSubmissionReplay(input))?.run.id).toBe(results[0].run.id);
  });
  it("rejects a reused request with changed content or markets", async () => {
    await createSubmission(input);
    await expect(createSubmission({ ...input, content: "Different" })).rejects.toThrow("different request");
    await expect(createSubmission({ ...input, jurisdictions: ["US"] })).rejects.toThrow("different request");
    expect((await getDb()).runs).toHaveLength(1);
  });
  it("scopes keys to the actor and permits intentional new requests", async () => {
    const first = await createSubmission(input);
    const other = await createSubmission({ ...input, actorId: "writer-2" });
    const fresh = await createSubmission({ ...input, idempotencyKey: "next-request" });
    expect(new Set([first.run.id, other.run.id, fresh.run.id]).size).toBe(3);
  });
  it("rejects turning a new-document retry into a revision request", async () => {
    const first = await createSubmission(input);
    await expect(createSubmission({ ...input, documentId: first.document.id })).rejects.toThrow("different request");
    expect((await getDb()).runs).toHaveLength(1);
  });
  it("makes retrying the same rerun request idempotent", async () => {
    const original = await createSubmission(input);
    const args = { versionId: original.version.id, reviewer: "heuristic" as const, actorId: "writer-1", sourceRunId: original.run.id, idempotencyKey: "rerun-key" };
    const [a,b] = await Promise.all([rerunVersion(args), rerunVersion(args)]);
    expect(a.status).toBe("created"); expect(b.status).toBe("created");
    if (a.status === "created" && b.status === "created") expect(a.run.id).toBe(b.run.id);
    expect((await getDb()).runs).toHaveLength(2);
  });
});
