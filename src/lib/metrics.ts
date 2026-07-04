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
