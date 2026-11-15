import { siteGaps } from "@/lib/site";

/** Body copy for the legal pages — readable measure, generous leading. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-2xl space-y-6 text-[15px] leading-7 text-ink">
      {children}
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight">{heading}</h2>
      {children}
    </section>
  );
}

/** A value a real deployment must supply, shown as missing until it does. */
export function Configured({
  value,
  as,
}: {
  value: string | null;
  as: string;
}) {
  if (value) return <>{value}</>;
  return (
    <span className="rounded bg-warn-soft px-1.5 py-0.5 font-mono text-xs font-semibold text-warn">
      unset: {as}
    </span>
  );
}

/**
 * These pages describe real obligations. If the deployment has not said who
 * operates the service or how to reach them, say so at the top rather than
 * letting the page read as finished.
 */
export function UnconfiguredNotice() {
  const gaps = siteGaps();
  if (gaps.length === 0) return null;
  return (
    <div className="mb-8 max-w-2xl rounded-lg border border-warn/30 bg-warn-soft px-4 py-3.5 text-sm leading-6">
      <p className="font-semibold text-warn">This page is not ready to publish</p>
      <p className="mt-1 text-muted">
        It is a truthful description of how the software behaves, but it is not
        legal advice and it has not been reviewed by a lawyer. These values are
        still unset:{" "}
        <span className="font-mono text-xs">{gaps.join(", ")}</span>.
      </p>
    </div>
  );
}
