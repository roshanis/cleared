import { describe, expect, it } from "vitest";
import { readDraft, saveDraft, draftKey } from "./draft";

describe("draft recovery", () => {
  it("scopes drafts to the user and document, preserves market and request identity", () => {
    const values = new Map<string,string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key,value); }, removeItem: (key: string) => { values.delete(key); } };
    const key = draftKey("writer-a", "document");
    const draft = { title: "UK document", content: "Draft", markets: ["UK" as const], requestKey: "request-123", runId: "run-1", documentId: "document", savedAt: 100 };
    expect(saveDraft(storage, key, draft)).toBe(true);
    expect(readDraft(storage, key, 200)).toMatchObject(draft);
    expect(readDraft(storage, draftKey("writer-b", "document"), 200)).toBeNull();
    expect(readDraft(storage, key, 9 * 3600_000)).toBeNull();
    expect(values.has(key)).toBe(false);
  });
  it("handles unavailable storage and malformed drafts", () => {
    const storage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readDraft(storage, "key")).toBeNull();
    expect(saveDraft(storage, "key", {} as never)).toBe(false);
    expect(readDraft({ getItem: () => '{"markets":["invalid"]}' }, "key")).toBeNull();
  });
});
