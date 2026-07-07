import { describe, expect, it } from "vitest";
import {
  REVIEW_STAGES,
  STAGE_MS,
  stageIndexAt,
  theaterDone,
} from "./review-theater";

describe("review theater", () => {
  it("names the real pipeline stages in pipeline order", () => {
    expect(REVIEW_STAGES).toEqual([
      "Document submitted",
      "Policy reviewer reading",
      "Risk reviewer reading",
      "Judge verifying quotes",
    ]);
  });

  it("advances one stage per STAGE_MS", () => {
    expect(stageIndexAt(0, false)).toBe(0);
    expect(stageIndexAt(STAGE_MS, false)).toBe(1);
    expect(stageIndexAt(2 * STAGE_MS, false)).toBe(2);
    expect(stageIndexAt(3 * STAGE_MS, false)).toBe(3);
  });

  it("clamps to the last stage while waiting on a slow model call", () => {
    expect(stageIndexAt(60_000, false)).toBe(REVIEW_STAGES.length - 1);
  });

  it("paces the full choreography to about 2.5 seconds", () => {
    const total = REVIEW_STAGES.length * STAGE_MS;
    expect(total).toBeGreaterThanOrEqual(2_000);
    expect(total).toBeLessThanOrEqual(3_000);
    expect(theaterDone(total - 1, false)).toBe(false);
    expect(theaterDone(total, false)).toBe(true);
  });

  it("reduced motion skips the choreography entirely", () => {
    expect(stageIndexAt(0, true)).toBe(REVIEW_STAGES.length - 1);
    expect(theaterDone(0, true)).toBe(true);
  });
});
