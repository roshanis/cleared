import type { Session } from "./session";
import type { Db, DocumentRecord, ReviewRun } from "./store";

export function canAccessDocument(
  session: Session,
  document: DocumentRecord | null | undefined,
): document is DocumentRecord {
  if (!document) return false;
  return session.role !== "author" || document.author === session.name;
}

export function documentForRun(
  db: Db,
  run: ReviewRun,
): DocumentRecord | undefined {
  return db.documents.find((document) => document.id === run.documentId);
}

export function canAccessRun(
  session: Session,
  db: Db,
  run: ReviewRun,
): boolean {
  return canAccessDocument(session, documentForRun(db, run));
}
