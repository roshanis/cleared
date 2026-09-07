import Link from "next/link";
import { getSession, homeByRole, demoAuthEnabled } from "@/lib/session";
import { runReview } from "@/agent/run";
import { defaultRubricDraft } from "@/lib/rubric";
import { sampleDocument } from "@/lib/copy";
import { ResultView } from "@/components/result-view";
import { StatusBadge, SeverityLabel, buttonClass } from "@/components/ui";

export default async function LandingPage() {
  const session = await getSession();
  const demo = demoAuthEnabled();
  const href = session ? homeByRole[session.role] : "/login";
  const result = await runReview(sampleDocument.content, defaultRubricDraft, "heuristic");
  return <div className="relative left-1/2 -mt-8 w-screen -translate-x-1/2">
    <section className="relative overflow-hidden border-b border-line bg-brand-deep text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 sm:px-10 sm:py-20 lg:grid-cols-[1fr_0.95fr] lg:gap-16 lg:py-24">
        <div>
          <p className="mb-6 text-xs font-semibold tracking-[0.16em] text-[#b5d6cc]">FOR INVESTMENT COMMUNICATIONS</p>
          <h1 className="max-w-xl font-serif text-5xl leading-[1.08] tracking-tight sm:text-6xl">A clearer path<br />from draft<br /><em className="text-[#c5ded3]">to decision.</em></h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-[#deebe5]">Find risky claims, see the evidence, and keep your compliance team in control. Cleared brings review, revisions, and the decision record into one workspace.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={href} className="inline-flex min-h-12 items-center rounded-md bg-[#e7eee0] px-5 py-3 text-sm font-semibold text-[#103d3d] hover:bg-white">{session ? "Open your workspace" : demo ? "Explore the demo" : "Sign in to your workspace"} →</Link>
            <Link href="#sample-review" className="inline-flex min-h-12 items-center rounded-md border border-white/40 px-5 py-3 text-sm font-medium text-white hover:bg-white/10">Inspect a sample review</Link>
          </div>
          <p className="mt-5 text-xs leading-5 text-[#b5d6cc]">Evidence you can inspect. Coverage gaps you can see. Decisions your team owns.</p>
        </div>
        <div className="rounded-xl border border-white/20 bg-paper p-3 text-ink shadow-raised sm:p-5">
          <div className="flex items-center justify-between border-b border-line px-2 pb-4"><span className="text-sm font-semibold">Review workspace</span><StatusBadge tone="warn">Synthetic sample</StatusBadge></div>
          <div className="px-2 py-5"><p className="text-xs text-muted">INVESTOR EMAIL · US · RUBRIC V1</p><h2 className="mt-2 text-xl font-semibold">Q3 investor update</h2><p className="mt-2 text-sm text-muted">{result.findings.length} findings to inspect · Human decision pending</p></div>
          <div className="rounded-lg border border-line bg-surface p-5"><p className="font-serif text-base leading-8">“With our proven strategy you get <mark className="bg-warn-soft text-ink">guaranteed returns with zero risk.</mark>”</p></div>
          <div className="mt-3 space-y-2">{result.findings.slice(0,2).map((finding,i) => <div key={i} className="rounded-lg border border-line bg-surface p-4"><div className="flex items-center gap-2"><span className="font-mono text-xs text-accent-strong">{finding.criterionId}</span><SeverityLabel severity={finding.severity} /></div><p className="mt-2 text-sm leading-6">{finding.explanation}</p></div>)}</div>
          <Link href="#sample-review" className="mt-4 block px-2 text-sm font-semibold text-accent-strong">Inspect findings and coverage ↗</Link>
        </div>
      </div>
    </section>
    <section className="border-b border-line bg-surface px-6 py-8 sm:px-10">
      <div className="mx-auto grid max-w-6xl gap-7 sm:grid-cols-3">
        {[["01", "Review with context", "Select the markets and rubric that apply. See which checks ran and which still need attention."], ["02", "Move from finding to fix", "Inspect a claim beside its rule, review proposed edits, and resubmit without losing the history."], ["03", "Make the decision traceable", "Record who approved or requested changes, why, and the exact version they reviewed."]].map(([n,title,detail]) => <div key={n}><p className="text-xs font-mono text-accent-strong">{n}</p><h2 className="mt-3 text-base font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted">{detail}</p></div>)}
      </div>
    </section>
    <section id="sample-review" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-14 sm:px-8 sm:py-20">
      <div className="mb-8 grid items-end gap-5 lg:grid-cols-[1fr_26rem]">
        <div><p className="text-xs font-semibold tracking-wide text-accent-strong">INSIDE CLEARED</p><h2 className="mt-3 font-serif text-3xl tracking-tight sm:text-4xl">The finding is only the beginning.</h2><p className="mt-4 max-w-xl text-sm leading-7 text-muted">Select a finding to locate its source. Open Coverage to inspect the checks behind the result. This sample runs through the same deterministic review path as the demo.</p></div>
        <p className="rounded-lg border border-line bg-surface p-4 text-xs leading-6 text-muted">This is synthetic investment copy checked against a starter rubric. Demo checks are limited; the result is not a legal opinion, approval, or independent verification of the claims.</p>
      </div>
      <ResultView content={sampleDocument.content} result={result} criteria={defaultRubricDraft.criteria} />
    </section>
    <section className="border-y border-line bg-surface px-6 py-14 sm:px-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_1fr]">
        <div><h2 className="font-serif text-3xl tracking-tight">Your rules.<br />Your team’s final word.</h2><p className="mt-4 max-w-md text-sm leading-7 text-muted">Authors, officers, compliance leads, and auditors share one record, with the actions appropriate to their role.</p></div>
        <dl className="divide-y divide-line text-sm">{[["Versioned review rules", "Publish rubric changes after running the evaluation gate. Each review retains its original rubric version."], ["Visible uncertainty", "Unsupported checks and conflicting assessments stay visible for human investigation."], ["A record that stays intact", "Revisions and re-runs keep their earlier outcomes. Inspect each review and its recorded decision."]].map(([title,detail]) => <div key={title} className="py-4 first:pt-0"><dt className="font-semibold">{title}</dt><dd className="mt-2 leading-6 text-muted">{detail}</dd></div>)}</dl>
      </div>
    </section>
    <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-10"><div><p className="font-semibold text-accent-strong">Cleared.</p><p className="mt-1 text-xs text-muted">From draft to a documented decision.</p></div><Link href={href} className={buttonClass("primary")}>{session ? "Open workspace" : demo ? "Try the workflow" : "Sign in"} →</Link></footer>
  </div>;
}
