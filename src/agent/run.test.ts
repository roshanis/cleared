import { afterEach, describe, expect, it, vi } from "vitest";

describe("model configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("treats an empty OPENAI_MODEL as unset and falls back to the default", async () => {
    vi.stubEnv("OPENAI_MODEL", "");
    vi.resetModules();
    const { MODEL_ID } = await import("./run");
    expect(MODEL_ID).toBe("gpt-5.4-mini");
  });

  it("uses the heuristic reviewer when no API key is configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.resetModules();
    const { activeReviewer } = await import("./run");
    expect(activeReviewer()).toBe("heuristic");
  });

  it("uses the model reviewer when an API key is configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.resetModules();
    const { activeReviewer } = await import("./run");
    expect(activeReviewer()).toBe("model");
  });

  it("forces the heuristic reviewer in a public demo, even with an API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("DEMO_PUBLIC", "1");
    vi.resetModules();
    const { activeReviewer } = await import("./run");
    expect(activeReviewer()).toBe("heuristic");
  });
});
