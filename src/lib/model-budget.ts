const DEFAULT_MODEL_DAILY_CAP = 200;

export function demoModelDailyCap(): number {
  return parseNonNegativeInt(
    process.env.DEMO_MODEL_DAILY_CAP,
    DEFAULT_MODEL_DAILY_CAP,
  );
}

export function dailyModelCap(
  env: Record<string, string | undefined> = process.env,
): number {
  const globalCap = parseOptionalNonNegativeInt(env.GLOBAL_MODEL_DAILY_CAP);
  if (globalCap !== null) return globalCap;

  const demoCap = parseOptionalNonNegativeInt(env.DEMO_MODEL_DAILY_CAP);
  return demoCap ?? DEFAULT_MODEL_DAILY_CAP;
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

export function modelBudgetStatus({
  runs,
  nowIso,
  cap,
}: {
  runs: { reviewer: string; createdAt: string }[];
  nowIso: string;
  cap: number;
}): {
  allowed: boolean;
  used: number;
  cap: number;
  retryAfterSeconds: number;
} {
  const today = utcDayKey(nowIso);
  if (!today || cap <= 0) {
    return { allowed: false, used: 0, cap, retryAfterSeconds: secondsUntilNextUtcDay(nowIso) };
  }

  const used = runs.filter(
    (run) => run.reviewer === "model" && utcDayKey(run.createdAt) === today,
  ).length;
  const allowed = used < cap;

  return {
    allowed,
    used,
    cap,
    retryAfterSeconds: allowed ? 0 : secondsUntilNextUtcDay(nowIso),
  };
}

function utcDayKey(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function secondsUntilNextUtcDay(iso: string): number {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 60;
  const nextUtcMidnight = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  );
  return Math.max(1, Math.ceil((nextUtcMidnight - date.getTime()) / 1000));
}

function parseNonNegativeInt(raw: string | undefined, fallback: number): number {
  return parseOptionalNonNegativeInt(raw) ?? fallback;
}

function parseOptionalNonNegativeInt(raw: string | undefined): number | null {
  const value = raw?.trim();
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
