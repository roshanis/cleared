import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GoldenGateReport } from "@/lib/rubric";
import {
  resetStoreForTests,
  saveRubricDraft,
  setGoldenGate,
} from "@/lib/store";
import { POST } from "./route";

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(async () => ({
    personaId: "priya",
    name: "Priya Nair",
    role: "admin",
  })),
}));

const publishRequest = (version: number, acknowledgeUnexercisedCriteria = false) =>
  new Request("http://localhost/api/rubric/publish", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body: JSON.stringify({ version, acknowledgeUnexercisedCriteria }),
  });

beforeEach(async () => {
  await resetStoreForTests(false);
});

describe("POST /api/rubric/publish", () => {
  it("requires explicit acknowledgment before publishing a demo gate with unexercised criteria", async () => {
    const draft = await saveRubricDraft(
      {
        criteria: [
          {
            id: "C99",
            severity: "major",
            area: "content",
            description: "Custom model-only criterion.",
          },
        ],
        failOn: ["major"],
      },
      "Priya Nair",
    );
    const gate: GoldenGateReport = {
      ranAt: new Date().toISOString(),
      reviewer: "heuristic",
      pass: true,
      unexercisedCriteria: ["C99"],
      cases: [],
    };
    await setGoldenGate(draft.version, gate);

    const blocked = await POST(publishRequest(draft.version));
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toEqual({
      error:
        "Acknowledge that the demo reviewer did not exercise 1 criterion before publishing.",
    });

    const acknowledged = await POST(publishRequest(draft.version, true));
    expect(acknowledged.status).toBe(200);
  });
});
