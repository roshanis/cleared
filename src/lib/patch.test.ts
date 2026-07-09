import { describe, expect, it } from "vitest";
import { applyFixes, type Fix } from "./patch";

const doc = "First line.\n\nWe promise guaranteed   returns\nwith zero risk.\n\nBye.";

const replaceFix = (quote: string, replacement: string): Fix => ({
  findingIndex: 0,
  kind: "replace",
  quote,
  replacement,
  note: "n",
});

describe("applyFixes", () => {
  it("replaces an exact quote", () => {
    const { patched, applied, unlocated } = applyFixes(doc, [
      replaceFix("First line.", "Hello."),
    ]);
    expect(patched).toContain("Hello.");
    expect(patched).not.toContain("First line.");
    expect(applied).toHaveLength(1);
    expect(unlocated).toHaveLength(0);
  });

  it("locates quotes across re-wrapped whitespace", () => {
    const { patched, applied } = applyFixes(doc, [
      replaceFix(
        "We promise guaranteed returns with zero risk.",
        "Our fund seeks long-term growth.",
      ),
    ]);
    expect(applied).toHaveLength(1);
    expect(patched).toContain("Our fund seeks long-term growth.");
    expect(patched).not.toMatch(/guaranteed/);
  });

  it("appends insertions at the end of the document", () => {
    const { patched } = applyFixes(doc, [
      {
        findingIndex: 0,
        kind: "insert",
        quote: "",
        replacement: "Standard disclaimer line.",
        note: "n",
      },
    ]);
    expect(patched.trimEnd().endsWith("Standard disclaimer line.")).toBe(true);
  });

  it("reports unlocatable quotes honestly and leaves the text untouched", () => {
    const { patched, applied, unlocated } = applyFixes(doc, [
      replaceFix("this sentence does not exist", "x"),
    ]);
    expect(patched).toBe(doc);
    expect(applied).toHaveLength(0);
    expect(unlocated).toHaveLength(1);
    expect(unlocated[0].findingIndex).toBe(0);
  });

  it("never guesses: a partially-matching fabricated quote is not applied", () => {
    const { unlocated } = applyFixes(doc, [
      replaceFix("We promise guaranteed profits forever", "x"),
    ]);
    expect(unlocated).toHaveLength(1);
  });

  it("replaces quotes with curly quote and ellipsis drift", () => {
    const content = 'The draft called it "risk-free"... income.';
    const { patched, applied, unlocated } = applyFixes(content, [
      replaceFix("called it “risk-free” income", "described the income target."),
    ]);
    expect(applied).toHaveLength(1);
    expect(unlocated).toHaveLength(0);
    expect(patched).toBe("The draft described the income target.");
  });

  it("replaces quotes with first-word case and trailing punctuation drift", () => {
    const content = "Returns you can count on every quarter.";
    const { patched, applied } = applyFixes(content, [
      replaceFix("returns you can count on every quarter", "Returns may vary."),
    ]);
    expect(applied).toHaveLength(1);
    expect(patched).toBe("Returns may vary.");
  });

  it("replaces a single-token light paraphrase only when confidence is high", () => {
    const content =
      "The strategy offers returns you can count on every quarter for retirees.";
    const { patched, applied, unlocated } = applyFixes(content, [
      replaceFix(
        "returns you can rely on every quarter",
        "returns that can vary each quarter",
      ),
    ]);
    expect(applied).toHaveLength(1);
    expect(unlocated).toHaveLength(0);
    expect(patched).toContain("returns that can vary each quarter");
  });

  it("never guesses when a paraphrase changes too much", () => {
    const { patched, applied, unlocated } = applyFixes(doc, [
      replaceFix("We promise profits that last forever", "x"),
    ]);
    expect(patched).toBe(doc);
    expect(applied).toHaveLength(0);
    expect(unlocated).toHaveLength(1);
  });
});
