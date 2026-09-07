import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DecisionPanel } from "@/components/decision-panel";
import { FixDraftPanel } from "@/components/fix-draft-panel";
import { RerunPanel } from "@/components/rerun-panel";
import { ResultView } from "@/components/result-view";
import { Card, PageHeader, StatusBadge, VerdictBadge, buttonClass } from "@/components/ui";
import { canDecide, canExport, canRerun, canSubmit } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import { canAccessDocument } from "@/lib/access";
import { decisionForRun, getDb } from "@/lib/store";
import { currentRun, documentHistory, selectRun, runHref } from "@/lib/review-workspace";

export default async function DocumentPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ run?: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const { run: requestedRun } = await searchParams;
  const db = await getDb();
  const document = db.documents.find(d => d.id === id);
  if (!document) notFound();
  if (!canAccessDocument(session, document)) redirect("/documents");
  const history = documentHistory(db, id);
  const run = selectRun(db, id, requestedRun);
  if (requestedRun && !run) notFound();
  const version = run ? db.versions.find(v => v.id === run.versionId)! : history[0]?.version;
  const latestRun = currentRun(db, id);
  const historical = !!run && run.id !== latestRun?.id;
  const decision = run ? decisionForRun(db, run.id) : null;
  const totalRuns = history.reduce((sum, entry) => sum + entry.runs.length, 0);
  const rubric = db.rubrics.find(r => r.version === run?.rubricVersion);
  const prev = history.find(entry => entry.version.number < (version?.number ?? 0))?.runs.find(r => r.result);
  const comparable = !!prev && prev.rubricVersion === run?.rubricVersion &&
    [...(prev.jurisdictions ?? ["US"])].sort().join() === [...(run?.jurisdictions ?? ["US"])].sort().join();
  const key = (f: { criterionId: string; quote: string }) => f.criterionId + ":" + f.quote.toLowerCase().replace(/\s+/g, " ").trim();
  const before = new Set(prev?.result?.findings.map(key) ?? []);
  const after = new Set(run?.result?.findings.map(key) ?? []);
  const noLongerReported = [...before].filter(k => !after.has(k)).length;
  const newFindings = [...after].filter(k => !before.has(k)).length;

  return <div className="space-y-6">
    <Link href={session.role === "officer" || session.role === "admin" ? "/queue" : "/documents"} className="text-sm font-medium text-accent-strong">← {session.role === "officer" || session.role === "admin" ? "Review queue" : "Documents"}</Link>
    <PageHeader title={document.title}
      subtitle={<span className="flex flex-wrap items-center gap-2"><span>{document.author}</span><span aria-hidden>·</span><span>Version {version?.number ?? 1}</span><StatusBadge>Rubric {run?.rubricVersion ?? "—"}</StatusBadge><StatusBadge tone={run?.reviewer === "model" ? "accent" : "warn"}>{run?.reviewer === "model" ? "Model review" : "Demo review"}</StatusBadge></span>}
      action={<div className="flex flex-wrap gap-2">
        {canSubmit(session.role) && <Link href={`/submit?documentId=${id}`} className={buttonClass("primary")}>Revise document</Link>}
        {canExport(session.role) && <a href="/api/export" className={buttonClass("secondary")}>Export workspace audit</a>}
        <a href="#review-history" className={buttonClass("ghost")}>History ({totalRuns})</a>
      </div>} />

    {historical && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warn/30 bg-warn-soft p-4 text-sm">
      <span>You are viewing an earlier review. Its result and decision belong to this run.</span>
      <Link href={`/documents/${id}`} className={buttonClass("secondary", "sm")}>Open current version</Link>
    </div>}

    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold tracking-wide text-muted">HUMAN DECISION</span>
        <StatusBadge tone={decision?.action === "approve" ? "pass" : decision ? "fail" : "neutral"}>
          {decision ? decision.action === "approve" ? "Approved" : "Changes requested" : run?.result?.verdict === "pass" ? "No officer decision recorded" : "Awaiting decision"}
        </StatusBadge>
        {decision && <span className="text-sm text-muted">by {decision.officer} · {new Date(decision.createdAt).toLocaleDateString()}</span>}
      </div>
      {run && <span className="break-all font-mono text-[11px] text-muted">Run {run.id}</span>}
      {decision && <p className="w-full border-t border-line pt-3 text-sm leading-6">{decision.note}</p>}
    </div>

    {prev && run?.result && <details className="rounded-lg border border-line bg-surface p-4 text-sm">
      <summary className="cursor-pointer font-medium">Changes from the previous document version</summary>
      <p className="mt-3 text-muted">{comparable ? `${noLongerReported} previous finding(s) no longer reported; ${newFindings} new or changed finding(s). A changed quote is not proof an issue was resolved.` : "The rubric or markets changed between reviews. These outcomes cannot be treated as a like-for-like comparison."}</p>
      <Link href={runHref(id, prev.id)} className="mt-3 inline-block font-medium text-accent-strong underline">Inspect the previous review</Link>
    </details>}

    {run?.result ? <ResultView key={`result-${run.id}`} content={version?.content ?? ""} result={run.result} criteria={rubric?.criteria} /> :
      <Card className="p-6"><h2 className="font-semibold">{run?.status === "error" ? "Review interrupted" : "No completed review yet"}</h2><p className="mt-2 text-sm text-muted">{run?.error ?? "The document is saved. Review its status below."}</p></Card>}

    {run && (canRerun(session.role) || run.status !== "done") && <RerunPanel key={`rerun-${run.id}`} runId={run.id} documentId={id} userId={session.userId} status={run.status} canRerun={canRerun(session.role)} />}
    {run?.status === "done" && run.result?.verdict !== "pass" && canDecide(session.role) && !decision &&
      <DecisionPanel key={`decision-${run.id}`} runId={run.id} findings={run.result?.findings ?? []} judge={run.result?.judge} coverage={run.result?.coverage} />}
    {!historical && run?.status === "done" && run.result?.verdict !== "pass" && canSubmit(session.role) && <FixDraftPanel runId={run.id} />}

    <section id="review-history" className="scroll-mt-24">
      <div className="mb-4 flex items-baseline gap-3"><h2 className="text-lg font-semibold">Review history</h2><span className="text-sm text-muted">{history.length} version(s) · {totalRuns} run(s)</span></div>
      <Card className="overflow-hidden">
        {history.map(entry => <div key={entry.version.id} className="border-b border-line last:border-b-0">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-rail px-5 py-3 text-sm"><h3 className="font-semibold">Version {entry.version.number}</h3><span className="text-xs text-muted">{entry.version.author} · {new Date(entry.version.createdAt).toLocaleString()}</span></div>
          {entry.runs.length === 0 && <p className="p-5 text-sm text-muted">No review runs for this version.</p>}
          {entry.runs.map((item, index) => {
            const recorded = decisionForRun(db, item.id);
            return <div key={item.id} className={`grid gap-3 border-t border-line p-5 sm:grid-cols-[1fr_auto] ${item.id === run?.id ? "bg-accent-soft/30" : ""}`}>
              <div>
                <Link href={runHref(id, item.id)} aria-current={item.id === run?.id ? "page" : undefined} className="text-sm font-semibold text-accent-strong underline underline-offset-4">Review {entry.runs.length - index}{item.id === run?.id ? " · viewing" : ""}</Link>
                <p className="mt-2 text-xs leading-5 text-muted">{new Date(item.createdAt).toLocaleString()} · {(item.jurisdictions ?? ["US"]).join(" / ")} · Rubric {item.rubricVersion} · {item.reviewer === "model" ? "Model" : "Demo"}</p>
                {recorded && <p className="mt-2 text-sm leading-6">{recorded.action === "approve" ? "Approved" : "Changes requested"} by {recorded.officer}: {recorded.note}</p>}
              </div>
              <div>{item.result ? <VerdictBadge verdict={item.result.verdict} /> : <StatusBadge tone={item.status === "error" ? "fail" : "info"}>{item.status}</StatusBadge>}</div>
            </div>;
          })}
        </div>)}
      </Card>
    </section>
  </div>;
}
