import {
  checkFixedWindowRateLimit,
  parseSubmissionRateLimitConfig,
} from "./rate-limit";

const submissionHitsByUserId = new Map<string, string[]>();

export function checkSubmissionRateLimit(userId: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const nowIso = new Date().toISOString();
  const config = parseSubmissionRateLimitConfig();
  const currentHits = submissionHitsByUserId.get(userId) ?? [];
  const result = checkFixedWindowRateLimit({
    hits: currentHits,
    nowIso,
    limit: config.limit,
    windowMinutes: config.windowMinutes,
  });
  submissionHitsByUserId.set(userId, result.retainedHits);
  return {
    allowed: result.allowed,
    retryAfterSeconds: result.retryAfterSeconds,
  };
}

export function resetSubmissionRateLimiterForTests() {
  submissionHitsByUserId.clear();
}
