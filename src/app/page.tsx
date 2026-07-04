import Link from "next/link";
import { getSession } from "@/lib/session";
import { buttonClass } from "@/components/ui";

const homeByRole = {
  author: "/submit",
  officer: "/queue",
  admin: "/dashboard",
} as const;

const productStats = [
  { label: "Human-review queue", value: "Always on" },
  { label: "Rubric versions", value: "Auditable" },
  { label: "Exports", value: "CSV-ready" },
];

const workflow = [
  {
    step: "Submit",
    title: "Authors paste customer-facing copy",
    body: "Marketing emails, letters, landing-page text, and other outbound material enter one review flow before they ship.",
  },
  {
    step: "Review",
    title: "AI reviewers cite the exact problem",
    body: "Two reviewer lanes check policy claims and data-handling risk, then return structured findings with quotes, severity, explanations, and fixes.",
  },
  {
    step: "Decide",
    title: "Compliance keeps final authority",
    body: "Failed or uncertain documents route to a queue where officers accept or dismiss findings and approve or reject with a required note.",
  },
  {
    step: "Audit",
    title: "Every version remains traceable",
    body: "Cleared stores rubric version, review result, decision notes, timestamps, and CSV export paths for compliance and audit review.",
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

export default async function LandingPage() {
  const session = await getSession();
  const appHref = session ? homeByRole[session.role] : "/login";
  const appLabel = session ? "Open Cleared" : "Try the demo";

  return (
    <div className="-mx-6 -mt-8">
      <section
        className="relative isolate overflow-hidden border-b border-line bg-ink text-white"
        style={{ minHeight: "min(620px, calc(100svh - 9rem))" }}
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center opacity-45"
          style={{ backgroundImage: "url('/landing-dashboard.png')" }}
        />
        <div aria-hidden className="absolute inset-0 bg-ink/55" />
        <div className="relative mx-auto flex min-h-[inherit] w-full max-w-6xl flex-col justify-center px-6 py-16">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
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
                href="/login"
                className="inline-flex items-center justify-center rounded-md border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-white/20"
              >
                View personas
              </Link>
            </div>
          </div>
          <div className="mt-12 grid max-w-3xl gap-3 sm:grid-cols-3">
            {productStats.map((stat) => (
              <div
                key={stat.label}
                className="border-l border-white/25 pl-4 text-sm"
              >
                <p className="font-semibold text-white">{stat.value}</p>
                <p className="mt-1 text-white/65">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:py-16">
        <div>
          <p className="text-sm font-semibold text-accent-strong">
            What the product does
          </p>
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
        <div className="grid gap-3 sm:grid-cols-2">
          {workflow.map((item) => (
            <article
              key={item.step}
              className="rounded-lg border border-line bg-surface p-5 shadow-card"
            >
              <p className="font-mono text-xs font-semibold text-accent-strong">
                {item.step}
              </p>
              <h3 className="mt-3 text-base font-semibold tracking-tight">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Built around the people who touch the review.
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Each screen has a job: faster author fixes, less officer re-read,
              safer rubric changes, and cleaner audit exports.
            </p>
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
        <div className="grid gap-4 rounded-lg border border-line bg-accent-soft p-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-accent-strong">
              See the demo workflow with seeded compliance examples.
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Sign in as an author, officer, admin, or auditor to inspect the
              same product from each role.
            </p>
          </div>
          <Link href="/login" className={buttonClass("primary")}>
            Sign in as a persona
          </Link>
        </div>
      </section>
    </div>
  );
}
