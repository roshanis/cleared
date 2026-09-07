import { decisionForRun, latestRunForVersion, reviewQueue, type Db, type ReviewRun } from "./store";

export function documentHistory(db: Db, documentId: string) {
  return db.versions.filter(v => v.documentId === documentId)
    .sort((a, b) => b.number - a.number)
    .map(version => ({ version, runs: db.runs.filter(r => r.versionId === version.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)) }));
}

export function currentRun(db: Db, documentId: string): ReviewRun | null {
  const latest = documentHistory(db, documentId)[0];
  return latest ? latestRunForVersion(db, latest.version.id) : null;
}

export function selectRun(db: Db, documentId: string, runId?: string): ReviewRun | null {
  return runId ? db.runs.find(r => r.id === runId && r.documentId === documentId) ?? null : currentRun(db, documentId);
}

export function currentQueue(db: Db) {
  return reviewQueue(db).filter(item => currentRun(db, item.document.id)?.id === item.run.id);
}

export function runHref(documentId: string, runId: string) {
  return `/documents/${encodeURIComponent(documentId)}?run=${encodeURIComponent(runId)}`;
}

/** Inspection only: superseded runs never re-enter the actionable queue. */
export function undecidedHistory(db: Db) {
  return db.runs.filter(run => run.status === "done" && run.result && run.result.verdict !== "pass" && !decisionForRun(db, run.id))
    .flatMap(run => {
      const document = db.documents.find(d => d.id === run.documentId);
      const version = db.versions.find(v => v.id === run.versionId);
      return document && version ? [{ run, document, version }] : [];
    }).sort((a, b) => a.run.createdAt.localeCompare(b.run.createdAt));
}
