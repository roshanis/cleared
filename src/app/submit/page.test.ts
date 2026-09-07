import { afterEach, beforeEach, expect, it, vi } from "vitest";
import React from "react";
import { createSubmission, resetStoreForTests } from "@/lib/store";
import SubmitPage from "./page";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/lib/session", () => ({ requireRole: async () => ({ name: "Maya", userId: "writer-1", role: "author" }) }));
beforeEach(() => { vi.stubGlobal("React", React); return resetStoreForTests(false); });
afterEach(() => vi.unstubAllGlobals());

it("does not silently turn a missing revision target into a new document", async () => {
  await expect(SubmitPage({ searchParams: Promise.resolve({ documentId: "missing" }) })).rejects.toThrow("NOT_FOUND");
});
it("does not expose another author's revision", async () => {
  const { document } = await createSubmission({ title: "Other", content: "Other author text", author: "Other", reviewer: "heuristic" });
  await expect(SubmitPage({ searchParams: Promise.resolve({ documentId: document.id }) })).rejects.toThrow("NOT_FOUND");
});
