import { describe, expect, it } from "vitest";
import { canAccessDocument, ownsDocument } from "./access";
import type { Session } from "./session";
import type { DocumentRecord } from "./store";

const author = (over: Partial<Session> = {}): Session => ({
  personaId: "usr_a",
  userId: "usr_a",
  name: "John Smith",
  email: "a@example.com",
  role: "author",
  authMethod: "oauth",
  gen: 0,
  ...over,
});

const doc = (over: Partial<DocumentRecord> = {}): DocumentRecord => ({
  id: "doc_1",
  title: "Q3 letter",
  author: "John Smith",
  authorId: "usr_a",
  createdAt: "2026-07-01T00:00:00.000Z",
  ...over,
});

describe("document ownership", () => {
  it("keys on the stable user id, not the display name", () => {
    const impostor = author({ userId: "usr_b", personaId: "usr_b" });
    expect(canAccessDocument(author(), doc())).toBe(true);
    expect(canAccessDocument(impostor, doc())).toBe(false);
  });

  it("falls back to the author name only for legacy rows without an id", () => {
    const legacy = doc({ authorId: null });
    expect(ownsDocument(author(), legacy)).toBe(true);
    expect(ownsDocument(author({ name: "Someone Else" }), legacy)).toBe(false);
  });

  it("non-author roles retain full access", () => {
    const officer = author({ role: "officer", userId: "usr_z" });
    expect(canAccessDocument(officer, doc())).toBe(true);
  });
});
