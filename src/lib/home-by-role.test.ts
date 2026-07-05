import { describe, expect, it } from "vitest";
import { homeByRole } from "./session";
import type { Role } from "./session";

const ALL_ROLES: Role[] = ["author", "officer", "admin", "auditor"];

describe("homeByRole", () => {
  it("covers every Role (no role is missing from the map)", () => {
    for (const role of ALL_ROLES) {
      expect(homeByRole[role]).toBeDefined();
      expect(typeof homeByRole[role]).toBe("string");
      expect(homeByRole[role].startsWith("/")).toBe(true);
    }
  });

  it("author maps to /documents (not /submit)", () => {
    expect(homeByRole["author"]).toBe("/documents");
  });

  it("auditor maps to /audit", () => {
    expect(homeByRole["auditor"]).toBe("/audit");
  });

  it("officer maps to /queue", () => {
    expect(homeByRole["officer"]).toBe("/queue");
  });

  it("admin maps to /dashboard", () => {
    expect(homeByRole["admin"]).toBe("/dashboard");
  });
});
