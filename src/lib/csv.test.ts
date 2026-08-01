import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("renders headers and plain values", () => {
    expect(toCsv([{ a: 1, b: "x" }])).toBe("a,b\n1,x");
  });

  it("quote-escapes commas, quotes, and newlines", () => {
    expect(toCsv([{ a: 'say "hi", ok\nbye' }])).toBe(
      'a\n"say ""hi"", ok\nbye"',
    );
  });

  it("quotes bare carriage returns and tabs so rows cannot split", () => {
    expect(toCsv([{ a: "one\rtwo" }])).toBe('a\n"one\rtwo"');
    expect(toCsv([{ a: "one\ttwo" }])).toBe('a\n"one\ttwo"');
  });

  it("neutralizes leading formula characters", () => {
    expect(toCsv([{ a: '=HYPERLINK("https://evil.example","x")' }])).toBe(
      'a\n"\'=HYPERLINK(""https://evil.example"",""x"")"',
    );
    expect(toCsv([{ a: "+1234" }])).toBe("a\n'+1234");
    expect(toCsv([{ a: "-2%" }])).toBe("a\n'-2%");
    expect(toCsv([{ a: "@cmd" }])).toBe("a\n'@cmd");
    expect(toCsv([{ a: "  =1+1" }])).toBe("a\n'  =1+1");
  });

  it("leaves interior formula characters alone", () => {
    expect(toCsv([{ a: "a=b" }])).toBe("a\na=b");
  });
});
