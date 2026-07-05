import Link from "next/link";
import { getSession } from "@/lib/session";
import { buttonClass } from "@/components/ui";

const homeByRole: Record<import("@/lib/session").Role, string> = {
  author: "/submit",
  officer: "/queue",
  admin: "/dashboard",
  auditor: "/audit",
};

const workflow = [
  {
    step: "Submit",
    title: "Authors enter the review lane",
    body: "Marketing emails, letters, landing-page copy, and other customer-facing text move through one intake path.",
  },
  {
    step: "Review",
    title: "AI returns evidence, not vibes",
    body: "Two reviewer lanes check policy claims and data-handling risk, then cite exact quotes with severity, explanation, and fix guidance.",
  },
  {
    step: "Decide",
    title: "Compliance makes the call",
    body: "Failed or uncertain documents route to an officer queue where every override and final decision requires a note.",
  },
  {
    step: "Audit",
    title: "History stays attached",
    body: "Rubric version, review result, decision notes, timestamps, and export records stay traceable for each document version.",
  },
];

const audiences = [
  {
    name: "Content authors",
    detail: "Get quote-level feedback and practical fixes without waiting days for a first read.",
  },
  {
    name: "Compliance officers",
    detail: "Work one queue ordered by risk, with every finding already attached to highlighted source text.",
  },
  {
    name: "Compliance leads",
    detail: "Edit criteria and severities in the UI, then run the golden-set gate before publishing a new rubric.",
  },
  {
    name: "Auditors",
    detail: "Open the full document history and export decisions, findings, notes, and rubric versions.",
  },
];

const proofPoints = [
  ["Reviewer mode", "Model or demo reviewer is visible before submission."],
  ["Human authority", "Officer decisions override the agent and enter the audit trail."],
  ["Rubric control", "Draft versions run against the golden set before publish."],
  ["Audit export", "CSV history includes reviews, findings, decisions, and notes."],
] as const;

export default async function LandingPage() {
  const session = await getSession();
  const appHref = session ? homeByRole[session.role] : "/login";
  const appLabel = session ? "Open Cleared" : "Try the demo";
  const secondaryLabel = session ? "Open workspace" : "View personas";
  const bottomCopy = session
    ? "Continue into your current demo workspace to inspect the seeded review data."
    : "Sign in as an author, officer, admin, or auditor to inspect the same product from each role.";
  const bottomAction = session ? "Open Cleared" : "Sign in as a persona";

  return (
    <div className="-mx-6 -mt-8">
      <section
        className="relative isolate overflow-hidden border-b border-line bg-ink text-white"
        style={{ minHeight: "min(540px, calc(100svh - 10rem))" }}
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center opacity-55"
          style={{ backgroundImage: "url('/landing-dashboard.png')" }}
        />
        <div aria-hidden className="absolute inset-0 bg-ink/62" />
        <div className="relative mx-auto flex min-h-[inherit] w-full max-w-6xl flex-col justify-center px-6 py-16">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex rounded-md border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
              AI-assisted compliance review
            </p>
            <h1 className="font-serif text-5xl leading-none tracking-tight sm:text-6xl lg:text-7xl">
              Cleared
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/82">
              Cleared helps teams review customer-facing documents before they
              ship. AI reviewers flag risky claims and data-handling issues with
              exact quotes and suggested fixes, while compliance officers keep
              the final decision and audit trail.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={appHref} className={buttonClass("primary")}>
                {appLabel}
              </Link>
              <Link
                href={appHref}
                className="inline-flex items-center justify-center rounded-md border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-white/20"
              >
                {secondaryLabel}
              </Link>
            </div>
          </div>
          <div className="mt-12 grid max-w-4xl border-y border-white/18 text-sm sm:grid-cols-4">
            {proofPoints.map(([label, detail]) => (
              <div key={label} className="border-white/18 py-4 sm:border-l sm:px-4 first:sm:border-l-0">
                <p className="font-semibold text-white">{label}</p>
                <p className="mt-1 leading-5 text-white/68">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[0.85fr_1.15fr] lg:py-16">
        <div className="max-w-md">
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            A review system for regulated customer communications.
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted">
            Cleared is built for teams that need evidence, not just a pass/fail
            score. It connects document submission, rubric-based AI review,
            human approval, version history, and exportable audit records in one
            Vercel-ready web app.
          </p>
        </div>
        <div className="border-t border-line">
          {workflow.map((item, index) => (
            <article
              key={item.step}
              className="grid gap-4 border-b border-line py-5 sm:grid-cols-[7rem_1fr]"
            >
              <p className="font-mono text-xs font-semibold text-accent-strong">
                {String(index + 1).padStart(2, "0")} / {item.step}
              </p>
              <div>
                <h3 className="text-base font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">
              Built around the actual handoffs.
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Each screen has a job: faster author fixes, less officer re-read,
              safer rubric changes, and cleaner audit exports.
            </p>
            <figure
              className="mt-8 overflow-hidden rounded-lg border border-line bg-rail"
              style={{ aspectRatio: "16 / 10" }}
            >
              <img
                src="/landing-dashboard.png"
                alt="Cleared dashboard showing review volume, pass rate, criteria, and audit export."
                className="block h-full w-full max-w-full object-cover object-top"
                style={{ height: "100%", width: "100%" }}
              />
            </figure>
          </div>
          <div className="grid gap-4">
            {audiences.map((audience) => (
              <div
                key={audience.name}
                className="grid gap-2 border-t border-line pt-4 sm:grid-cols-[10rem_1fr]"
              >
                <h3 className="font-semibold">{audience.name}</h3>
                <p className="text-sm leading-6 text-muted">
                  {audience.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-4 border-y border-accent/25 bg-accent-soft px-1 py-6 sm:grid-cols-[1fr_auto] sm:items-center sm:px-0">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-accent-strong">
              See the demo workflow with seeded compliance examples.
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {bottomCopy}
            </p>
          </div>
          <Link href={appHref} className={buttonClass("primary")}>
            {bottomAction}
          </Link>
        </div>
      </section>
    </div>
  );
}
