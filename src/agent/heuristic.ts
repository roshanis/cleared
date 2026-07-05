import type { RubricCriterion } from "@/lib/rubric";
import type { ReviewerFinding } from "./merge";

/**
 * Deterministic demo reviewer. Used when no OPENAI_API_KEY is configured
 * (demo mode) and as the fixture for tests and the rubric publish gate, so
 * those never depend on network or model behavior. It implements the five
 * template criteria; custom criteria added in the rubric editor are only
 * reviewed by the model reviewer.
 */
export function heuristicReview(
  document: string,
  criteria: RubricCriterion[],
): ReviewerFinding[] {
  const findings: ReviewerFinding[] = [];
  const has = (id: string) => criteria.some((c) => c.id === id);
  const sev = (id: string) =>
    criteria.find((c) => c.id === id)?.severity ?? "major";

  if (has("C1")) {
    const hasPerformanceDisclaimer =
      /past\s+performance\s+(is\s+not\s+indicative\s+of|does\s+not\s+guarantee)\s+future\s+results/i.test(
        document,
      );
    const hasLossWarning = /may\s+lose\s+value/i.test(document);
    if (!hasPerformanceDisclaimer || !hasLossWarning) {
      const missing = [
        !hasPerformanceDisclaimer &&
          '"past performance is not indicative of future results"',
        !hasLossWarning && '"investments may lose value"',
      ]
        .filter(Boolean)
        .join(" and ");
      findings.push({
        criterionId: "C1",
        severity: sev("C1"),
        quote: firstLine(document),
        explanation: `Required risk disclaimer language is absent: ${missing}.`,
        recommendation:
          "Add the standard risk disclaimer before the sign-off: past performance language plus the may-lose-value statement.",
        confidence: "high",
      });
    }
  }

  if (has("C2")) {
    const match = /guarant\w*|risk[-\s]free|can'?t\s+lose/i.exec(document);
    if (match && !/past\s+performance/i.test(sentenceAt(document, match.index))) {
      findings.push({
        criterionId: "C2",
        severity: sev("C2"),
        quote: sentenceAt(document, match.index),
        explanation: `Promises performance ("${match[0]}") — guarantees of returns are prohibited.`,
        recommendation:
          "Remove the guarantee language; describe historical performance factually with the required disclaimer.",
        confidence: "high",
      });
    }
  }

  if (has("C3")) {
    const competitor =
      /\b(outperform\w*|beats?|better\s+than|superior\s+to)\b[^.]{0,120}?\b(Vanguard|Fidelity|Schwab|BlackRock)\b|\b(Vanguard|Fidelity|Schwab|BlackRock)\b[^.]{0,120}?\b(outperform\w*|beats?|better\s+than|superior\s+to)\b/i.exec(
        document,
      );
    const substantiated = /\b(study|benchmark|according to|source:)\b/i.test(
      document,
    );
    if (competitor && !substantiated) {
      findings.push({
        criterionId: "C3",
        severity: sev("C3"),
        quote: sentenceAt(document, competitor.index),
        explanation:
          "Comparative claim names a competitor without citing substantiation.",
        recommendation:
          "Cite a dated study or published benchmark, or remove the named comparison.",
        confidence: "high",
      });
    }
  }

  if (has("C4")) {
    const request =
      /reply\s+(to\s+this\s+(email|message)\s+)?with\s+your\b[^.]{0,80}?\b(account\s+number|ssn|social\s+security|password)/i.exec(
        document,
      );
    const exposed = /\b\d{3}-\d{2}-\d{4}\b/.exec(document);
    const match = request ?? exposed;
    if (match) {
      findings.push({
        criterionId: "C4",
        severity: sev("C4"),
        quote: sentenceAt(document, match.index),
        explanation: request
          ? "Requests sensitive account data over an unsecured channel (email reply)."
          : "Exposes what appears to be a Social Security number.",
        recommendation:
          "Direct the customer to the secure portal instead; never collect account data by email.",
        confidence: "high",
      });
    }
  }

  if (has("C5")) {
    const feeMention = /\bfees?\b|\bcosts?\b/i.exec(document);
    const referenced = /fee\s+schedule|form\s+adv/i.test(document);
    if (feeMention && !referenced) {
      findings.push({
        criterionId: "C5",
        severity: sev("C5"),
        quote: sentenceAt(document, feeMention.index),
        explanation:
          "Mentions fees or costs without referring to the full fee schedule or Form ADV.",
        recommendation:
          'Append "Details of our fees are available in our fee schedule and Form ADV."',
        confidence: "high",
      });
    }
  }

  return findings;
}

function firstLine(text: string): string {
  return (
    text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? text.slice(0, 80)
  );
}

/** Expand a match index to the containing sentence (or line). */
export function sentenceAt(text: string, index: number): string {
  const boundary = /[.!?](?=\s)|\n/g;
  let start = 0;
  let end = text.length;
  let m: RegExpExecArray | null;
  while ((m = boundary.exec(text))) {
    const cut = m.index + m[0].length;
    if (cut <= index) {
      start = cut;
    } else {
      end = m[0] === "\n" ? m.index : m.index + 1;
      break;
    }
  }
  return text.slice(start, end).trim();
}
