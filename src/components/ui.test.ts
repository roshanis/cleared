import { describe, expect, it } from "vitest";
import { initials, relativeTime } from "./ui";

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("Maya Chen")).toBe("MC");
    expect(initials("Devon Park")).toBe("DP");
  });

  it("handles single names", () => {
    expect(initials("Priya")).toBe("P");
  });

  it("ignores extra words and whitespace", () => {
    expect(initials("  Sam   Osei  Jr ")).toBe("SO");
  });

  it("returns an empty string for empty input", () => {
    expect(initials("")).toBe("");
  });
});

describe("relativeTime", () => {
  it("renders minutes, hours, and days", () => {
    const now = Date.parse("2026-07-04T12:00:00Z");
    expect(relativeTime("2026-07-04T11:59:40Z", now)).toBe("just now");
    expect(relativeTime("2026-07-04T11:30:00Z", now)).toBe("30m ago");
    expect(relativeTime("2026-07-04T09:00:00Z", now)).toBe("3h ago");
    expect(relativeTime("2026-07-01T12:00:00Z", now)).toBe("3d ago");
  });
});
