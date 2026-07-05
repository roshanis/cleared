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
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="bg-accent-strong text-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-white sm:text-5xl">
            Compliance review, before it ships.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/80">
            Cleared runs customer-facing documents through an AI compliance
            reviewer that quotes exact violations and proposes fixes, while your
            team keeps the final decision and an unbroken audit trail.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={appHref}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md bg-white px-4 py-2 text-sm font-semibold text-accent-strong transition-colors duration-150 hover:bg-white/90 active:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {appLabel}
            </Link>
            <Link
              href="#live-review"
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-white/20 active:bg-white/30"
            >
              See a real review
            </Link>
          </div>
        </div>
      </section>

      {/* ── Live review proof (centerpiece) ───────────────────────────── */}
      <section id="live-review" className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            A real review, run at page load.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            This is the demo reviewer&apos;s output for the sample document
            below — run through the actual pipeline at request time, not a
            mockup. The document is a synthetic investor email designed to
            trigger the rubric.
          </p>
          <div className="mt-8">
            <ResultView
              content={sampleDocument.content}
              result={result}
              criteria={defaultRubricDraft.criteria}
            />
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            How it works
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            One path from draft to cleared — with AI finding the problems and
            humans making the calls.
          </p>
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <HowItWorksStep key={s.step} {...s} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Personas ──────────────────────────────────────────────────── */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            Four seats, one system
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Sign in as any persona to see the review system from their vantage
            point.
          </p>
          <div className="mt-8 grid gap-2.5 sm:grid-cols-2">
            {personas.map((persona) => (
              <Link
                key={persona.id}
                href={`/login?as=${persona.id}`}
                className="group flex items-center gap-3.5 rounded-lg border border-line bg-surface p-4 shadow-card transition-colors duration-150 hover:border-accent hover:bg-accent-soft/35"
              >
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-sm font-semibold text-accent-strong"
                >
                  {initials(persona.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">
                      {persona.name}
                    </span>
                    <span className="rounded-md bg-well px-2 py-0.5 text-[11px] font-medium text-muted">
                      {persona.role}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted">
                    {persona.sees}
                  </span>
                </span>
                <svg
                  aria-hidden
                  viewBox="0 0 16 16"
                  className="h-4 w-4 shrink-0 text-line-strong transition-colors duration-150 group-hover:text-accent"
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

      {/* ── Bottom CTA band ───────────────────────────────────────────── */}
      <section className="border-t border-line bg-accent-soft">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-10">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-accent-strong">
              {session
                ? "Continue into your workspace."
                : "Sign in as a persona and try it."}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
              {session
                ? "Continue into your current demo workspace to inspect the seeded review data."
                : "Sign in as an author, officer, admin, or auditor to inspect the same product from each role."}
            </p>
          </div>
          <Link href={appHref} className={buttonClass("primary")}>
            {session ? "Open Cleared" : "Sign in as a persona"}
          </Link>
        </div>
      </section>
    </div>
  );
}
