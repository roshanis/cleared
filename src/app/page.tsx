import Link from "next/link";
import { getSession, homeByRole, personas } from "@/lib/session";
import { runReview } from "@/agent/run";
import { defaultRubricDraft } from "@/lib/rubric";
import { sampleDocument } from "@/lib/copy";
import { ResultView } from "@/components/result-view";
import { HowItWorksStep, buttonClass, initials } from "@/components/ui";

const steps = [
  {
    step: 1,
    title: "Submit",
    detail:
      "Authors paste customer-facing text — emails, letters, landing pages — into one intake path.",
  },
  {
    step: 2,
    title: "Review",
    detail:
      "AI reviewers check every claim against the compliance rubric and cite exact quotes with severity and fix guidance.",
  },
  {
    step: 3,
    title: "Decide",
    detail:
      "Compliance officers work one queue with every finding highlighted; every override requires a note.",
  },
  {
    step: 4,
    title: "Audit",
    detail:
      "Rubric version, review result, decision notes, timestamps, and export records stay traceable for each document version.",
  },
];

const onDarkPrimary =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-accent-strong transition-colors duration-150 hover:bg-white/90 active:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

const onDarkGhost =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-white/25 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:border-white/50 hover:bg-white/10 active:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export default async function LandingPage() {
  const session = await getSession();
  const appHref = session ? homeByRole[session.role] : "/login";
  const appLabel = session ? "Open Cleared" : "Try the demo";

  const result = await runReview(
    sampleDocument.content,
    defaultRubricDraft,
    "heuristic",
  );

  return (
    <div className="-mx-6 -mt-8">
      {/* ── Hero: one statement, drenched ─────────────────────────────── */}
      <section className="flex min-h-[calc(100svh-3.5rem)] flex-col bg-accent-strong text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-20">
          <h1
            className="animate-rise max-w-4xl font-serif text-5xl leading-[1.04] tracking-tight sm:text-6xl lg:text-[4.75rem]"
            style={{ "--rise-delay": "0ms" } as React.CSSProperties}
          >
            Compliance review,
            <br />
            <em className="text-white/80">before it ships.</em>
          </h1>
          <p
            className="animate-rise mt-8 max-w-xl text-lg leading-8 text-white/75"
            style={{ "--rise-delay": "120ms" } as React.CSSProperties}
          >
            An AI reviewer that quotes exact violations and proposes the fix.
            Your team keeps the final word — and the audit trail proves it.
          </p>
          <div
            className="animate-rise mt-10 flex flex-wrap gap-3"
            style={{ "--rise-delay": "240ms" } as React.CSSProperties}
          >
            <Link href={appHref} className={onDarkPrimary}>
              {appLabel}
            </Link>
            <Link href="#live-review" className={onDarkGhost}>
              See a real review
            </Link>
          </div>
        </div>
        <div
          className="animate-rise mx-auto w-full max-w-6xl px-6 pb-8"
          style={{ "--rise-delay": "480ms" } as React.CSSProperties}
        >
          <p className="flex items-center gap-2 text-xs font-medium text-white/50">
            <svg
              aria-hidden
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" />
            </svg>
            The review below was run by the live pipeline when this page loaded
          </p>
        </div>
      </section>

      {/* ── Live review proof (centerpiece) ───────────────────────────── */}
      <section id="live-review" className="bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="max-w-2xl">
            <h2 className="font-serif text-3xl tracking-tight text-ink sm:text-4xl">
              This is not a screenshot.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted">
              When this page loaded, the demo reviewer read the synthetic
              investor email below and produced this verdict — {" "}
              <span className="font-semibold text-ink">
                {result.findings.length} findings
              </span>
              , each with the exact quote and the fix. Reload and it runs
              again.
            </p>
          </div>
          <div className="mt-10 rounded-xl border border-line bg-paper p-4 shadow-raised sm:p-6">
            <ResultView
              content={sampleDocument.content}
              result={result}
              criteria={defaultRubricDraft.criteria}
            />
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <h2 className="font-serif text-3xl tracking-tight text-ink">
            How it works
          </h2>
          <p className="mt-3 max-w-xl text-base leading-7 text-muted">
            One path from draft to cleared — AI finds the problems, humans make
            the calls.
          </p>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <HowItWorksStep key={s.step} {...s} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Personas ──────────────────────────────────────────────────── */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <h2 className="font-serif text-3xl tracking-tight text-ink">
            Four seats, one system
          </h2>
          <p className="mt-3 max-w-xl text-base leading-7 text-muted">
            Sign in as any persona to see the review system from their vantage
            point.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {personas.map((persona) => (
              <Link
                key={persona.id}
                href={`/login?as=${persona.id}`}
                className="group flex items-center gap-4 rounded-xl border border-line bg-paper p-5 shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:border-accent hover:shadow-raised"
              >
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-strong"
                >
                  {initials(persona.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {persona.name}
                    </span>
                    <span className="rounded-md bg-well px-2 py-0.5 text-[11px] font-medium text-muted">
                      {persona.role}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-muted">
                    {persona.sees}
                  </span>
                </span>
                <svg
                  aria-hidden
                  viewBox="0 0 16 16"
                  className="h-4 w-4 shrink-0 text-line-strong transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-accent"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 3.5 10.5 8 6 12.5" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closer: mirror the hero ───────────────────────────────────── */}
      <section className="bg-accent-strong text-white">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center sm:py-24">
          <h2 className="mx-auto max-w-2xl font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
            {session
              ? "Your workspace is waiting."
              : "Ready when your next document is."}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-white/70">
            {session
              ? "Continue into the demo workspace and inspect the seeded review data."
              : "Pick a seat — author, officer, admin, or auditor — and see the same review from every side."}
          </p>
          <div className="mt-8">
            <Link href={appHref} className={onDarkPrimary}>
              {session ? "Open Cleared" : "Sign in as a persona"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
