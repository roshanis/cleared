import { describe, expect, it, vi, afterEach } from "vitest";
import { demoModelDailyCap, underDailyModelCap } from "./model-budget";

describe("model review budget", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("counts only model runs from the same UTC day", () => {
    const now = "2026-07-08T00:00:00.000Z";
    const runs = [
      { reviewer: "model", createdAt: "2026-07-07T23:59:59.999Z" },
      { reviewer: "model", createdAt: "2026-07-08T00:00:00.000Z" },
      { reviewer: "heuristic", createdAt: "2026-07-08T12:00:00.000Z" },
    ];

    expect(underDailyModelCap(runs, now, 2)).toBe(true);
    expect(underDailyModelCap(runs, now, 1)).toBe(false);
  });

  it("allows cap minus one and blocks at cap or above", () => {
    const now = "2026-07-08T18:00:00.000Z";
    const modelRun = (minute: number) => ({
      reviewer: "model",
      createdAt: `2026-07-08T10:${String(minute).padStart(2, "0")}:00.000Z`,
    });

    expect(underDailyModelCap([modelRun(1)], now, 2)).toBe(true);
    expect(underDailyModelCap([modelRun(1), modelRun(2)], now, 2)).toBe(false);
    expect(
      underDailyModelCap([modelRun(1), modelRun(2), modelRun(3)], now, 2),
    ).toBe(false);
  });

  it("parses the demo model daily cap defensively", () => {
    vi.stubEnv("DEMO_MODEL_DAILY_CAP", "");
    expect(demoModelDailyCap()).toBe(200);

    vi.stubEnv("DEMO_MODEL_DAILY_CAP", "garbage");
    expect(demoModelDailyCap()).toBe(200);

    vi.stubEnv("DEMO_MODEL_DAILY_CAP", "12");
    expect(demoModelDailyCap()).toBe(12);
  });
});
