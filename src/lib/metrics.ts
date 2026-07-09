import { dailyModelCap, modelBudgetStatus } from "./model-budget";
import type { Db } from "./store";

export interface Metrics {
  totalDocuments: number;
  runs30d: number;
  passRate: number | null;
  topCriteria: { criterionId: string; count: number }[];
  medianMinutesToDecision: number | null;
  volumeByDay: { day: string; count: number }[];
}

export function computeMetrics(db: Db, now = new Date()): Metrics {
  const done = db.runs.filter((r) => r.status === "done" && r.result);
  const cutoff30 = new Date(now.getTime() - 30 * 86400e3).toISOString();
  const runs30d = done.filter((r) => r.createdAt >= cutoff30).length;

  const passRate =
    done.length > 0
      ? done.filter((r) => r.result!.verdict === "pass").length / done.length
      : null;

  const counts = new Map<string, number>();
  for (const run of done) {
    for (const finding of run.result!.findings) {
      counts.set(finding.criterionId, (counts.get(finding.criterionId) ?? 0) + 1);
    }
  }
  const topCriteria = [...counts.entries()]
    .map(([criterionId, count]) => ({ criterionId, count }))
    .sort((a, b) => b.count - a.count || a.criterionId.localeCompare(b.criterionId))
    .slice(0, 5);

  const minutes = db.decisions
    .map((decision) => {
      const run = db.runs.find((r) => r.id === decision.runId);
      if (!run) return null;
      return (
        (new Date(decision.createdAt).getTime() -
          new Date(run.createdAt).getTime()) /
        60e3
      );
    })
    .filter((m): m is number => m !== null && m >= 0)
    .sort((a, b) => a - b);
  const medianMinutesToDecision =
    minutes.length > 0 ? minutes[Math.floor(minutes.length / 2)] : null;

  const volumeByDay: Metrics["volumeByDay"] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(now.getTime() - i * 86400e3).toISOString().slice(0, 10);
    volumeByDay.push({
      day,
      count: db.runs.filter((r) => r.createdAt.slice(0, 10) === day).length,
    });
  }

  return {
    totalDocuments: db.documents.length,
    runs30d,
    passRate,
    topCriteria,
    medianMinutesToDecision,
    volumeByDay,
  };
}

// ---------------------------------------------------------------------------
// Utilization metrics (WS-5)
// ---------------------------------------------------------------------------

export interface UtilizationMetrics {
  /** Author display name → run count for the current ISO week (Mon–Sun UTC). */
  reviewsPerAuthorThisWeek: { author: string; count: number }[];
  /**
   * Elapsed minutes from run creation to run completion (done runs only).
   * Percentile convention: nearest-rank — index = Math.ceil(p * n) - 1.
   */
  timeToFirstVerdict: { p50: number | null; p95: number | null };
  /**
   * Elapsed minutes from run completion (finishedAt) to officer decision
   * (decision.createdAt) for done runs that have a decision.
   * Same nearest-rank percentile convention.
   */
  timeToOfficerDecision: { p50: number | null; p95: number | null };
  /** Fraction of done runs whose result.verdict is needs_human_review. Null when no done runs. */
  pctNeedsHumanReview: number | null;
  /** Error-status model runs / all model runs. Null when there are no model runs at all. */
  modelErrorRate: number | null;
  /** Model-reviewer runs today (UTC) and the configured global daily cap. */
  reviewsTodayVsCap: { today: number; cap: number };
}

/**
 * Nearest-rank percentile for a pre-sorted ascending array.
 * Returns null for an empty array.
 */
function nearestRank(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.max(0, Math.ceil(p * sorted.length) - 1);
  return sorted[index]!;
}

/**
 * Return the Monday 00:00:00.000 UTC of the ISO week containing `date`,
 * and the Monday 00:00:00.000 UTC of the following week.
 */
function isoWeekBoundaries(date: Date): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offsetToMonday);
  d.setUTCHours(0, 0, 0, 0);
  const start = d.toISOString();
  d.setUTCDate(d.getUTCDate() + 7);
  const end = d.toISOString();
  return { start, end };
}

export function computeUtilizationMetrics(
  db: Db,
  now = new Date(),
  env: Record<string, string | undefined> = process.env,
): UtilizationMetrics {
  // (a) Reviews per author — current ISO week ----------------------------------
  const { start: weekStart, end: weekEnd } = isoWeekBoundaries(now);
  const thisWeekRuns = db.runs.filter(
    (r) => r.createdAt >= weekStart && r.createdAt < weekEnd,
  );
  const authorCounts = new Map<string, number>();
  for (const run of thisWeekRuns) {
    const doc = db.documents.find((d) => d.id === run.documentId);
    const author = doc?.author ?? "unknown";
    authorCounts.set(author, (authorCounts.get(author) ?? 0) + 1);
  }
  const reviewsPerAuthorThisWeek = [...authorCounts.entries()]
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count || a.author.localeCompare(b.author));

  // (b) Time to first verdict (run.createdAt → run.finishedAt, done runs) ----
  const verdictMinutes = db.runs
    .filter((r) => r.status === "done" && r.finishedAt)
    .map((r) =>
      (new Date(r.finishedAt!).getTime() - new Date(r.createdAt).getTime()) /
      60e3,
    )
    .filter((m) => m >= 0)
    .sort((a, b) => a - b);
  const timeToFirstVerdict = {
    p50: nearestRank(verdictMinutes, 0.5),
    p95: nearestRank(verdictMinutes, 0.95),
  };

  // (c) Time to officer decision (run.finishedAt → decision.createdAt) -------
  const decisionMinutes = db.decisions
    .map((dec) => {
      const run = db.runs.find((r) => r.id === dec.runId);
      if (!run?.finishedAt) return null;
      const elapsed =
        (new Date(dec.createdAt).getTime() -
          new Date(run.finishedAt).getTime()) /
        60e3;
      return elapsed >= 0 ? elapsed : null;
    })
    .filter((m): m is number => m !== null)
    .sort((a, b) => a - b);
  const timeToOfficerDecision = {
    p50: nearestRank(decisionMinutes, 0.5),
    p95: nearestRank(decisionMinutes, 0.95),
  };

  // (d) % needs_human_review --------------------------------------------------
  const doneRuns = db.runs.filter((r) => r.status === "done");
  const pctNeedsHumanReview =
    doneRuns.length === 0
      ? null
      : doneRuns.filter(
          (r) => r.result?.verdict === "needs_human_review",
        ).length / doneRuns.length;

  // (e) Model error rate -------------------------------------------------------
  const modelRuns = db.runs.filter((r) => r.reviewer === "model");
  const modelErrorRate =
    modelRuns.length === 0
      ? null
      : modelRuns.filter((r) => r.status === "error").length / modelRuns.length;

  // (f) Reviews today vs cap ---------------------------------------------------
  const cap = dailyModelCap(env);
  const { used: today } = modelBudgetStatus({
    runs: db.runs,
    nowIso: now.toISOString(),
    cap,
  });
  const reviewsTodayVsCap = { today, cap };

  return {
    reviewsPerAuthorThisWeek,
    timeToFirstVerdict,
    timeToOfficerDecision,
    pctNeedsHumanReview,
    modelErrorRate,
    reviewsTodayVsCap,
  };
}
