import { describe, expect, it } from "vitest";
import { documentStatus } from "./document-status";

describe("documentStatus — pure document status helper", () => {
  describe("no verdict → none", () => {
    it("returns none when verdict is null and no decision", () => {
      expect(documentStatus({ verdict: null, hasDecision: false })).toBe("none");
    });

    it("returns none when verdict is null even if hasDecision is somehow true", () => {
      expect(
        documentStatus({ verdict: null, hasDecision: true, decisionAction: "approve" }),
      ).toBe("none");
    });
  });

  describe("pass verdict → clear", () => {
    it("returns clear when verdict is pass and no decision", () => {
      expect(documentStatus({ verdict: "pass", hasDecision: false })).toBe("clear");
    });

    it("returns approved when verdict is pass and decision is approve", () => {
      // decision trumps the verdict
      expect(
        documentStatus({ verdict: "pass", hasDecision: true, decisionAction: "approve" }),
      ).toBe("approved");
    });
  });

  describe("fail verdict, no decision → action_needed", () => {
    it("returns action_needed when verdict is fail and no decision", () => {
      expect(documentStatus({ verdict: "fail", hasDecision: false })).toBe(
        "action_needed",
      );
    });
  });

  describe("needs_human_review verdict, no decision → in_review", () => {
    it("returns in_review when verdict is needs_human_review and no decision", () => {
      expect(
        documentStatus({ verdict: "needs_human_review", hasDecision: false }),
      ).toBe("in_review");
    });
  });

  describe("decision exists — decision action wins", () => {
    it("returns approved when decision action is approve (fail verdict)", () => {
      expect(
        documentStatus({
          verdict: "fail",
          hasDecision: true,
          decisionAction: "approve",
        }),
      ).toBe("approved");
    });

    it("returns rejected when decision action is reject (fail verdict)", () => {
      expect(
        documentStatus({
          verdict: "fail",
          hasDecision: true,
          decisionAction: "reject",
        }),
      ).toBe("rejected");
    });

    it("returns approved when decision action is approve (needs_human_review verdict)", () => {
      expect(
        documentStatus({
          verdict: "needs_human_review",
          hasDecision: true,
          decisionAction: "approve",
        }),
      ).toBe("approved");
    });

    it("returns rejected when decision action is reject (needs_human_review verdict)", () => {
      expect(
        documentStatus({
          verdict: "needs_human_review",
          hasDecision: true,
          decisionAction: "reject",
        }),
      ).toBe("rejected");
    });
  });
});
