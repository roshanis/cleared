import { describe, expect, it } from "vitest";
import { defaultRubricDraft } from "@/lib/rubric";
import { heuristicReview, sentenceAt } from "./heuristic";

const criteria = defaultRubricDraft.criteria;
const ids = (doc: string) => heuristicReview(doc, criteria).map((f) => f.criterionId);

const disclaimer =
  "Past performance is not indicative of future results, and all investments may lose value.";

describe("heuristicReview", () => {
  it("flags C1 when the disclaimer is missing", () => {
    expect(ids("Subject: Hello\n\nBuy our fund.")).toContain("C1");
  });

  it("does not flag C1 when disclaimer and loss warning are present", () => {
    expect(ids(`Buy our fund. ${disclaimer}`)).not.toContain("C1");
  });

  it("flags C2 on guarantee language with the offending sentence quoted", () => {
    const doc = `Our fund is basically risk-free for you. ${disclaimer}`;
    const findings = heuristicReview(doc, criteria);
    const c2 = findings.find((f) => f.criterionId === "C2");
    expect(c2).toBeDefined();
    expect(c2!.quote).toBe("Our fund is basically risk-free for you.");
  });

  it("does not flag C2 for guarantee wording inside the disclaimer itself", () => {
    expect(
      ids(`Past performance does not guarantee future results, and investments may lose value.`),
    ).not.toContain("C2");
  });

  it("flags C2 on paraphrased guarantee language and unicode hyphen tricks", () => {
    expect(ids(`Returns you can count on every quarter. ${disclaimer}`)).toContain(
      "C2",
    );
    expect(ids(`This income sleeve is risk‑free for retirees. ${disclaimer}`)).toContain(
      "C2",
    );
  });

  it("does not flag C2 for explicit no-guarantee and no-risk-free statements", () => {
    expect(
      ids(
        `No investment is risk-free, and we do not guarantee returns. ${disclaimer}`,
      ),
    ).not.toContain("C2");
  });

  it("flags C3 on unsubstantiated competitor comparisons only", () => {
    expect(ids(`We outperformed Vanguard last year. ${disclaimer}`)).toContain("C3");
    expect(
      ids(
        `We outperformed Vanguard last year, according to the 2025 Lipper benchmark study. ${disclaimer}`,
      ),
    ).not.toContain("C3");
  });

  it("flags C4 when the doc asks for account data by reply, not when it warns against it", () => {
    expect(
      ids(`Reply to this email with your account number. ${disclaimer}`),
    ).toContain("C4");
    expect(
      ids(`For verification, reply in this chat with your password. ${disclaimer}`),
    ).toContain("C4");
    expect(
      ids(`Please don't reply to this email with account details. ${disclaimer}`),
    ).not.toContain("C4");
  });

  it("flags C5 for fee mentions without a fee-schedule reference", () => {
    expect(ids(`Our fees are low. ${disclaimer}`)).toContain("C5");
    expect(
      ids(`Our fees are described in our fee schedule and Form ADV. ${disclaimer}`),
    ).not.toContain("C5");
  });
});

describe("sentenceAt", () => {
  it("extracts the containing sentence", () => {
    const text = "First sentence. Second one here! Third.";
    expect(sentenceAt(text, text.indexOf("Second"))).toBe("Second one here!");
  });

  it("treats line breaks as boundaries", () => {
    const text = "Subject: Big news\n\nBody starts here.";
    expect(sentenceAt(text, 3)).toBe("Subject: Big news");
  });
});
