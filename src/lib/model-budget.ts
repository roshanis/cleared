const DEFAULT_DEMO_MODEL_DAILY_CAP = 200;

export function demoModelDailyCap(): number {
  const raw = process.env.DEMO_MODEL_DAILY_CAP?.trim();
  if (!raw) return DEFAULT_DEMO_MODEL_DAILY_CAP;
  if (!/^\d+$/.test(raw)) return DEFAULT_DEMO_MODEL_DAILY_CAP;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : DEFAULT_DEMO_MODEL_DAILY_CAP;
}

export function underDailyModelCap(
  runs: { reviewer: string; createdAt: string }[],
  nowIso: string,
  cap: number,
): boolean {
  if (cap <= 0) return false;
  const today = utcDayKey(nowIso);
  if (!today) return false;

  const used = runs.filter(
    (run) => run.reviewer === "model" && utcDayKey(run.createdAt) === today,
  ).length;

  return used < cap;
}

function utcDayKey(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}
