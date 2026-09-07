"use client";

import { useId, useRef, useState } from "react";
import type { Coverage, ReviewResult } from "@/schema";
import type { RubricCriterion } from "@/lib/rubric";
import { segmentDocument, locatedQuoteIndexes } from "@/lib/highlight";
import { Card, CriterionChip, SeverityLabel, StatusBadge, VerdictBadge, buttonClass } from "./ui";

const labels: Record<Coverage["status"], string> = {
  checked: "Checked · no issue reported", finding: "Issue reported",
  not_applicable: "Not applicable", uncertain: "Needs investigation",
  unsupported: "Not supported", omitted: "Not assessed",
};
const gapStates = new Set(["uncertain", "unsupported", "omitted"]);

export function ResultView({ content, result, criteria }: {
  content: string; result: ReviewResult; criteria?: RubricCriterion[];
}) {
  const id = useId();
  const [panel, setPanel] = useState<"findings" | "coverage">("findings");
  const [mobilePanel, setMobilePanel] = useState<"document" | "review">("review");
  const [selected, setSelected] = useState<number | null>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const findingRefs = useRef<(HTMLLIElement | null)[]>([]);
  const quotes = result.findings.map(f => f.evidenceType === "absence" ? "" : f.quote);
  const segments = segmentDocument(content, quotes);
  const located = locatedQuoteIndexes(content, quotes);
  const gaps = result.coverage?.filter(c => gapStates.has(c.status)) ?? [];
  const descriptions = new Map(criteria?.map(c => [c.id, c.description]) ?? []);
  const challenges = new Map(result.judge?.challenges.map(c => [c.findingIndex, c.reason]) ?? []);

  function showSource(index: number) {
    setSelected(index);
    setMobilePanel("document");
    requestAnimationFrame(() => {
      const target = sourceRef.current?.querySelector<HTMLElement>(`[data-finding~="${index}"]`);
      (target ?? sourceRef.current)?.focus({ preventScroll: true });
      (target ?? sourceRef.current)?.scrollIntoView({ block: "center", behavior: "auto" });
    });
  }
  function showFinding(index: number) {
    setSelected(index);
    setMobilePanel("review");
    setPanel("findings");
    requestAnimationFrame(() => {
      findingRefs.current[index]?.focus({ preventScroll: true });
      findingRefs.current[index]?.scrollIntoView({ block: "nearest", behavior: "auto" });
    });
  }

  return <section aria-label="Review workspace" className="space-y-4">
    <div className="grid gap-4 rounded-xl border border-line bg-surface p-5 sm:grid-cols-[1fr_auto] sm:p-6">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted">AUTOMATED REVIEW</p>
        <div className="flex flex-wrap items-center gap-3">
          <VerdictBadge verdict={result.verdict} />
          <span className="text-sm text-muted">{result.findings.length} finding{result.findings.length === 1 ? "" : "s"}</span>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6">{result.summary}</p>
        <p className="mt-2 text-xs leading-5 text-muted">Scoped to the selected rules and markets. External claims are not independently verified. Officer decisions are recorded separately.</p>
      </div>
      <div className="flex flex-wrap items-start gap-2 sm:max-w-60 sm:justify-end">
        {result.jurisdictionVerdicts?.map(market => <StatusBadge key={market.jurisdiction} tone={market.verdict === "pass" ? "pass" : "warn"}>
          {market.jurisdiction} · {market.verdict === "pass" ? "No issues" : market.verdict === "fail" ? "Issues found" : "Review needed"}
        </StatusBadge>)}
        <button type="button" className={buttonClass("secondary", "sm")} onClick={() => { setPanel("coverage"); setMobilePanel("review"); }}>
          {result.coverage ? gaps.length ? `${gaps.length} coverage gap${gaps.length === 1 ? "" : "s"}` : `${result.coverage.length} rules assessed` : "Coverage unavailable"}
        </button>
      </div>
    </div>

    <div className="flex gap-2 lg:hidden" aria-label="Workspace panels">
      {(["document", "review"] as const).map(name => <button type="button" key={name} aria-pressed={mobilePanel === name} onClick={() => setMobilePanel(name)} className={buttonClass(mobilePanel === name ? "primary" : "secondary")}>
        {name === "document" ? "Source document" : "Review & coverage"}
      </button>)}
    </div>

    <div className="grid items-start gap-5 lg:grid-cols-[1.08fr_1fr]">
      <Card className={`overflow-hidden lg:sticky lg:top-24 ${mobilePanel === "document" ? "" : "hidden lg:block"}`}>
        <div className="flex items-center justify-between border-b border-line bg-rail px-5 py-4">
          <h2 className="text-sm font-semibold">Source document</h2>
          <span className="text-xs text-muted">Original text · read only</span>
        </div>
        <div ref={sourceRef} tabIndex={-1} aria-label="Original document text" className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words px-6 py-7 font-serif text-base leading-8 sm:px-8">
          {segments.map((segment, index) => segment.findingIndexes.length ? <mark
            key={index} tabIndex={0} role="button"
            aria-label={`View finding ${segment.findingIndexes[0] + 1}: ${segment.text}`}
            data-finding={segment.findingIndexes.join(" ")}
            onClick={() => showFinding(segment.findingIndexes[0])}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showFinding(segment.findingIndexes[0]); } }}
            className={`cursor-pointer border-b-2 text-ink ${selected !== null && segment.findingIndexes.includes(selected) ? "border-accent bg-accent-soft" : "border-warn/40 bg-warn-soft"}`}
          >{segment.text}</mark> : <span key={index}>{segment.text}</span>)}
        </div>
        <p className="border-t border-line px-5 py-3 text-xs leading-5 text-muted">Select a highlighted passage to inspect its finding. Missing-language checks are listed separately from quoted evidence.</p>
      </Card>

      <div className={`min-w-0 ${mobilePanel === "review" ? "" : "hidden lg:block"}`}>
        <div className="mb-4 flex items-center gap-2" aria-label="Review sections">
          <button type="button" aria-pressed={panel === "findings"} className={buttonClass(panel === "findings" ? "primary" : "secondary")} onClick={() => setPanel("findings")}>Findings ({result.findings.length})</button>
          <button type="button" aria-pressed={panel === "coverage"} className={buttonClass(panel === "coverage" ? "primary" : "secondary")} onClick={() => setPanel("coverage")}>Coverage{gaps.length ? ` · ${gaps.length} gaps` : ""}</button>
        </div>

        {panel === "findings" ? <>
          {result.findings.length === 0 ? <Card className="p-6">
            <h2 className="font-semibold">{gaps.length ? "No findings, but the review is incomplete" : "No issues reported"}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{gaps.length ? "Open Coverage to see the rules that require human attention." : "This result applies only to the checks recorded for this run. Review coverage before relying on it."}</p>
          </Card> : <ol className="space-y-3">
            {result.findings.map((finding, index) => <li
              key={index} ref={element => { findingRefs.current[index] = element; }}
              tabIndex={-1} id={`${id}-finding-${index}`}
              className={`rounded-xl border bg-surface p-5 ${selected === index ? "border-accent ring-1 ring-accent" : "border-line"}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-medium text-muted">{String(index + 1).padStart(2, "0")}</span>
                <CriterionChip id={finding.criterionId} /><SeverityLabel severity={finding.severity} />
                {finding.evidenceType === "absence" && <StatusBadge tone="warn">Required language missing</StatusBadge>}
              </div>
              <h3 className="mt-3 text-sm font-semibold leading-6">{finding.explanation}</h3>
              <blockquote className="mt-3 border-l-2 border-line-strong pl-3 font-serif text-sm leading-6 text-muted">{finding.evidenceType === "absence" ? "Context: " : ""}“{finding.quote}”</blockquote>
              {(finding.evidenceType === "absence" || !located[index]) && <p className="mt-2 text-xs leading-5 text-warn">{finding.evidenceType === "absence" ? "The quoted text is context. The finding concerns language absent from the document." : "Quote not located. Verify this evidence manually."}</p>}
              {challenges.has(index) && <p className="mt-3 rounded-md bg-warn-soft p-3 text-xs leading-5 text-warn">Evidence challenged: {challenges.get(index)}</p>}
              <div className="mt-4 border-t border-line pt-3">
                <p className="text-xs font-semibold text-accent-strong">SUGGESTED NEXT STEP</p>
                <p className="mt-1 text-sm leading-6">{finding.recommendation}</p>
              </div>
              <div className="mt-3 flex flex-wrap items-start gap-3">
                <button type="button" className={buttonClass("secondary", "sm")} onClick={() => showSource(index)}>{finding.evidenceType === "absence" || !located[index] ? "Read source document" : "Locate evidence ↗"}</button>
                {descriptions.get(finding.criterionId) && <details className="min-w-0 flex-1 text-xs leading-5">
                  <summary className="cursor-pointer py-2 font-medium text-accent-strong">Read rule {finding.criterionId}</summary>
                  <p className="pt-2 text-muted">{descriptions.get(finding.criterionId)}</p>
                </details>}
              </div>
            </li>)}
          </ol>}
          {result.judge && <details className="mt-4 rounded-lg border border-line p-4 text-xs leading-5">
            <summary className="cursor-pointer font-semibold">Verification notes{result.judge.challenges.length ? ` · ${result.judge.challenges.length} challenged` : ""}</summary>
            <p className="mt-2 text-muted">{result.judge.rationale}</p>
            <p className="mt-2 text-muted">Quote verification does not establish complete risk coverage or verify external facts.</p>
          </details>}
        </> : <Card className="overflow-hidden">
          <div className="border-b border-line bg-rail p-5">
            <h2 className="font-semibold">What this review covered</h2>
            <p className="mt-2 text-xs leading-5 text-muted">A completed check is not a guarantee. Unsupported, omitted, and uncertain checks require human attention.</p>
          </div>
          {!result.coverage ? <p className="p-5 text-sm text-muted">Coverage detail is unavailable for this historical run. Re-run the review to record an explicit assessment of each rule.</p> :
            <ul className="divide-y divide-line">{result.coverage.map(check => <li key={check.criterionId} className="p-5">
              <div className="flex flex-wrap items-center gap-2"><CriterionChip id={check.criterionId} />
                <StatusBadge tone={gapStates.has(check.status) ? "warn" : check.status === "finding" ? "fail" : "neutral"}>{labels[check.status]}</StatusBadge>
              </div>
              <p className="mt-2 text-sm leading-6">{descriptions.get(check.criterionId) ?? check.criterionId}</p>
              <p className="mt-2 text-xs leading-5 text-muted">{check.detail}</p>
            </li>)}</ul>}
        </Card>}
      </div>
    </div>
  </section>;
}
