import { segmentDocument } from "@/lib/highlight";
import type { Severity } from "@/lib/rubric";
import type { ReviewResult } from "@/schema";
import {
  Card,
  CriterionChip,
  SectionHeading,
  SeverityLabel,
  StatusBadge,
  VerdictBadge,
} from "./ui";

/* Highlights keep the document text in ink for readability; severity is
   carried by the soft background and a colored underline. */
const markStyles: Record<Severity, string> = {
  critical: "bg-fail-soft border-b-2 border-fail/50",
  major: "bg-warn-soft border-b-2 border-warn/50",
  minor: "bg-accent-soft border-b-2 border-accent/40",
};

const severityOrder: Severity[] = ["critical", "major", "minor"];

/** Shared review rendering: highlighted document + findings panel. */
export function ResultView({
  content,
  result,
}: {
  content: string;
  result: ReviewResult;
}) {
  const segments = segmentDocument(
    content,
    result.findings.map((f) => f.quote),
  );

  const severityCounts = severityOrder
    .map((severity) => ({
      severity,
      count: result.findings.filter((f) => f.severity === severity).length,
    }))
    .filter(({ count }) => count > 0);

  return (
    <div className="space-y-4">
      <Card className="border-accent/20 bg-rail p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <VerdictBadge verdict={result.verdict} />
              <StatusBadge
                tone={result.findings.length === 0 ? "pass" : "neutral"}
              >
                {result.findings.length} finding
                {result.findings.length === 1 ? "" : "s"}
              </StatusBadge>
            </div>
            <p className="max-w-3xl text-sm leading-6">{result.summary}</p>
          </div>
          {severityCounts.length > 0 && (
            <span className="flex shrink-0 flex-wrap items-center gap-3 pt-0.5">
              {severityCounts.map(({ severity, count }) => (
                <span
                  key={severity}
                  className="inline-flex items-center gap-1 text-xs font-medium tabular-nums text-muted"
                >
                  {count} <SeverityLabel severity={severity} />
                </span>
              ))}
            </span>
          )}
        </div>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
        <Card className="overflow-hidden">
          <div className="flex items-baseline justify-between gap-3 border-b border-line bg-rail px-5 py-3">
            <SectionHeading>Document</SectionHeading>
            <span className="text-xs text-muted">
              {result.findings.length > 0
                ? "Quoted passages highlighted"
                : "No highlights"}
            </span>
          </div>
          <div className="max-h-[42rem] overflow-auto p-5">
            <p className="whitespace-pre-wrap font-serif text-[15px] leading-7">
              {segments.map((segment, i) => {
                if (segment.findingIndexes.length === 0) {
                  return <span key={i}>{segment.text}</span>;
                }
                const first = result.findings[segment.findingIndexes[0]];
                return (
                  <mark
                    key={i}
                    id={`quote-${segment.findingIndexes[0]}`}
                    title={segment.findingIndexes
                      .map((idx) => result.findings[idx]?.criterionId)
                      .join(", ")}
                    className={`text-ink ${markStyles[first.severity]}`}
                  >
                    {segment.text}
                  </mark>
                );
              })}
            </p>
          </div>
        </Card>

        <div className="space-y-3 lg:sticky lg:top-20">
          <SectionHeading count={result.findings.length}>
            Findings
          </SectionHeading>
          {result.findings.length === 0 ? (
            <Card className="flex items-center gap-3 p-5">
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-pass-soft"
              >
                <svg
                  viewBox="0 0 16 16"
                  className="h-4 w-4 text-pass"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M13.5 4.5 6.4 11.6 2.5 7.7" />
                </svg>
              </span>
              <p className="text-sm text-muted">
                No rubric violations found in this version.
              </p>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-lg border border-line bg-surface">
              {result.findings.map((finding, i) => (
                <article key={i} className="border-b border-line p-4 last:border-b-0">
                  <div className="flex items-center justify-between gap-3">
                    <a
                      href={`#quote-${i}`}
                      className="hover:opacity-80"
                      title="Jump to the highlighted passage"
                    >
                      <CriterionChip id={finding.criterionId} />
                    </a>
                    <SeverityLabel severity={finding.severity} />
                  </div>
                  <p className="mt-3 border-l-2 border-line pl-3 font-serif text-sm italic leading-6 text-muted">
                    "{finding.quote}"
                  </p>
                  <p className="mt-3 text-sm leading-6">
                    {finding.explanation}
                  </p>
                  <p className="mt-2 rounded-md bg-rail px-3 py-2 text-sm leading-6">
                    <span className="font-semibold text-accent-strong">
                      Fix:{" "}
                    </span>
                    {finding.recommendation}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
