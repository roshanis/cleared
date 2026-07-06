/**
 * Deterministic application of fix drafts. The fixer agents propose text;
 * this code decides where it lands — and refuses to guess: a quote that
 * cannot be located (exactly, or with whitespace re-wrapped) is reported,
 * never fuzzily replaced.
 */

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

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Locate a quote exactly, else tolerate re-wrapped whitespace. */
function locate(content: string, quote: string): { start: number; end: number } | null {
  const exact = content.indexOf(quote);
  if (exact !== -1) return { start: exact, end: exact + quote.length };

  const words = quote.trim().split(/\s+/);
  if (words.length === 0 || words[0] === "") return null;
  const pattern = new RegExp(words.map(escapeRegExp).join("\\s+"));
  const match = pattern.exec(content);
  if (!match) return null;
  return { start: match.index, end: match.index + match[0].length };
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
