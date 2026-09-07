import { describe, expect, it } from "vitest";
import { emptyDb, type ReviewRun } from "./store";
import { documentHistory, currentRun, currentQueue, selectRun, undecidedHistory } from "./review-workspace";

function fixture() {
  const db = emptyDb();
  db.documents.push({ id: "doc", title: "Sample", author: "Author", createdAt: "2026-01-01" });
  db.versions.push({ id: "v1", documentId: "doc", number: 1, content: "original", author: "Author", createdAt: "2026-01-01" });
  const run: ReviewRun = { id: "r1", documentId: "doc", versionId: "v1", status: "done", reviewer: "heuristic", rubricVersion: 1, result: { verdict: "fail", findings: [], summary: "Review" }, error: null, createdAt: "2026-01-01", finishedAt: "2026-01-01" };
  db.runs.push(run, { ...run, id: "r2", createdAt: "2026-01-02" }, { ...run, id: "r3", createdAt: "2026-01-03" });
  return db;
}
describe("review workspace", () => {
  it("allows historical inspection without putting superseded runs into current work", () => {
    const db = fixture();
    expect(undecidedHistory(db).map(item => item.run.id)).toEqual(["r1", "r2", "r3"]);
    expect(currentQueue(db).map(item => item.run.id)).toEqual(["r3"]);
  });
  it("preserves every run and opens the requested run", () => {
    const db = fixture();
    expect(documentHistory(db, "doc")[0].runs.map(r => r.id)).toEqual(["r3", "r2", "r1"]);
    expect(selectRun(db, "doc", "r1")?.id).toBe("r1");
    expect(selectRun(db, "other", "r1")).toBeNull();
    expect(selectRun(db, "doc", "missing")).toBeNull();
  });
  it("keeps superseded runs out of current work", () => {
    const db = fixture();
    expect(currentQueue(db).map(item => item.run.id)).toEqual(["r3"]);
    db.versions.push({ ...db.versions[0], id: "v2", number: 2 });
    expect(currentRun(db, "doc")).toBeNull();
    expect(currentQueue(db)).toEqual([]);
  });
});
