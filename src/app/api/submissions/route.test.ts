import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createSubmission, getDb, resetStoreForTests } from "@/lib/store";
import { POST } from "./route";

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(async () => ({
    personaId: "maya",
    name: "Maya Chen",
    role: "author",
  })),
}));

const submissionRequest = () =>
  new Request("http://localhost/api/submissions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body: JSON.stringify({
      title: "Budget test",
      content: "This customer email promises guaranteed returns.",
      jurisdictions: ["US"],
    }),
  });

beforeEach(async () => {
  await resetStoreForTests(false);
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  vi.stubEnv("DEMO_PUBLIC_MODEL", "1");
  vi.stubEnv("DEMO_MODEL_DAILY_CAP", "1");
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

  it("never downgrades non-public submissions because of the demo cap", async () => {
    vi.stubEnv("DEMO_PUBLIC", "");
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
});
