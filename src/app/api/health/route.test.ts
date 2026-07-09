import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetStoreForTests } from "@/lib/store";
import { GET } from "./route";

beforeEach(async () => {
  await resetStoreForTests(false);
  // Ensure no OPENAI_API_KEY so reviewerMode is "heuristic"
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("DEMO_PUBLIC", "");
});

describe("GET /api/health", () => {
  it("returns 200 with ok: true", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
  });

  it("reports storage as 'memory' on the memory test driver", async () => {
    const res = await GET();
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.storage).toBe("memory");
  });

  it("reports reviewerMode as 'heuristic' when no API key is set", async () => {
    const res = await GET();
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.reviewerMode).toBe("heuristic");
  });

  it("reports reviewerMode as 'model' when OPENAI_API_KEY is set", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-key");
    const res = await GET();
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.reviewerMode).toBe("model");
  });

  it("reports schemaVersion as a positive integer", async () => {
    const res = await GET();
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body.schemaVersion).toBe("number");
    expect(body.schemaVersion).toBeGreaterThan(0);
  });

  it("includes a time field that is a valid ISO 8601 string", async () => {
    const res = await GET();
    const body = (await res.json()) as Record<string, unknown>;
    expect(typeof body.time).toBe("string");
    expect(Number.isNaN(new Date(body.time as string).getTime())).toBe(false);
  });

  it("does not expose secrets or sensitive keys in the response body", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-super-secret-key");
    const res = await GET();
    const text = await res.text();
    expect(text).not.toContain("sk-super-secret-key");
    expect(text).not.toContain("API_KEY");
    expect(text).not.toContain("SECRET");
    expect(text).not.toContain("DATABASE_URL");
  });

  it("requires no authentication — no cookie or session header needed", async () => {
    // GET() with no request context must not throw and must return 200
    const res = await GET();
    expect(res.status).toBe(200);
  });
});
