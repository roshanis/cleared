import { describe, expect, it } from "vitest";
import { setDriverForTests } from "./db/index";
import { createMemoryDriver } from "./db/memory";
import { createSubmission } from "./store";

describe("first boot", () => {
  it("seeds even when the first store access is a mutation, not getDb()", async () => {
    // Fresh, never-touched driver — simulates a brand-new deployment whose
    // very first request is POST /api/submissions.
    setDriverForTests(createMemoryDriver());

    const { run } = await createSubmission({
      title: "First request",
      content: "Some content",
      author: "Maya Chen",
      reviewer: "heuristic",
    });

    expect(run.rubricVersion).toBe(1);
  });
});
