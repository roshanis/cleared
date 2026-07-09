import { describe, expect, it } from "vitest";
import { segmentDocument } from "./highlight";

describe("segmentDocument", () => {
  const doc = "The fund is risk-free and beats Vanguard easily.";

  it("segments concatenate back to the original content", () => {
    const segments = segmentDocument(doc, ["risk-free", "beats Vanguard"]);
    expect(segments.map((s) => s.text).join("")).toBe(doc);
  });

  it("marks quoted ranges with their finding index", () => {
    const segments = segmentDocument(doc, ["risk-free"]);
    const marked = segments.filter((s) => s.findingIndexes.length > 0);
    expect(marked).toHaveLength(1);
    expect(marked[0].text).toBe("risk-free");
    expect(marked[0].findingIndexes).toEqual([0]);
  });

  it("handles overlapping quotes by tagging the shared range with both", () => {
    const segments = segmentDocument(doc, [
      "is risk-free and",
      "risk-free and beats",
    ]);
    const shared = segments.find((s) => s.findingIndexes.length === 2);
    expect(shared?.text).toBe("risk-free and");
    expect(segments.map((s) => s.text).join("")).toBe(doc);
  });

  it("ignores quotes that are not found and matches case-insensitively", () => {
    const segments = segmentDocument(doc, ["not in the doc", "RISK-FREE"]);
    expect(segments.map((s) => s.text).join("")).toBe(doc);
    expect(segments.some((s) => s.findingIndexes.includes(1))).toBe(true);
    expect(segments.some((s) => s.findingIndexes.includes(0))).toBe(false);
  });

  it("highlights curly quote, ellipsis, first-word case, and trailing punctuation drift", () => {
    const content = 'Returns you can count on... "risk-free" income.';
    const segments = segmentDocument(content, [
      "returns you can count on",
      "“risk-free” income",
    ]);
    expect(segments.map((s) => s.text).join("")).toBe(content);
    expect(segments.some((s) => s.findingIndexes.includes(0))).toBe(true);
    expect(segments.some((s) => s.findingIndexes.includes(1))).toBe(true);
  });

  it("does not highlight a near-miss quote when drift is too large", () => {
    const segments = segmentDocument(doc, [
      "The fund guarantees profits forever.",
    ]);
    expect(segments.map((s) => s.text).join("")).toBe(doc);
    expect(segments.some((s) => s.findingIndexes.includes(0))).toBe(false);
  });
});
