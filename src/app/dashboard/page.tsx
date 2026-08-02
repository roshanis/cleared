import Link from "next/link";
import {
  Card,
  CriterionChip,
  PageHeader,
  SectionHeading,
  StatusBadge,
  buttonClass,
  TimeAgo,
} from "@/components/ui";
import { OutcomesBar, VolumeChart } from "@/components/dashboard-charts";
import { ResetDemoDataButton } from "@/components/reset-demo-data-button";
import { computeMetrics, computeUtilizationMetrics } from "@/lib/metrics";
import { demoAuthEnabled, requireRole } from "@/lib/session";
import { getDb, publishedRubric, storageKind } from "@/lib/store";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireRole("officer", "admin", "auditor");
  const db = await getDb();
  const metrics = computeMetrics(db);
  const utilization = computeUtilizationMetrics(db);
  const maxCriteria = Math.max(1, ...metrics.topCriteria.map((c) => c.count));
  const outcomes = metrics.verdictCounts;
  const outcomesTotal =
    outcomes.pass + outcomes.needsHumanReview + outcomes.fail;

  // Cumulative pass rate across the 14-day window, for the stat-tile trend.
  const passRateSpark: (number | null)[] = [];
  let sparkDone = 0;
  let sparkPassed = 0;
  for (const day of metrics.volumeByDay) {
    sparkDone += day.pass + day.needsHumanReview + day.fail;
    sparkPassed += day.pass;
    passRateSpark.push(sparkDone > 0 ? sparkPassed / sparkDone : null);
  }

  // Rubric health — only computed for admin, but data loaded regardless to avoid
  // branching the getDb() call. Render the card only for admins.
  const isAdmin = session.role === "admin";
  const canResetDemoData = isAdmin && demoAuthEnabled();
  const liveRubric = (() => {
    try {
      return publishedRubric(db);
    } catch {
      return null;
    }
  })();
  const newerDraft = liveRubric
    ? db.rubrics.find(
        (r) => r.publishedAt === null && r.version > liveRubric.version,
      ) ?? null
    : null;
  const goldenGate = liveRubric?.goldenGate ?? null;
  const goldenPassCount = goldenGate
    ? goldenGate.cases.filter((c) => c.pass).length
    : 0;
  const goldenTotalCount = goldenGate ? goldenGate.cases.length : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle="Review volume, outcomes, and where documents keep going wrong."
        action={
          <a href="/api/export" className={buttonClass("secondary")}>
            Export audit CSV
          </a>
        }
      />

      <Card className="overflow-hidden">
        <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <MetricCell label="Documents" value={String(metrics.totalDocuments)} />
          <MetricCell label="Reviews, last 30 days" value={String(metrics.runs30d)} />
          <MetricCell
            label="Pass rate"
            value={
              metrics.passRate === null
                ? "—"
                : `${Math.round(metrics.passRate * 100)}%`
            }
            spark={passRateSpark}
            sparkLabel="Cumulative pass rate over the last 14 days"
          />
          <MetricCell
            label="Median time to decision"
            value={
              metrics.medianMinutesToDecision === null
                ? "—"
                : `${Math.round(metrics.medianMinutesToDecision)}m`
            }
          />
        </div>
      </Card>

      {outcomesTotal > 0 && (
        <Card className="p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <SectionHeading>Review outcomes</SectionHeading>
            <span className="text-xs tabular-nums text-muted">
              {outcomesTotal} completed review{outcomesTotal === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-4">
            <OutcomesBar
              pass={outcomes.pass}
              needsHumanReview={outcomes.needsHumanReview}
              fail={outcomes.fail}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <LegendItem color="var(--color-pass)" label="Passed" count={outcomes.pass} />
            <LegendItem
              color="var(--color-chart-warn)"
              label="Needs human review"
              count={outcomes.needsHumanReview}
            />
            <LegendItem color="var(--color-fail)" label="Failed" count={outcomes.fail} />
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeading>Reviews per day, last 14 days</SectionHeading>
          <div className="mt-4">
            <VolumeChart days={metrics.volumeByDay} />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
            <LegendItem color="var(--color-pass)" label="Passed" small />
            <LegendItem color="var(--color-chart-warn)" label="Needs review" small />
            <LegendItem color="var(--color-fail)" label="Failed" small />
            <LegendItem
              color="var(--color-line-strong)"
              label="In progress / errored"
              small
            />
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeading>Most-violated criteria</SectionHeading>
          {metrics.topCriteria.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No findings yet — violations will rank here as reviews run.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {metrics.topCriteria.map((criterion) => (
                <li key={criterion.criterionId} className="text-sm">
                  <div className="mb-1 flex justify-between">
                    <CriterionChip id={criterion.criterionId} />
                    <span className="tabular-nums text-muted">
                      {criterion.count} finding{criterion.count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-well">
                    <div
                      className="h-2 rounded-full bg-accent"
                      style={{
                        width: `${(criterion.count / maxCriteria) * 100}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* WS-5: Utilization metrics */}
      <Card className="overflow-hidden">
        <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
          <MetricCell
            label="Verdict p50 / p95 (min)"
            value={
              utilization.timeToFirstVerdict.p50 === null
                ? "—"
                : `${Math.round(utilization.timeToFirstVerdict.p50)}m / ${Math.round(utilization.timeToFirstVerdict.p95 ?? 0)}m`
            }
          />
          <MetricCell
            label="Decision p50 / p95 (min)"
            value={
              utilization.timeToOfficerDecision.p50 === null
                ? "—"
                : `${Math.round(utilization.timeToOfficerDecision.p50)}m / ${Math.round(utilization.timeToOfficerDecision.p95 ?? 0)}m`
            }
          />
          <MetricCell
            label="Needs human review"
            value={
              utilization.pctNeedsHumanReview === null
                ? "—"
                : `${Math.round(utilization.pctNeedsHumanReview * 100)}%`
            }
          />
          <MetricCell
            label="Model error rate"
            value={
              utilization.modelErrorRate === null
                ? "—"
                : `${Math.round(utilization.modelErrorRate * 100)}%`
            }
          />
          <MetricCell
            label="Model reviews today / cap"
            value={`${utilization.reviewsTodayVsCap.today} / ${utilization.reviewsTodayVsCap.cap}`}
          />
        </div>
      </Card>

      {utilization.reviewsPerAuthorThisWeek.length > 0 && (
        <Card className="p-5">
          <SectionHeading>Reviews this week, by author</SectionHeading>
          <ul className="mt-4 space-y-2">
            {utilization.reviewsPerAuthorThisWeek.map(({ author, count }) => (
              <li key={author} className="flex justify-between text-sm">
                <span>{author}</span>
                <span className="tabular-nums text-muted">
                  {count} review{count === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isAdmin && liveRubric && (
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <Link
              href="/rubric"
              className="text-sm font-semibold tracking-tight text-accent-strong hover:underline"
            >
              Rubric health
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              {newerDraft && (
                <StatusBadge tone="warn">
                  Draft v{newerDraft.version} pending
                </StatusBadge>
              )}
              {goldenGate && (
                <StatusBadge tone={goldenGate.pass ? "pass" : "fail"}>
                  Golden gate: {goldenPassCount}/{goldenTotalCount} pass
                </StatusBadge>
              )}
            </div>
          </div>
          <div className="mt-3 grid gap-1 text-sm text-muted sm:grid-cols-2">
            <span>
              Live rubric:{" "}
              <span className="font-medium text-ink">v{liveRubric.version}</span>
            </span>
            <span>
              Published{" "}
              <span className="font-medium text-ink">
                {liveRubric.publishedAt ? (
                  <TimeAgo iso={liveRubric.publishedAt} />
                ) : (
                  "—"
                )}
              </span>
            </span>
          </div>
        </Card>
      )}

      {canResetDemoData && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-rail px-4 py-3">
          <p className="text-xs leading-5 text-muted">
            Restore the shared demo workspace to its seeded documents, decisions,
            and rubric.
          </p>
          <ResetDemoDataButton />
        </div>
      )}

      {storageKind() === "memory" && (
        <div className="flex items-start gap-3 rounded-lg border border-warn/25 bg-warn-soft px-4 py-3 text-xs leading-5 text-muted">
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 5v3.5M8 11h.01" />
          </svg>
          <div className="space-y-1">
            <StatusBadge tone="warn">Demo storage</StatusBadge>
            <p>
              Running on ephemeral demo storage — data resets between serverless
              instances. Set DATABASE_URL to a Postgres connection string (see
              README) for durability.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendItem({
  color,
  label,
  count,
  small = false,
}: {
  color: string;
  label: string;
  count?: number;
  small?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${small ? "text-xs" : "text-sm"} text-muted`}
    >
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
        style={{ background: color }}
      />
      <span>{label}</span>
      {count !== undefined && (
        <span className="font-semibold tabular-nums text-ink">{count}</span>
      )}
    </span>
  );
}

function MetricCell({
  label,
  value,
  spark,
  sparkLabel,
}: {
  label: string;
  value: string;
  /** Optional 0..1 series rendered as a small trend line under the value. */
  spark?: (number | null)[];
  sparkLabel?: string;
}) {
  const points = spark
    ?.map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v !== null);
  const showSpark = points !== undefined && points.length >= 2;
  return (
    <div className="px-5 py-4 lg:py-5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-3">
        <p className="text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        {showSpark && (
          <svg
            viewBox={`0 0 ${(spark!.length - 1) * 6} 28`}
            className="mb-1 h-7 w-20 shrink-0"
            role="img"
            aria-label={sparkLabel ?? `${label} trend`}
            preserveAspectRatio="none"
          >
            <polyline
              points={points!
                .map((p) => `${p.i * 6},${25 - p.v * 22}`)
                .join(" ")}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={points![points!.length - 1].i * 6}
              cy={25 - points![points!.length - 1].v * 22}
              r="2.5"
              fill="var(--color-accent)"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
