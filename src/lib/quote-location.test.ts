import { describe, expect, it } from "vitest";
import { locateQuote } from "./quote-location";

describe("locateQuote", () => {
  const doc =
    'The note says "returns you can count on every quarter" before adding that capital remains at risk. Later it says returns can vary.';

  it("locates exact quotes first", () => {
    expect(locateQuote(doc, "returns you can count on every quarter")).toMatchObject({
      start: doc.indexOf("returns you can count on every quarter"),
      method: "exact",
    });
  });

  it("matches curly and straight quote drift", () => {
    const content = 'We called it "risk-free" in the draft.';
    const range = locateQuote(content, "We called it “risk-free” in the draft.");
    expect(range && content.slice(range.start, range.end)).toBe(
      'We called it "risk-free" in the draft.',
    );
  });

  it("matches ellipsis and trailing punctuation drift", () => {
    const content = "Returns you can count on... every quarter.";
    const range = locateQuote(content, "Returns you can count on every quarter");
    expect(range && content.slice(range.start, range.end)).toBe(content);
  });

  it("matches first-word case drift", () => {
    const content = "Returns you can count on every quarter.";
    const range = locateQuote(content, "returns you can count on every quarter.");
    expect(range && content.slice(range.start, range.end)).toBe(content);
  });

  it("matches a single-token light paraphrase in a long quote", () => {
    const range = locateQuote(
      doc,
      "returns you can rely on every quarter",
    );
    expect(range && doc.slice(range.start, range.end)).toBe(
      "returns you can count on every quarter",
    );
  });

  it("never guesses when the quote is too short for paraphrase", () => {
    expect(locateQuote("The fund can lose money.", "fund cannot lose")).toBeNull();
  });

  it("never guesses when too many tokens drift", () => {
    expect(
      locateQuote(doc, "profits you can rely on forever with certainty"),
    ).toBeNull();
  });

  it("never guesses when multiple fuzzy windows tie", () => {
    const content =
      "returns you can count on every quarter; returns you can count on every month.";
    expect(locateQuote(content, "returns you can rely on every period")).toBeNull();
  });
});
