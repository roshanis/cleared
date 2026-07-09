import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSubmission, getDb, resetStoreForTests } from "@/lib/store";
import { POST } from "./route";

const runReviewMock = vi.hoisted(() => vi.fn());

vi.mock("@/agent/run", () => ({
  runReview: runReviewMock,
}));

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(async () => ({
    personaId: "maya",
    name: "Maya Chen",
    role: "author",
  })),
}));

const executeRequest = (id: string) =>
  new Request(`http://localhost/api/runs/${id}/execute`, {
    method: "POST",
    headers: { origin: "http://localhost" },
  });

async function queuedRun() {
  const { run } = await createSubmission({
    title: "Provider failure test",
    content: "This customer email promises guaranteed returns.",
    author: "Maya Chen",
    reviewer: "model",
  });
  return run;
}

beforeEach(async () => {
  await resetStoreForTests(false);
  runReviewMock.mockReset();
});

describe("POST /api/runs/[id]/execute provider failures", () => {
  it("persists a sanitized error state for bad OpenAI keys", async () => {
    const run = await queuedRun();
    runReviewMock.mockRejectedValueOnce(
      new Error("401 invalid_api_key: Incorrect API key provided: sk-test-secret"),
    );

    const res = await POST(executeRequest(run.id), {
      params: Promise.resolve({ id: run.id }),
    });
    const body = (await res.json()) as { status: string; error: string };
    const stored = (await getDb()).runs.find((candidate) => candidate.id === run.id);

    expect(res.status).toBe(500);
    expect(body).toEqual({
      status: "error",
      error:
        "Model provider authentication failed. Check OPENAI_API_KEY and retry the review.",
    });
    expect(stored?.status).toBe("error");
    expect(stored?.error).toBe(body.error);
    expect(stored?.error).not.toContain("sk-test-secret");
  });

  it("persists a retryable error state for provider timeouts", async () => {
    const run = await queuedRun();
    runReviewMock.mockRejectedValueOnce(
      Object.assign(new Error("Request timed out after 60000ms"), {
        name: "TimeoutError",
      }),
    );

    const res = await POST(executeRequest(run.id), {
      params: Promise.resolve({ id: run.id }),
    });
    const body = (await res.json()) as { status: string; error: string };
    const stored = (await getDb()).runs.find((candidate) => candidate.id === run.id);

    expect(res.status).toBe(500);
    expect(body.error).toBe(
      "Model review timed out before the provider returned a result. Retry the review.",
    );
    expect(stored?.status).toBe("error");
    expect(stored?.error).toBe(body.error);
  });

  it("persists a retryable error state for provider rate limits", async () => {
    const run = await queuedRun();
    runReviewMock.mockRejectedValueOnce(
      Object.assign(new Error("429 rate_limit_exceeded"), { statusCode: 429 }),
    );

    const res = await POST(executeRequest(run.id), {
      params: Promise.resolve({ id: run.id }),
    });
    const body = (await res.json()) as { status: string; error: string };
    const stored = (await getDb()).runs.find((candidate) => candidate.id === run.id);

    expect(res.status).toBe(500);
    expect(body.error).toBe(
      "Model provider rate limit reached. Wait a moment, then retry the review.",
    );
    expect(stored?.status).toBe("error");
    expect(stored?.error).toBe(body.error);
  });

  it("persists a retryable error state for malformed model output", async () => {
    const run = await queuedRun();
    runReviewMock.mockRejectedValueOnce(
      Object.assign(new Error("No object generated: schema mismatch"), {
        name: "AI_NoObjectGeneratedError",
      }),
    );

    const res = await POST(executeRequest(run.id), {
      params: Promise.resolve({ id: run.id }),
    });
    const body = (await res.json()) as { status: string; error: string };
    const stored = (await getDb()).runs.find((candidate) => candidate.id === run.id);

    expect(res.status).toBe(500);
    expect(body.error).toBe(
      "Model provider returned malformed review output. Retry the review; if it repeats, switch to the demo reviewer.",
    );
    expect(stored?.status).toBe("error");
    expect(stored?.error).toBe(body.error);
  });

  it("can retry a run after a provider error", async () => {
    const run = await queuedRun();
    runReviewMock
      .mockRejectedValueOnce(Object.assign(new Error("429"), { status: 429 }))
      .mockResolvedValueOnce({
        verdict: "pass",
        findings: [],
        summary: "Pass: no rubric violations found.",
      });

    await POST(executeRequest(run.id), {
      params: Promise.resolve({ id: run.id }),
    });
    const retry = await POST(executeRequest(run.id), {
      params: Promise.resolve({ id: run.id }),
    });
    const body = (await retry.json()) as { status: string };
    const stored = (await getDb()).runs.find((candidate) => candidate.id === run.id);

    expect(retry.status).toBe(200);
    expect(body.status).toBe("done");
    expect(stored?.status).toBe("done");
    expect(stored?.error).toBeNull();
    expect(runReviewMock).toHaveBeenCalledTimes(2);
  });
});
