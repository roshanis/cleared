import { afterEach, describe, expect, it, vi } from "vitest";
import { accessCodeOk, homeByRole, personas, switchTarget } from "./session";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("accessCodeOk", () => {
  it("fails closed in production when no APP_ACCESS_CODE is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_AUTH", "1");
    expect(accessCodeOk(undefined)).toBe(false);
    expect(accessCodeOk("anything")).toBe(false);
  });

  it("accepts only the exact code when APP_ACCESS_CODE is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_AUTH", "1");
    vi.stubEnv("APP_ACCESS_CODE", "letmein");
    expect(accessCodeOk("letmein")).toBe(true);
    expect(accessCodeOk("wrong")).toBe(false);
    expect(accessCodeOk(undefined)).toBe(false);
  });

  it("skips the code entirely in a public demo (DEMO_PUBLIC=1)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_AUTH", "1");
    vi.stubEnv("DEMO_PUBLIC", "1");
    expect(accessCodeOk(undefined)).toBe(true);
  });

  it("public demo ignores APP_ACCESS_CODE when both are set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_AUTH", "1");
    vi.stubEnv("DEMO_PUBLIC", "1");
    vi.stubEnv("APP_ACCESS_CODE", "letmein");
    expect(accessCodeOk(undefined)).toBe(true);
  });

  it("DEMO_PUBLIC cannot resurrect a disabled demo (DEMO_AUTH=0)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_AUTH", "0");
    vi.stubEnv("DEMO_PUBLIC", "1");
    expect(accessCodeOk(undefined)).toBe(false);
  });
});

describe("switchTarget", () => {
  it("returns a token and the role home for every persona", () => {
    vi.stubEnv("DEMO_AUTH", "1");
    for (const persona of personas) {
      const target = switchTarget(persona.id);
      expect(target).not.toBeNull();
      expect(target?.token).toBeTruthy();
      expect(target?.home).toBe(homeByRole[persona.role]);
    }
  });

  it("returns null for an unknown persona", () => {
    vi.stubEnv("DEMO_AUTH", "1");
    expect(switchTarget("nobody")).toBeNull();
  });

  it("returns null when demo auth is disabled", () => {
    vi.stubEnv("DEMO_AUTH", "0");
    expect(switchTarget("maya")).toBeNull();
  });
});
