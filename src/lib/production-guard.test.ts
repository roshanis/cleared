import { describe, expect, it } from "vitest";
import { assertProductionSafeEnv } from "./production-guard";

const baseProductionEnv = {
  NODE_ENV: "production",
  AUTH_SECRET: "test-secret",
  DATABASE_URL: "postgres://example",
};

describe("assertProductionSafeEnv", () => {
  it.each(["DEMO_AUTH", "DEMO_PUBLIC"] as const)(
    "rejects production %s without ALLOW_DEMO_DEPLOY=1",
    (flag) => {
      expect(() =>
        assertProductionSafeEnv({
          ...baseProductionEnv,
          [flag]: "1",
        }),
      ).toThrow(/ALLOW_DEMO_DEPLOY=1/);
    },
  );

  it("allows intentional production demo deployment with the explicit override", () => {
    expect(() =>
      assertProductionSafeEnv({
        ...baseProductionEnv,
        DEMO_AUTH: "1",
        DEMO_PUBLIC: "1",
        ALLOW_DEMO_DEPLOY: "1",
      }),
    ).not.toThrow();
  });

  it("rejects production without AUTH_SECRET", () => {
    expect(() =>
      assertProductionSafeEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://example",
      }),
    ).toThrow(/AUTH_SECRET/);
  });

  it("rejects production without DATABASE_URL or POSTGRES_URL", () => {
    expect(() =>
      assertProductionSafeEnv({
        NODE_ENV: "production",
        AUTH_SECRET: "test-secret",
      }),
    ).toThrow(/DATABASE_URL or POSTGRES_URL/);
  });

  it("waives the database requirement for an explicit demo deployment", () => {
    expect(() =>
      assertProductionSafeEnv({
        NODE_ENV: "production",
        AUTH_SECRET: "test-secret",
        DEMO_AUTH: "1",
        ALLOW_DEMO_DEPLOY: "1",
      }),
    ).not.toThrow();
  });

  it("accepts POSTGRES_URL as the durable production database env", () => {
    expect(() =>
      assertProductionSafeEnv({
        NODE_ENV: "production",
        AUTH_SECRET: "test-secret",
        POSTGRES_URL: "postgres://example",
      }),
    ).not.toThrow();
  });

  it("does not reject local demo settings", () => {
    expect(() =>
      assertProductionSafeEnv({
        NODE_ENV: "development",
        DEMO_AUTH: "1",
        DEMO_PUBLIC: "1",
      }),
    ).not.toThrow();
  });
});
