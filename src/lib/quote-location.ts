export type QuoteLocationMethod = "exact" | "normalized" | "token-fuzzy";

export interface QuoteLocation {
  start: number;
  end: number;
  method: QuoteLocationMethod;
}

interface Token {
  value: string;
  start: number;
  end: number;
}

const wordPattern = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu;

function normalizeToken(token: string): string {
  return token.normalize("NFKC").replace(/[’]/g, "'").toLowerCase();
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let match: RegExpExecArray | null;
  wordPattern.lastIndex = 0;
  while ((match = wordPattern.exec(text))) {
    tokens.push({
      value: normalizeToken(match[0]),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return tokens;
}

function expandTrailingPunctuation(content: string, end: number): number {
  const tail = content.slice(end);
  const match = /^(?:["'”’)]*)(?:\.{1,3}|…|[!?])(?:["'”’)]*)/.exec(tail);
  return match ? end + match[0].length : end;
}

function locationFromTokens(
  content: string,
  tokens: Token[],
  startIndex: number,
  length: number,
  method: QuoteLocationMethod,
): QuoteLocation {
  const start = tokens[startIndex].start;
  const last = tokens[startIndex + length - 1];
  return {
    start,
    end: expandTrailingPunctuation(content, last.end),
    method,
  };
}

function tokenEditDistance(a: string[], b: string[]): number {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

function findNormalizedExact(
  content: string,
  contentTokens: Token[],
  quoteTokens: Token[],
): QuoteLocation | null {
  const needle = quoteTokens.map((token) => token.value);
  if (needle.length === 0 || contentTokens.length < needle.length) return null;

  for (let i = 0; i <= contentTokens.length - needle.length; i++) {
    if (
      needle.every((token, offset) => contentTokens[i + offset].value === token)
    ) {
      return locationFromTokens(
        content,
        contentTokens,
        i,
        needle.length,
        "normalized",
      );
    }
  }
  return null;
}

function findFuzzy(
  content: string,
  contentTokens: Token[],
  quoteTokens: Token[],
): QuoteLocation | null {
  const quoteValues = quoteTokens.map((token) => token.value);
  if (quoteValues.length < 6) return null;

  let best: { index: number; length: number; distance: number } | null = null;
  let ties = 0;
  const lengths = [
    quoteValues.length - 1,
    quoteValues.length,
    quoteValues.length + 1,
  ].filter((length) => length > 0 && length <= contentTokens.length);

  for (const length of lengths) {
    for (let i = 0; i <= contentTokens.length - length; i++) {
      const window = contentTokens
        .slice(i, i + length)
        .map((token) => token.value);
      const distance = tokenEditDistance(quoteValues, window);
      if (!best || distance < best.distance) {
        best = { index: i, length, distance };
        ties = 1;
      } else if (distance === best.distance) {
        ties += 1;
      }
    }
  }

  if (!best || best.distance > 1 || ties !== 1) return null;
  return locationFromTokens(
    content,
    contentTokens,
    best.index,
    best.length,
    "token-fuzzy",
  );
}

/**
 * Locate a model-provided quote conservatively. Exact substring matching wins;
 * normalized token matching handles harmless punctuation, case, and whitespace
 * drift; fuzzy matching allows only one token edit in longer quotes.
 */
export function locateQuote(content: string, quote: string): QuoteLocation | null {
  const trimmed = quote.trim();
  if (!trimmed) return null;

  const exact = content.indexOf(trimmed);
  if (exact !== -1) {
    return { start: exact, end: exact + trimmed.length, method: "exact" };
  }

  const contentTokens = tokenize(content);
  const quoteTokens = tokenize(trimmed);
  return (
    findNormalizedExact(content, contentTokens, quoteTokens) ??
    findFuzzy(content, contentTokens, quoteTokens)
  );
}
