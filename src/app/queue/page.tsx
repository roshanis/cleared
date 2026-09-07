import Link from "next/link";
import { Card, EmptyState, PageHeader, StatusBadge, VerdictBadge, buttonClass, inputClass, selectClass, TimeAgo } from "@/components/ui";
import { requireRole } from "@/lib/session";
import { getDb } from "@/lib/store";
import { currentQueue, currentRun, undecidedHistory, runHref } from "@/lib/review-workspace";

const OVERDUE_MS = 48 * 3600 * 1000;

const severityDot: Record<string, string> = {
  critical: "bg-fail",
  major: "bg-warn",
  minor: "bg-muted",
};

function severityCounts(findings: { severity: string }[]) {
  const order = ["critical", "major", "minor"] as const;
  return order
    .map((severity) => ({
      severity,
      count: findings.filter((f) => f.severity === severity).length,
    }))
    .filter(({ count }) => count > 0);
}

function SeveritySummary({
  findings,
}: {
  findings: { severity: string }[];
}) {
  const counts = severityCounts(findings);
  if (counts.length === 0) return <span className="text-muted">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 whitespace-nowrap text-xs text-muted">
      {counts.map(({ severity, count }) => (
        <span key={severity} className="inline-flex items-center gap-1.5 font-medium">
          <span
            aria-hidden
            className={`h-2 w-2 rounded-full ${severityDot[severity]}`}
          />
          {count} {severity}
        </span>
      ))}
    </span>
  );
}

export const metadata = { title: "Review queue" };

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ q?: string; priority?: string; sort?: string; scope?: string; page?: string }> }) {
  await requireRole("officer", "admin");
  const db = await getDb();
  const query = await searchParams;
  const current = currentQueue(db);
  const overdueCount = current.filter(({run}) => Date.now() - new Date(run.createdAt).getTime() > OVERDUE_MS).length;
  const base = query.scope === "all" ? undecidedHistory(db) : current;
  const hasGap = (run: typeof db.runs[number]) => run.result?.coverage?.some(c => ["uncertain", "omitted", "unsupported"].includes(c.status));
  const isCritical = (run: typeof db.runs[number]) => run.result?.findings.some(f => f.severity === "critical");
  const rank = (run: typeof db.runs[number]) => isCritical(run) ? 0 : hasGap(run) ? 1 : 2;
  const rows = base.filter(({ document, run }) => (!query.q || (document.title + " " + document.author).toLowerCase().includes(query.q.toLowerCase())) &&
    (query.priority === "critical" ? isCritical(run) : query.priority === "coverage" ? hasGap(run) : true))
    .sort((a,b) => query.sort === "oldest" ? a.run.createdAt.localeCompare(b.run.createdAt) : rank(a.run) - rank(b.run) || a.run.createdAt.localeCompare(b.run.createdAt));
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(query.page) || 1)));
  function pageHref(value: number) { const params = new URLSearchParams(); for (const key of ["q", "priority", "sort", "scope"] as const) if (query[key]) params.set(key, query[key]!); params.set("page", String(value)); return "/queue?" + params; }

  return <div className="space-y-6">
    <PageHeader title="Review queue" subtitle="Your next decisions, with the evidence to make them." action={<Link href="/documents" className={buttonClass("secondary")}>All documents ↗</Link>} />
    {overdueCount > 0 && <StatusBadge tone="fail">{overdueCount} waiting 2+ days</StatusBadge>}
    <div className="grid gap-3 sm:grid-cols-3">
      {[["Awaiting a decision", current.length, "Current document reviews"], ["Critical findings", current.filter(i => isCritical(i.run)).length, "Inspect these first"], ["Coverage gaps", current.filter(i => hasGap(i.run)).length, "Checks needing human attention"]].map(([label,value,detail]) =>
        <Card key={label} className="p-5"><p className="text-xs font-medium text-muted">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p><p className="mt-2 text-xs text-muted">{detail}</p></Card>)}
    </div>
    <form className="grid items-end gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1fr_11rem_10rem_auto_auto]" role="search">
      <label className="text-xs font-medium text-muted">Find a document or author<input name="q" defaultValue={query.q} className={`${inputClass} mt-2`} placeholder="Search the queue…" /></label>
      <label className="text-xs font-medium text-muted">Priority<select name="priority" defaultValue={query.priority ?? ""} className={`${selectClass} mt-2`}><option value="">All priorities</option><option value="critical">Critical findings</option><option value="coverage">Coverage gaps</option></select></label>
      <label className="text-xs font-medium text-muted">Sort by<select name="sort" defaultValue={query.sort ?? "priority"} className={`${selectClass} mt-2`}><option value="priority">Priority first</option><option value="oldest">Oldest first</option></select></label>
      <button className={buttonClass("primary")}>Apply filters</button>
      <Link href="/queue" className={buttonClass("ghost")}>Clear</Link>
      <label className="flex items-center gap-2 text-xs text-muted sm:col-span-2 lg:col-span-5"><input type="checkbox" name="scope" value="all" defaultChecked={query.scope === "all"} />Include undecided earlier reviews (superseded by newer work)</label>
    </form>
    <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">{rows.length} review{rows.length === 1 ? "" : "s"}</h2><p className="text-xs text-muted">Every row opens its exact review run.</p></div>
    {rows.length === 0 ? <EmptyState title={base.length ? "No reviews match these filters" : "You’re up to date"} hint={base.length ? "Clear the filters to return to your queue." : "Current reviews needing a decision will appear here. Previous reviews remain in document history."} action={<Link href={base.length ? "/queue" : "/documents"} className={buttonClass("secondary")}>{base.length ? "Clear filters" : "Browse documents"}</Link>} /> :
    <Card className="overflow-hidden">
      <div className="hidden grid-cols-[1fr_12rem_10rem] gap-4 border-b border-line bg-rail px-5 py-3 text-xs font-medium text-muted lg:grid"><span>Document / scope</span><span>Automated review</span><span>Waiting</span></div>
      <ul className="divide-y divide-line">{rows.slice((page-1)*25, page*25).map(({ document, run, version }) => <li key={run.id} className="grid items-center gap-4 p-5 transition-colors hover:bg-rail/40 lg:grid-cols-[1fr_12rem_10rem]">
        <div className="min-w-0"><Link href={runHref(document.id,run.id)} className="font-semibold text-accent-strong underline-offset-4 hover:underline">{document.title}</Link><p className="mt-2 text-xs text-muted">{document.author} · v{version.number} · {(run.jurisdictions ?? ["US"]).join(" / ")} · {run.result?.findings.length ?? 0} findings</p>
          <div className="mt-2 flex flex-wrap gap-2">{isCritical(run) && <StatusBadge tone="fail">Critical</StatusBadge>}{hasGap(run) && <StatusBadge tone="warn">Coverage gap</StatusBadge>}{currentRun(db, document.id)?.id !== run.id && <StatusBadge>Earlier review</StatusBadge>}</div>
        </div>
        <div className="space-y-2">{run.result && <VerdictBadge verdict={run.result.verdict} />}<SeveritySummary findings={run.result?.findings ?? []} /></div>
        <div className="flex items-center justify-between gap-3 lg:block"><p className="text-xs text-muted">Submitted <TimeAgo iso={run.createdAt} /></p><Link href={runHref(document.id,run.id)} className={`${buttonClass("secondary", "sm")} lg:mt-2`}>{currentRun(db, document.id)?.id === run.id ? "Review" : "Inspect history"} →</Link></div>
      </li>)}</ul>
    </Card>}
    {pages > 1 && <nav aria-label="Queue pages" className="flex items-center justify-between"><Link href={pageHref(Math.max(1,page-1))} className={buttonClass("secondary")}>Previous</Link><span className="text-sm">Page {page} of {pages}</span><Link href={pageHref(Math.min(pages,page+1))} className={buttonClass("secondary")}>Next</Link></nav>}
  </div>;
}
