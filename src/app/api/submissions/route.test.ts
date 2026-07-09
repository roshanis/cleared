import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { resetSubmissionRateLimiterForTests } from "@/lib/submission-rate-limiter";
import { createSubmission, getDb, resetStoreForTests } from "@/lib/store";
import { POST } from "./route";

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(async () => ({
    personaId: "maya",
    userId: "demo:maya",
    name: "Maya Chen",
    email: null,
    role: "author",
    authMethod: "demo",
    gen: 0,
  })),
}));

const submissionRequest = (content = "This customer email promises guaranteed returns.") =>
  new Request("http://localhost/api/submissions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body: JSON.stringify({
      title: "Budget test",
      content,
      jurisdictions: ["US"],
    }),
  });

beforeEach(async () => {
  await resetStoreForTests(false);
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  vi.stubEnv("DEMO_PUBLIC_MODEL", "1");
  vi.stubEnv("DEMO_MODEL_DAILY_CAP", "1");
  vi.stubEnv("GLOBAL_MODEL_DAILY_CAP", "");
  vi.stubEnv("RATE_LIMIT_SUBMISSIONS", "");
  vi.stubEnv("RATE_LIMIT_WINDOW_MINUTES", "");
  vi.stubEnv("MAX_DOCUMENT_CHARS", "");
  resetSubmissionRateLimiterForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/submissions model budget", () => {
  it("downgrades public demo submissions to the heuristic reviewer when the daily model cap is reached", async () => {
    vi.stubEnv("DEMO_PUBLIC", "1");
    await createSubmission({
      title: "Earlier model review",
      content: "Earlier content",
      author: "Maya Chen",
      reviewer: "model",
    });

    const res = await POST(submissionRequest());
    const body = (await res.json()) as { runId: string; reviewer: string };
    const db = await getDb();
    const stored = db.runs.find((run) => run.id === body.runId);

    expect(res.status).toBe(200);
    expect(body.reviewer).toBe("heuristic");
    expect(stored?.reviewer).toBe("heuristic");
  });

  it("keeps public demo submissions on the model reviewer while under the daily cap", async () => {
    vi.stubEnv("DEMO_PUBLIC", "1");
    vi.stubEnv("DEMO_MODEL_DAILY_CAP", "2");
    await createSubmission({
      title: "Earlier model review",
      content: "Earlier content",
      author: "Maya Chen",
      reviewer: "model",
    });

    const res = await POST(submissionRequest());
    const body = (await res.json()) as { runId: string; reviewer: string };
    const db = await getDb();
    const stored = db.runs.find((run) => run.id === body.runId);

    expect(res.status).toBe(200);
    expect(body.reviewer).toBe("model");
    expect(stored?.reviewer).toBe("model");
  });

  it("rate-limits non-public model submissions when the global daily model cap is reached", async () => {
    vi.stubEnv("DEMO_PUBLIC", "");
    vi.stubEnv("GLOBAL_MODEL_DAILY_CAP", "1");
    await createSubmission({
      title: "Earlier model review",
      content: "Earlier content",
      author: "Maya Chen",
      reviewer: "model",
    });

    const res = await POST(submissionRequest());
    const body = (await res.json()) as {
      error: string;
      retryAfterSeconds: number;
    };

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(body.error).toContain("daily live-review budget");
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("POST /api/submissions rate and input caps", () => {
  it("rate-limits submission creation per session user", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("RATE_LIMIT_SUBMISSIONS", "1");
    vi.stubEnv("RATE_LIMIT_WINDOW_MINUTES", "10");

    const first = await POST(submissionRequest("First document"));
    const second = await POST(submissionRequest("Second document"));
    const body = (await second.json()) as {
      error: string;
      retryAfterSeconds: number;
    };

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get("Retry-After")).toBe("600");
    expect(body.error).toContain("Too many submissions");
    expect(body.retryAfterSeconds).toBe(600);
  });

  it("accepts content exactly at MAX_DOCUMENT_CHARS", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("MAX_DOCUMENT_CHARS", "5");

    const res = await POST(submissionRequest("12345"));

    expect(res.status).toBe(200);
  });

  it("rejects content over MAX_DOCUMENT_CHARS with a rendered form message", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("MAX_DOCUMENT_CHARS", "5");

    const res = await POST(submissionRequest("123456"));
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe("Document is too long. Limit it to 5 characters.");
  });
});
