import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSubmission, resetStoreForTests, updateRun } from "@/lib/store";
import { POST } from "./route";

vi.mock("@/lib/session", () => ({ getSession: async () => ({ name: "Devon", userId: "officer-1", role: "officer" }) }));
beforeEach(() => resetStoreForTests(false));

describe("coverage-gap decision contract", () => {
  it("rejects implicit approval and records an explicit acknowledgment", async () => {
    const { run } = await createSubmission({ title: "Incomplete", content: "Example", author: "Maya", reviewer: "heuristic" });
    await updateRun(run.id, { status: "done", result: { verdict: "needs_human_review", findings: [], summary: "Incomplete", coverage: [{ criterionId: "C8", status: "omitted", detail: "Not assessed" }] } });
    const request = (acknowledgedCoverageGaps?: string[]) => new Request("http://localhost/api/decisions", { method: "POST", headers: { origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify({ runId: run.id, action: "approve", note: "Independently checked the source evidence.", overrides: [], acknowledgedCoverageGaps }) });
    expect((await POST(request())).status).toBe(400);
    const acknowledged = await POST(request(["C8"]));
    expect(acknowledged.status).toBe(200);
    expect((await acknowledged.json()).decision.note).toContain("explicitly acknowledged");
  });
});
