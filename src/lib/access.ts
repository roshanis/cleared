import type { Session } from "./session";
import type { Db, DocumentRecord, ReviewRun } from "./store";

/**
 * Author ownership is keyed on the stable user id; display names are neither
 * unique nor verified. The name comparison only remains as a fallback for
 * legacy rows created before documents carried an author id.
 */
export function ownsDocument(
  session: Session,
  document: DocumentRecord,
): boolean {
  if (document.authorId != null) return document.authorId === session.userId;
  return document.author === session.name;
}

export function canAccessDocument(
  session: Session,
  document: DocumentRecord | null | undefined,
): document is DocumentRecord {
  if (!document) return false;
  return session.role !== "author" || ownsDocument(session, document);
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
