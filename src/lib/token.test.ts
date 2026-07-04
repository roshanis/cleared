import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "./token";

describe("token sign/verify", () => {
  it("round-trips a payload", () => {
    const token = signToken({ name: "Maya", role: "author" }, "secret");
    expect(verifyToken(token, "secret")).toEqual({ name: "Maya", role: "author" });
  });

  it("rejects a tampered payload", () => {
    const token = signToken({ role: "author" }, "secret");
    const [, mac] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ role: "admin" })).toString("base64url")}.${mac}`;
    expect(verifyToken(forged, "secret")).toBeNull();
  });

  it("rejects the wrong secret and malformed tokens", () => {
    const token = signToken({ ok: true }, "secret");
    expect(verifyToken(token, "other")).toBeNull();
    expect(verifyToken("garbage", "secret")).toBeNull();
    expect(verifyToken("", "secret")).toBeNull();
  });
});
