import Link from "next/link";
import { Card, EmptyState, PageHeader, StatusBadge, VerdictBadge, buttonClass, inputClass, selectClass, relativeTime } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { decisionForRun, getDb } from "@/lib/store";
import { canSubmit } from "@/lib/roles";
import { canAccessDocument } from "@/lib/access";
import { currentRun, documentHistory, runHref } from "@/lib/review-workspace";
import { documentStatus } from "@/lib/document-status";

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const session = await requireSession();
  const db = await getDb();
  const query = await searchParams;
  const documents = db.documents.filter(d => canAccessDocument(session, d)).map(document => {
    const run = currentRun(db, document.id);
    const version = documentHistory(db, document.id)[0]?.version;
    const decision = run ? decisionForRun(db, run.id) : null;
    const status = run?.status === "error" ? "error" : run?.status === "queued" || run?.status === "reviewing" ? "running" :
      documentStatus({ verdict: run?.result?.verdict ?? null, hasDecision: !!decision, decisionAction: decision?.action });
    return { document, run, version, decision, status };
  }).sort((a,b) => (b.run?.createdAt ?? b.version?.createdAt ?? "").localeCompare(a.run?.createdAt ?? a.version?.createdAt ?? ""));
  const attention = documents.filter(d => ["action_needed","rejected","error"].includes(d.status));
  const rows = documents.filter(d => (!query.q || (d.document.title + " " + d.document.author).toLowerCase().includes(query.q.toLowerCase())) &&
    (query.status === "attention" ? attention.includes(d) : query.status === "in_review" ? d.status === "in_review" || d.status === "running" : query.status === "approved" ? d.status === "approved" : true));
  const pages = Math.max(1, Math.ceil(rows.length/25));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(query.page)) || 1));
  const labels: Record<string,string> = { action_needed: "Revise or request a decision", rejected: "Changes requested", in_review: "Awaiting officer", approved: "Approved by officer", clear: "No issues reported", none: "Not reviewed", running: "Review in progress", error: "Resume review" };
  function href(pageNumber: number) { const params = new URLSearchParams(); if(query.q) params.set("q",query.q); if(query.status) params.set("status",query.status); params.set("page",String(pageNumber)); return "/documents?"+params; }

  return <div className="space-y-6">
    <PageHeader title={session.role === "author" ? "My documents" : "Documents"} subtitle={session.role === "author" ? "Pick up a draft, respond to feedback, or inspect a completed review." : "Every document, its current review, and the decision behind it."}
      action={canSubmit(session.role) ? <Link href="/submit" className={buttonClass("primary")}>New document +</Link> : <Link href="/audit" className={buttonClass("secondary")}>Decision history ↗</Link>} />
    <div className="grid gap-3 sm:grid-cols-3">
      <Link href="/documents?status=attention" className="rounded-xl border border-line bg-surface p-5 hover:border-accent"><p className="text-xs font-medium text-muted">Needs attention</p><p className="mt-2 text-3xl font-semibold">{attention.length}</p><p className="mt-2 text-xs text-muted">Changes requested or review interrupted →</p></Link>
      <Link href="/documents?status=in_review" className="rounded-xl border border-line bg-surface p-5 hover:border-accent"><p className="text-xs font-medium text-muted">In review</p><p className="mt-2 text-3xl font-semibold">{documents.filter(d => ["in_review","running"].includes(d.status)).length}</p><p className="mt-2 text-xs text-muted">Processing or awaiting a decision →</p></Link>
      <Link href="/documents?status=approved" className="rounded-xl border border-line bg-surface p-5 hover:border-accent"><p className="text-xs font-medium text-muted">Officer approved</p><p className="mt-2 text-3xl font-semibold">{documents.filter(d => d.status === "approved").length}</p><p className="mt-2 text-xs text-muted">Recorded human approvals →</p></Link>
    </div>
    <form role="search" className="grid items-end gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_12rem_auto_auto]">
      <label className="text-xs font-medium text-muted">Find a document<input className={`${inputClass} mt-2`} name="q" defaultValue={query.q} placeholder="Title or author…" /></label>
      <label className="text-xs font-medium text-muted">Status<select className={`${selectClass} mt-2`} name="status" defaultValue={query.status ?? ""}><option value="">All documents</option><option value="attention">Needs attention</option><option value="in_review">In review</option><option value="approved">Officer approved</option></select></label>
      <button className={buttonClass("primary")}>Apply filters</button><Link href="/documents" className={buttonClass("ghost")}>Clear</Link>
    </form>
    <p className="text-sm font-medium">{rows.length} document{rows.length === 1 ? "" : "s"}</p>
    {!rows.length ? <EmptyState title={documents.length ? "No matching documents" : "Your first review starts here"} hint={documents.length ? "Try another title or clear the filters." : "Submit a communication or inspect the synthetic sample to learn how review works."} action={<Link href={documents.length ? "/documents" : "/submit"} className={buttonClass("secondary")}>{documents.length ? "Clear filters" : "Start a review"}</Link>} /> :
    <Card className="overflow-hidden"><ul className="divide-y divide-line">{rows.slice((page-1)*25,page*25).map(({ document, run, version, decision, status }) =>
      <li key={document.id} className="grid items-center gap-4 p-5 transition-colors hover:bg-rail/40 md:grid-cols-[1fr_13rem_11rem]">
        <div className="min-w-0"><Link href={run ? runHref(document.id, run.id) : `/documents/${document.id}`} className="font-semibold text-accent-strong hover:underline">{document.title}</Link>
          <p className="mt-2 text-xs leading-5 text-muted">{document.author} · v{version?.number ?? "—"} · {(run?.jurisdictions ?? ["US"]).join(" / ")} · Updated {relativeTime(run?.createdAt ?? document.createdAt)}</p>
        </div>
        <div>{run?.result ? <VerdictBadge verdict={run.result.verdict} /> : <StatusBadge tone={status === "error" ? "fail" : "info"}>{run?.status ?? "Not reviewed"}</StatusBadge>}
          <p className="mt-2 text-xs text-muted">{labels[status]}</p></div>
        <div className="text-xs leading-5 text-muted">{decision ? <span>{decision.action === "approve" ? "Approved" : "Changes requested"} by <span className="font-semibold text-ink">{decision.officer}</span></span> :
          <Link href={run ? runHref(document.id,run.id) : `/documents/${document.id}`} className={buttonClass("secondary", "sm")}>{status === "error" ? "Recover review" : "Open workspace"} →</Link>}</div>
      </li>)}</ul></Card>}
    {pages > 1 && <nav aria-label="Document pages" className="flex items-center justify-between"><Link href={href(Math.max(1,page-1))} className={buttonClass("secondary")}>Previous</Link><span className="text-sm">Page {page} of {pages}</span><Link href={href(Math.min(pages,page+1))} className={buttonClass("secondary")}>Next</Link></nav>}
  </div>;
}
