import { locateQuote } from "./quote-location";

export interface Segment {
  text: string;
  /** Indexes into the findings array whose quotes cover this segment. */
  findingIndexes: number[];
}

/**
 * Split a document into segments so finding quotes can be rendered as inline
 * highlights. Segments concatenate back to the original content; quotes that
 * can't be located simply produce no highlight (never a crash).
 */
export function segmentDocument(content: string, quotes: string[]): Segment[] {
  const ranges: { start: number; end: number; idx: number }[] = [];
  quotes.forEach((quote, idx) => {
    const located = locateQuote(content, quote);
    if (!located) return;
    ranges.push({ start: located.start, end: located.end, idx });
  });

  const points = new Set<number>([0, content.length]);
  for (const r of ranges) {
    points.add(r.start);
    points.add(r.end);
  }
  const sorted = [...points].sort((a, b) => a - b);

  const segments: Segment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start === end) continue;
    segments.push({
      text: content.slice(start, end),
      findingIndexes: ranges
        .filter((r) => r.start <= start && r.end >= end)
        .map((r) => r.idx),
    });
  }
  return segments;
}

export function locatedQuoteIndexes(content: string, quotes: string[]): boolean[] {
  return quotes.map((quote) => locateQuote(content, quote) !== null);
}
