import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { resetSubmissionRateLimiterForTests } from "@/lib/submission-rate-limiter";
import {
  createSubmission,
  getDb,
  resetStoreForTests,
  updateRun,
} from "@/lib/store";
import { POST } from "./route";

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(async (): Promise<unknown> => ({
    personaId: "maya",
    userId: "demo:maya",
    name: "Maya Chen",
    email: null,
    role: "author",
    authMethod: "demo",
    gen: 0,
  })),
}));

vi.mock("@/lib/session", () => ({
  getSession: getSessionMock,
}));

const rerunRequest = (id: string) =>
  new Request(`http://localhost/api/runs/${id}/rerun`, {
    method: "POST",
    headers: { origin: "http://localhost" },
  });

async function existingRun() {
  const { run, version } = await createSubmission({
    title: "Existing run",
    content: "This customer email promises guaranteed returns.",
    author: "Maya Chen",
    actorId: "demo:maya",
    reviewer: "heuristic",
    jurisdictions: ["US"],
  });
  await updateRun(run.id, {
    status: "done",
    result: {
      verdict: "pass",
      findings: [],
      summary: "Original review completed.",
    },
    error: null,
    finishedAt: "2026-07-01T00:00:00.000Z",
  });
  return { run, version };
}

beforeEach(async () => {
  await resetStoreForTests(false);
  resetSubmissionRateLimiterForTests();
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("DEMO_PUBLIC", "");
  vi.stubEnv("DEMO_PUBLIC_MODEL", "");
  vi.stubEnv("RATE_LIMIT_SUBMISSIONS", "");
  vi.stubEnv("RATE_LIMIT_WINDOW_MINUTES", "");
  getSessionMock.mockResolvedValue({
    personaId: "maya",
    userId: "demo:maya",
    name: "Maya Chen",
    email: null,
    role: "author",
    authMethod: "demo",
    gen: 0,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/runs/[id]/rerun", () => {
  it("returns 401 when unauthenticated", async () => {
    const { run } = await existingRun();
    getSessionMock.mockResolvedValueOnce(null);

    const res = await POST(rerunRequest(run.id), {
      params: Promise.resolve({ id: run.id }),
    });

    await expect(res.json()).resolves.toEqual({ error: "Sign in first." });
    expect(res.status).toBe(401);
  });

  it("returns 403 when an auditor tries to re-run a review", async () => {
    const { run } = await existingRun();
    getSessionMock.mockResolvedValueOnce({
      personaId: "sam",
      userId: "demo:sam",
      name: "Sam Osei",
      email: null,
      role: "auditor",
      authMethod: "demo",
      gen: 0,
    });

    const res = await POST(rerunRequest(run.id), {
      params: Promise.resolve({ id: run.id }),
    });

    await expect(res.json()).resolves.toEqual({
      error: "Auditors can't re-run reviews.",
    });
    expect(res.status).toBe(403);
  });

  it("returns 403 when an author tries to re-run another author's document", async () => {
    const { run } = await existingRun();
    getSessionMock.mockResolvedValueOnce({
      personaId: "wendy",
      userId: "usr_wendy",
      name: "Wendy Writer",
      email: "wendy@example.com",
      role: "author",
      authMethod: "oauth",
      gen: 0,
    });

    const res = await POST(rerunRequest(run.id), {
      params: Promise.resolve({ id: run.id }),
    });

    await expect(res.json()).resolves.toEqual({ error: "Not your review run." });
    expect(res.status).toBe(403);
  });

  it("re-runs the owning author's existing document version with a new run id", async () => {
    const { run, version } = await existingRun();

    const res = await POST(rerunRequest(run.id), {
      params: Promise.resolve({ id: run.id }),
    });
    const body = (await res.json()) as {
      status: string;
      runId: string;
      documentId: string;
      reviewer: string;
      reviewerNote: string | null;
    };
    const db = await getDb();
    const runsForVersion = db.runs.filter(
      (candidate) => candidate.versionId === version.id,
    );

    expect(res.status).toBe(200);
    expect(body.status).toBe("done");
    expect(body.runId).not.toBe(run.id);
    expect(body.documentId).toBe(run.documentId);
    expect(body.reviewer).toBe("heuristic");
    expect(body.reviewerNote).toBeNull();
    expect(runsForVersion).toHaveLength(2);
    expect(runsForVersion.some((candidate) => candidate.id === body.runId)).toBe(
      true,
    );
    expect(db.runs.find((candidate) => candidate.id === body.runId)?.status).toBe(
      "done",
    );
  });

  it("returns 409 when the source run is already reviewing", async () => {
    const { run } = await existingRun();
    await updateRun(run.id, { status: "reviewing" });

    const res = await POST(rerunRequest(run.id), {
      params: Promise.resolve({ id: run.id }),
    });

    await expect(res.json()).resolves.toEqual({
      status: "reviewing",
      error: "A review is already in progress.",
    });
    expect(res.status).toBe(409);
  });
});
