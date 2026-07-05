import Link from "next/link";
import {
  Card,
  CriterionChip,
  PageHeader,
  SectionHeading,
  StatusBadge,
  buttonClass,
  relativeTime,
} from "@/components/ui";
import { computeMetrics } from "@/lib/metrics";
import { requireRole } from "@/lib/session";
import { getDb, publishedRubric, storageKind } from "@/lib/store";

export default async function DashboardPage() {
  const session = await requireRole("officer", "admin", "auditor");
  const db = await getDb();
  const metrics = computeMetrics(db);
  const maxVolume = Math.max(1, ...metrics.volumeByDay.map((d) => d.count));
  const maxCriteria = Math.max(1, ...metrics.topCriteria.map((c) => c.count));

  // Rubric health — only computed for admin, but data loaded regardless to avoid
  // branching the getDb() call. Render the card only for admins.
  const isAdmin = session.role === "admin";
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeading>Reviews per day, last 14 days</SectionHeading>
          <svg
            viewBox={`0 0 ${metrics.volumeByDay.length * 24} 84`}
            className="mt-4 h-28 w-full"
            role="img"
            aria-label="Bar chart of review volume per day for the last 14 days"
          >
            {metrics.volumeByDay.map((day, i) => {
              const height = (day.count / maxVolume) * 64;
              return (
                <g key={day.day}>
                  <title>{`${day.day}: ${day.count} review${day.count === 1 ? "" : "s"}`}</title>
                  <rect
                    x={i * 24 + 4}
                    y={68 - height}
                    width={16}
                    height={Math.max(height, day.count > 0 ? 3 : 1)}
                    rx={2}
                    fill={
                      day.count > 0 ? "var(--color-accent)" : "var(--color-line)"
                    }
                  />
                  <text
                    x={i * 24 + 12}
                    y={80}
                    textAnchor="middle"
                    fontSize="7"
                    fill="var(--color-muted)"
                  >
                    {day.day.slice(8)}
                  </text>
                </g>
              );
            })}
          </svg>
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
                {liveRubric.publishedAt
                  ? relativeTime(liveRubric.publishedAt)
                  : "—"}
              </span>
            </span>
          </div>
        </Card>
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
              instances. Connect Upstash Redis (see README) for durability.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4 lg:py-5">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1.5 text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  );
}
