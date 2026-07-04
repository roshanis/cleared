import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DecisionPanel } from "@/components/decision-panel";
import { ResultView } from "@/components/result-view";
import {
  Card,
  PageHeader,
  SectionHeading,
  StatusBadge,
  VerdictBadge,
  buttonClass,
  relativeTime,
} from "@/components/ui";
import { requireSession } from "@/lib/session";
import { decisionForRun, getDb, latestRunForVersion } from "@/lib/store";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const db = await getDb();

  const document = db.documents.find((d) => d.id === id);
  if (!document) notFound();
  if (session.role === "author" && document.author !== session.name) {
    redirect("/documents");
  }

  const versions = db.versions
    .filter((v) => v.documentId === document.id)
    .sort((a, b) => b.number - a.number);
  const timeline = versions.map((version) => {
    const run = latestRunForVersion(db, version.id);
    const decision = run ? decisionForRun(db, run.id) : null;
    return { version, run, decision };
  });

  const latest = timeline[0];
  const previousWithResult = timeline
    .slice(1)
    .find((entry) => entry.run?.result);

  const diff =
    latest?.run?.result && previousWithResult?.run?.result
      ? computeDiff(
          previousWithResult.run.result.findings.map((f) => f.criterionId),
          latest.run.result.findings.map((f) => f.criterionId),
        )
      : null;

  const canDecide =
    session.role !== "author" &&
    latest?.run?.status === "done" &&
    latest.run.result &&
    latest.run.result.verdict !== "pass" &&
    !latest.decision;

  return (
    <div className="space-y-8">
      <PageHeader
        title={document.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>by {document.author}</span>
            <StatusBadge tone="neutral">
              v{latest?.version.number ?? 1}
            </StatusBadge>
            <StatusBadge tone="accent">
              rubric v{latest?.run?.rubricVersion ?? "—"}
            </StatusBadge>
            <StatusBadge
              tone={latest?.run?.reviewer === "model" ? "accent" : "warn"}
            >
              {latest?.run?.reviewer === "model"
                ? "model reviewers"
                : "demo reviewer"}
            </StatusBadge>
          </span>
        }
        action={
          <div className="flex flex-wrap gap-3">
            {session.role !== "officer" && (
              <Link
                href={`/submit?documentId=${document.id}`}
                className={buttonClass("primary")}
              >
                Fix &amp; resubmit
              </Link>
            )}
            {session.role !== "author" && (
              <a
                href="/api/export"
                className={buttonClass("secondary")}
              >
                Export audit CSV
              </a>
            )}
          </div>
        }
      />

      {diff && (
        <Card className="space-y-3 p-4 text-sm">
          <div className="font-semibold">
            Changes since v{previousWithResult!.version.number}
          </div>
          <div className="flex flex-wrap gap-2">
            <DiffChip label="resolved" items={diff.resolved} tone="pass" />
            <DiffChip label="new" items={diff.added} tone="fail" />
            <DiffChip label="still open" items={diff.remaining} tone="warn" />
          </div>
        </Card>
      )}

      {latest?.run?.result ? (
        <ResultView content={latest.version.content} result={latest.run.result} />
      ) : (
        <Card className="p-6 text-sm text-muted">
          {latest?.run
            ? latest.run.status === "error"
              ? `The review failed: ${latest.run.error}. Resubmit to retry.`
              : "This version's review hasn't completed — resubmit from the submit page to run it."
            : "No review has run for this document yet."}
        </Card>
      )}

      {latest?.decision && (
        <Card className="border-l-4 border-l-accent p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge
              tone={latest.decision.action === "approve" ? "pass" : "fail"}
            >
              {latest.decision.action === "approve" ? "Approved" : "Rejected"}
            </StatusBadge>
            <span className="font-medium">by {latest.decision.officer}</span>
            <span className="text-muted">
              {relativeTime(latest.decision.createdAt)}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            "{latest.decision.note}"
          </p>
        </Card>
      )}

      {canDecide && latest.run?.result && (
        <DecisionPanel
          runId={latest.run.id}
          findings={latest.run.result.findings}
        />
      )}

      <section>
        <div className="mb-3">
          <SectionHeading count={timeline.length}>History</SectionHeading>
        </div>
        <Card className="overflow-hidden">
          <div className="divide-y divide-line">
          {timeline.map(({ version, run, decision }) => (
            <div
              key={version.id}
              className="grid gap-3 px-4 py-3 text-sm sm:grid-cols-[7rem_1fr_auto]"
            >
              <div>
                <p className="font-mono text-xs font-semibold">
                  v{version.number}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {new Date(version.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {run?.result ? (
                  <VerdictBadge verdict={run.result.verdict} />
                ) : (
                  <StatusBadge tone="neutral">
                    {run?.status ?? "no review"}
                  </StatusBadge>
                )}
                <span className="font-mono text-xs text-muted">
                  {run?.result?.findings
                    .map((finding) => finding.criterionId)
                    .join(" · ") || "no findings"}
                </span>
                <span className="text-xs text-muted">
                  rubric v{run?.rubricVersion ?? "—"}
                </span>
              </div>
              {decision && (
                <div className="max-w-sm text-xs sm:text-right">
                  <span
                    className={
                      decision.action === "approve"
                        ? "font-semibold text-pass"
                        : "font-semibold text-fail"
                    }
                  >
                    {decision.action === "approve" ? "Approved" : "Rejected"}
                  </span>
                  <span className="text-muted">
                    {" "}
                    by {decision.officer}: "{decision.note}"
                  </span>
                </div>
              )}
            </div>
          ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function computeDiff(previous: string[], current: string[]) {
  const prev = new Set(previous);
  const curr = new Set(current);
  return {
    resolved: [...prev].filter((id) => !curr.has(id)),
    added: [...curr].filter((id) => !prev.has(id)),
    remaining: [...curr].filter((id) => prev.has(id)),
  };
}

function DiffChip({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "pass" | "warn" | "fail";
}) {
  return (
    <StatusBadge tone={tone}>
      {items.length} {label}
      {items.length > 0 && (
        <span className="font-mono"> · {items.join(", ")}</span>
      )}
    </StatusBadge>
  );
}
