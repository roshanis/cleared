import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetStoreForTests, saveRubricDraft } from "@/lib/store";
import { POST } from "./route";

const runReviewMock = vi.hoisted(() => vi.fn());
const activeReviewerMock = vi.hoisted(() => vi.fn(() => "model"));

vi.mock("@/agent/run", () => ({
  activeReviewer: activeReviewerMock,
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
  activeReviewerMock.mockReturnValue("model");
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

describe("POST /api/rubric/gate heuristic honesty", () => {
  it("reports custom criteria that the demo reviewer does not exercise", async () => {
    activeReviewerMock.mockReturnValue("heuristic");
    const draft = await saveRubricDraft(
      {
        criteria: [
          {
            id: "C99",
            severity: "major",
            area: "content",
            description: "Custom criterion only model reviewers can evaluate.",
          },
        ],
        failOn: ["major"],
      },
      "Priya Nair",
    );
    runReviewMock.mockResolvedValue({
      verdict: "pass",
      findings: [],
      summary: "ok",
    });

    const res = await POST(
      new Request("http://localhost/api/rubric/gate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({ version: draft.version }),
      }),
    );
    const body = (await res.json()) as {
      report: {
        unexercisedCriteria: string[];
        cases: { id: string; knownLimit?: boolean }[];
      };
    };

    expect(res.status).toBe(200);
    expect(body.report.unexercisedCriteria).toEqual(["C99"]);
    expect(body.report.cases.some((c) => c.knownLimit)).toBe(true);
  });
});
