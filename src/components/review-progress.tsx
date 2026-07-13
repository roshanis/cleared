import { REVIEW_STAGES, stageIndexAt } from "./review-theater";
import { Card } from "./ui";

export function ReviewProgress({
  elapsedMs,
  reducedMotion,
  submitting = false,
  children,
}: {
  elapsedMs: number;
  reducedMotion: boolean;
  submitting?: boolean;
  children?: React.ReactNode;
}) {
  const stage = submitting
    ? 0
    : Math.max(1, stageIndexAt(elapsedMs, reducedMotion));

  return (
    <Card
      className="space-y-4 border-accent/25 bg-accent-soft/45 p-5"
      aria-live="polite"
    >
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Review in progress</h2>
        <span className="text-xs tabular-nums text-muted">
          {Math.round(elapsedMs / 1000)}s
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {REVIEW_STAGES.map((label, i) => (
          <ProgressStep
            key={label}
            done={i < stage}
            active={i === stage}
            label={label}
          />
        ))}
      </div>
      <p className="pt-1 text-xs text-muted">
        Two reviewers check policy claims and data-handling risk in parallel; a
        judge verifies every quoted finding before the verdict is applied from
        the rubric.
      </p>
      {children}
    </Card>
  );
}

export function ProgressStep({
  done,
  active = false,
  label,
}: {
  done: boolean;
  active?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span
        aria-hidden
        className={`h-2.5 w-2.5 rounded-full ${
          done ? "bg-pass" : active ? "animate-pulse-soft bg-accent" : "bg-line-strong"
        }`}
      />
      <span className={done ? "text-muted" : active ? "font-medium" : "text-muted"}>
        {label}
      </span>
    </div>
  );
}
