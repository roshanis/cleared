import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DecisionPanel } from "@/components/decision-panel";
import { FixDraftPanel } from "@/components/fix-draft-panel";
import { ResultView } from "@/components/result-view";
import {
  Card,
  PageHeader,
  SectionHeading,
  StatusBadge,
  VerdictBadge,
  buttonClass,
  TimeAgo,
  relativeTime,
} from "@/components/ui";
import { canAccessDocument } from "@/lib/access";
import { canDecide as roleCanDecide, canSubmit } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import { decisionForRun, getDb, latestRunForVersion } from "@/lib/store";

/** Name the tab after the document — reviewers keep several open at once. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getDb();
  const document = db.documents.find((d) => d.id === id);
  return { title: document?.title ?? "Document" };
}

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
  if (!canAccessDocument(session, document)) {
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
    roleCanDecide(session.role) &&
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
            {canSubmit(session.role) && (
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

      <ReviewPipeline
        version={latest?.version ?? null}
        run={latest?.run ?? null}
        decision={latest?.decision ?? null}
      />

      {diff && (
        <Card className="space-y-3 border-accent/20 bg-rail p-4 text-sm">
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
        <ResultView
          content={latest.version.content}
          result={latest.run.result}
          criteria={
            db.rubrics.find((r) => r.version === latest.run?.rubricVersion)
              ?.criteria
          }
        />
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
        <Card className="border-accent/20 bg-rail p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge
              tone={latest.decision.action === "approve" ? "pass" : "fail"}
            >
              {latest.decision.action === "approve" ? "Approved" : "Rejected"}
            </StatusBadge>
            <span className="font-medium">by {latest.decision.officer}</span>
            <span className="text-muted">
              <TimeAgo iso={latest.decision.createdAt} />
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            "{latest.decision.note}"
          </p>
        </Card>
      )}

      {session.role !== "officer" &&
        session.role !== "auditor" &&
        latest?.run?.status === "done" &&
        latest.run.result &&
        latest.run.result.verdict !== "pass" && (
          <FixDraftPanel runId={latest.run.id} />
        )}

      {canDecide && latest.run?.result && (
        <DecisionPanel
          runId={latest.run.id}
          findings={latest.run.result.findings}
          judge={latest.run.result.judge}
        />
      )}

      <section>
        <div className="mb-3">
          <SectionHeading count={timeline.length}>History</SectionHeading>
        </div>
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[7rem_1fr_auto] gap-3 border-b border-line bg-rail px-4 py-2 text-xs font-semibold text-muted sm:grid">
            <span>Version</span>
            <span>Review outcome</span>
            <span>Decision</span>
          </div>
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
                <p className="mt-1 text-xs text-muted">
                  by {version.author}
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

type StepState = "complete" | "active" | "failed" | "upcoming";

/**
 * Where this version sits in the review pipeline — submitted, AI review,
 * human decision — so anyone landing on the page reads the state at a glance.
 */
function ReviewPipeline({
  version,
  run,
  decision,
}: {
  version: { number: number; createdAt: string } | null;
  run: {
    status: string;
    result: { verdict: string } | null;
    error: string | null;
  } | null;
  decision: { action: "approve" | "reject"; officer: string } | null;
}) {
  if (!version) return null;

  const verdict = run?.status === "done" ? run.result?.verdict ?? null : null;

  const reviewStep: {
    state: StepState;
    detail: string;
    detailClass?: string;
  } = !run
    ? { state: "upcoming", detail: "Not started" }
    : run.status === "error"
      ? { state: "failed", detail: "Failed — resubmit to retry" }
      : run.status === "done"
        ? verdict === "pass"
          ? { state: "complete", detail: "Passed" }
          : verdict === "fail"
            ? {
                state: "complete",
                detail: "Failed the rubric",
                detailClass: "font-medium text-fail",
              }
            : {
                state: "complete",
                detail: "Flagged for human review",
                detailClass: "font-medium text-warn",
              }
        : { state: "active", detail: "In progress" };

  const decisionStep: { state: StepState; detail: string } = decision
    ? {
        state: "complete",
        detail: `${decision.action === "approve" ? "Approved" : "Rejected"} by ${decision.officer}`,
      }
    : verdict === "pass"
      ? { state: "complete", detail: "Cleared — no decision needed" }
      : verdict
        ? { state: "active", detail: "Waiting on an officer" }
        : { state: "upcoming", detail: "After the review" };

  const steps: {
    title: string;
    detail: string;
    state: StepState;
    detailClass?: string;
  }[] = [
    {
      title: "Submitted",
      detail: `v${version.number} · ${relativeTime(version.createdAt)}`,
      state: "complete",
    },
    { title: "AI review", ...reviewStep },
    { title: "Decision", ...decisionStep },
  ];

  return (
    <ol className="grid gap-3 sm:grid-cols-3" aria-label="Review progress">
      {steps.map((step, i) => (
        <li
          key={step.title}
          aria-current={step.state === "active" ? "step" : undefined}
          className={`relative flex items-start gap-3 rounded-lg border p-3.5 ${
            step.state === "active"
              ? "border-accent/40 bg-accent-soft/40"
              : step.state === "failed"
                ? "border-fail/30 bg-fail-soft/50"
                : "border-line bg-surface"
          }`}
        >
          <PipelineMarker state={step.state} index={i + 1} />
          <div className="min-w-0">
            <p
              className={`text-sm font-semibold ${
                step.state === "upcoming" ? "text-muted" : "text-ink"
              }`}
            >
              {step.title}
            </p>
            <p
              className={`mt-0.5 text-xs leading-5 ${
                step.state === "failed"
                  ? "font-medium text-fail"
                  : step.detailClass ?? "text-muted"
              }`}
            >
              {step.detail}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function PipelineMarker({ state, index }: { state: StepState; index: number }) {
  if (state === "complete") {
    return (
      <span
        aria-hidden
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pass-soft text-pass"
      >
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span
        aria-hidden
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fail text-white"
      >
        <svg
          viewBox="0 0 16 16"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
        </svg>
      </span>
    );
  }
  if (state === "active") {
    return (
      <span
        aria-hidden
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft"
      >
        <span className="h-2 w-2 animate-pulse-soft rounded-full bg-accent" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-xs font-semibold text-muted"
    >
      {index}
    </span>
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
