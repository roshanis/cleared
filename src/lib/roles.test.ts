import { describe, expect, it } from "vitest";
import {
  canDecide,
  canEditRubric,
  canExport,
  canManageUsers,
  canSubmit,
  canViewDashboard,
  canViewQueue,
} from "./roles";
import { personas } from "./session";
import type { Role } from "./session";

const ALL_ROLES: Role[] = ["author", "officer", "admin", "auditor"];

describe("canDecide — only officer/admin", () => {
  it("author cannot decide", () => {
    expect(canDecide("author")).toBe(false);
  });
  it("auditor cannot decide", () => {
    expect(canDecide("auditor")).toBe(false);
  });
  it("officer can decide", () => {
    expect(canDecide("officer")).toBe(true);
  });
  it("admin can decide", () => {
    expect(canDecide("admin")).toBe(true);
  });
});

describe("canSubmit — only author/admin", () => {
  it("author can submit", () => {
    expect(canSubmit("author")).toBe(true);
  });
  it("admin can submit", () => {
    expect(canSubmit("admin")).toBe(true);
  });
  it("officer cannot submit", () => {
    expect(canSubmit("officer")).toBe(false);
  });
  it("auditor cannot submit", () => {
    expect(canSubmit("auditor")).toBe(false);
  });
});

describe("canExport — officer/admin/auditor (not author)", () => {
  it("author cannot export", () => {
    expect(canExport("author")).toBe(false);
  });
  it("officer can export", () => {
    expect(canExport("officer")).toBe(true);
  });
  it("admin can export", () => {
    expect(canExport("admin")).toBe(true);
  });
  it("auditor can export", () => {
    expect(canExport("auditor")).toBe(true);
  });
});

describe("canEditRubric — admin only", () => {
  it("admin can edit rubric", () => {
    expect(canEditRubric("admin")).toBe(true);
  });
  it("author cannot edit rubric", () => {
    expect(canEditRubric("author")).toBe(false);
  });
  it("officer cannot edit rubric", () => {
    expect(canEditRubric("officer")).toBe(false);
  });
  it("auditor cannot edit rubric", () => {
    expect(canEditRubric("auditor")).toBe(false);
  });
});

describe("canViewQueue — officer/admin only", () => {
  it("officer can view queue", () => {
    expect(canViewQueue("officer")).toBe(true);
  });
  it("admin can view queue", () => {
    expect(canViewQueue("admin")).toBe(true);
  });
  it("author cannot view queue", () => {
    expect(canViewQueue("author")).toBe(false);
  });
  it("auditor cannot view queue", () => {
    expect(canViewQueue("auditor")).toBe(false);
  });
});

describe("canViewDashboard — officer/admin/auditor", () => {
  it("officer can view dashboard", () => {
    expect(canViewDashboard("officer")).toBe(true);
  });
  it("admin can view dashboard", () => {
    expect(canViewDashboard("admin")).toBe(true);
  });
  it("auditor can view dashboard", () => {
    expect(canViewDashboard("auditor")).toBe(true);
  });
  it("author cannot view dashboard", () => {
    expect(canViewDashboard("author")).toBe(false);
  });
});

describe("canManageUsers — OAuth admin only", () => {
  it("an OAuth admin can manage users", () => {
    expect(canManageUsers({ role: "admin", authMethod: "oauth" })).toBe(true);
  });
  it("a demo admin persona cannot manage users", () => {
    expect(canManageUsers({ role: "admin", authMethod: "demo" })).toBe(false);
  });
  it("a non-admin OAuth user cannot manage users", () => {
    for (const role of ["author", "officer", "auditor"] as const) {
      expect(canManageUsers({ role, authMethod: "oauth" })).toBe(false);
    }
  });
});

describe("personas", () => {
  it("exactly one auditor persona exists", () => {
    const auditors = personas.filter((p) => p.role === "auditor");
    expect(auditors).toHaveLength(1);
    expect(auditors[0].id).toBe("sam");
  });

  it("every persona role is a valid Role", () => {
    for (const p of personas) {
      expect(ALL_ROLES).toContain(p.role);
    }
  });

  it("every persona has a non-empty sees field", () => {
    for (const p of personas) {
      expect(p.sees.trim().length).toBeGreaterThan(0);
    }
  });

  it("no admin persona has Sam Osei — Sam is now auditor", () => {
    const sam = personas.find((p) => p.id === "sam");
    expect(sam?.role).toBe("auditor");
  });
});
