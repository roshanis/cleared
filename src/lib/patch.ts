/**
 * Deterministic application of fix drafts. The fixer agents propose text;
 * this code decides where it lands — and refuses to guess: a quote that
 * cannot be located with high confidence is reported, never guessed into
 * the wrong passage.
 */
import { locateQuote } from "./quote-location";

export interface Fix {
  findingIndex: number;
  kind: "replace" | "insert";
  /** For replace: the passage to locate. Ignored for insert. */
  quote: string;
  replacement: string;
  note: string;
}

export interface UnlocatedFix {
  findingIndex: number;
  quote: string;
  note: string;
}

export interface PatchResult {
  patched: string;
  applied: Fix[];
  unlocated: UnlocatedFix[];
}

function locate(content: string, quote: string): { start: number; end: number } | null {
  const located = locateQuote(content, quote);
  return located ? { start: located.start, end: located.end } : null;
}

export function applyFixes(content: string, fixes: Fix[]): PatchResult {
  let patched = content;
  const applied: Fix[] = [];
  const unlocated: UnlocatedFix[] = [];
  const insertions: Fix[] = [];

  for (const fix of fixes) {
    if (fix.kind === "insert") {
      insertions.push(fix);
      applied.push(fix);
      continue;
    }
    const range = locate(patched, fix.quote);
    if (!range) {
      unlocated.push({
        findingIndex: fix.findingIndex,
        quote: fix.quote,
        note: fix.note,
      });
      continue;
    }
    patched =
      patched.slice(0, range.start) + fix.replacement + patched.slice(range.end);
    applied.push(fix);
  }

  if (insertions.length > 0) {
    patched = `${patched.trimEnd()}\n\n${insertions
      .map((fix) => fix.replacement)
      .join("\n")}\n`;
  }

  return { patched, applied, unlocated };
}
