const DEFAULT_SUBMISSION_LIMIT = 10;
const DEFAULT_WINDOW_MINUTES = 10;

export interface SubmissionRateLimitConfig {
  limit: number;
  windowMinutes: number;
}

export interface FixedWindowRateLimitInput {
  hits: string[];
  nowIso: string;
  limit: number;
  windowMinutes: number;
}

export interface FixedWindowRateLimitResult {
  allowed: boolean;
  retainedHits: string[];
  retryAfterSeconds: number;
}

export function parseSubmissionRateLimitConfig(
  env: Record<string, string | undefined> = process.env,
): SubmissionRateLimitConfig {
  return {
    limit: parsePositiveInt(env.RATE_LIMIT_SUBMISSIONS, DEFAULT_SUBMISSION_LIMIT),
    windowMinutes: parsePositiveInt(
      env.RATE_LIMIT_WINDOW_MINUTES,
      DEFAULT_WINDOW_MINUTES,
    ),
  };
}

export function checkFixedWindowRateLimit({
  hits,
  nowIso,
  limit,
  windowMinutes,
}: FixedWindowRateLimitInput): FixedWindowRateLimitResult {
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(nowMs) || limit <= 0 || windowMinutes <= 0) {
    return { allowed: false, retainedHits: hits, retryAfterSeconds: 60 };
  }

  const windowMs = windowMinutes * 60 * 1000;
  const leftEdge = nowMs - windowMs;
  const retainedHits = hits.filter((hit) => {
    const hitMs = Date.parse(hit);
    return Number.isFinite(hitMs) && hitMs >= leftEdge;
  });

  if (retainedHits.length >= limit) {
    const oldestMs = Date.parse(retainedHits[0] ?? nowIso);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldestMs + windowMs - nowMs) / 1000),
    );
    return { allowed: false, retainedHits, retryAfterSeconds };
  }

  return {
    allowed: true,
    retainedHits: [...retainedHits, new Date(nowMs).toISOString()],
    retryAfterSeconds: 0,
  };
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = raw?.trim();
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
