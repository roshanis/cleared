import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetStoreForTests } from "@/lib/store";
import { POST } from "./route";

const runReviewMock = vi.hoisted(() => vi.fn());

vi.mock("@/agent/run", () => ({
  activeReviewer: () => "model",
  runReview: runReviewMock,
}));

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(async () => ({
    personaId: "priya",
    name: "Priya Nair",
    role: "admin",
  })),
}));

const gateRequest = () =>
  new Request("http://localhost/api/rubric/gate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body: JSON.stringify({ version: 1 }),
  });

beforeEach(async () => {
  await resetStoreForTests(false);
  runReviewMock.mockReset();
});

describe("POST /api/rubric/gate provider failures", () => {
  it("returns a sanitized provider error when model-mode gate execution fails", async () => {
    runReviewMock.mockRejectedValueOnce(
      Object.assign(new Error("rate_limit_exceeded"), { statusCode: 429 }),
    );

    const res = await POST(gateRequest());
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(502);
    expect(body.error).toBe(
      "Model provider rate limit reached. Wait a moment, then retry the review.",
    );
  });
});
