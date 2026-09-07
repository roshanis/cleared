import type { ReactNode } from "react";
export function ReviewProgress({ elapsedMs, submitting = false, children }: {
  elapsedMs: number; reducedMotion?: boolean; submitting?: boolean; children?: ReactNode;
}) {
  return <div role="status" className="rounded-xl border border-accent/25 bg-accent-soft/50 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-sm font-semibold">{submitting ? "Saving your document…" : "Review running…"}</h2>
      <span aria-hidden className="font-mono text-xs text-muted">{Math.floor(elapsedMs / 1000)}s elapsed</span>
    </div>
    <p className="mt-2 text-sm leading-6 text-muted">{submitting ? "Your document is being saved before review begins." : "Your document is saved. We will show the result as soon as the review completes."}</p>
    <p className="mt-3 text-xs leading-5 text-muted">The review checks policy and data-handling rules, then verifies the findings. Individual stage progress is not available.</p>
    {children}
  </div>;
}
