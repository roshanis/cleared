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

  it("keeps public demos on the heuristic reviewer unless live models are enabled", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("DEMO_PUBLIC", "1");
    vi.stubEnv("DEMO_PUBLIC_MODEL", "");
    vi.resetModules();
    const { activeReviewer } = await import("./run");
    expect(activeReviewer()).toBe("heuristic");
  });

  it("uses the model reviewer in public demos when live models and an API key are configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("DEMO_PUBLIC", "1");
    vi.stubEnv("DEMO_PUBLIC_MODEL", "1");
    vi.resetModules();
    const { activeReviewer } = await import("./run");
    expect(activeReviewer()).toBe("model");
  });

  it("falls back to the heuristic reviewer in public live-model demos without an API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("DEMO_PUBLIC", "1");
    vi.stubEnv("DEMO_PUBLIC_MODEL", "1");
    vi.resetModules();
    const { activeReviewer } = await import("./run");
    expect(activeReviewer()).toBe("heuristic");
  });

  it("uses the model reviewer outside public demos when an API key is configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("DEMO_PUBLIC", "");
    vi.stubEnv("DEMO_PUBLIC_MODEL", "1");
    vi.resetModules();
    const { activeReviewer } = await import("./run");
    expect(activeReviewer()).toBe("model");
  });
});
