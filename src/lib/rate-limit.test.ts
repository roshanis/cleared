import { describe, expect, it } from "vitest";
import {
  checkFixedWindowRateLimit,
  parseSubmissionRateLimitConfig,
} from "./rate-limit";

describe("fixed-window submission rate limit", () => {
  it("allows up to the limit inside the same window and blocks the next hit", () => {
    const hits = [
      "2026-07-08T10:00:00.000Z",
      "2026-07-08T10:01:00.000Z",
    ];

    expect(
      checkFixedWindowRateLimit({
        hits,
        nowIso: "2026-07-08T10:09:59.000Z",
        limit: 3,
        windowMinutes: 10,
      }),
    ).toMatchObject({
      allowed: true,
      retainedHits: [...hits, "2026-07-08T10:09:59.000Z"],
      retryAfterSeconds: 0,
    });

    expect(
      checkFixedWindowRateLimit({
        hits: [...hits, "2026-07-08T10:09:00.000Z"],
        nowIso: "2026-07-08T10:09:59.000Z",
        limit: 3,
        windowMinutes: 10,
      }),
    ).toMatchObject({
      allowed: false,
      retainedHits: [...hits, "2026-07-08T10:09:00.000Z"],
      retryAfterSeconds: 1,
    });
  });

  it("expires hits exactly at the left edge of the window", () => {
    expect(
      checkFixedWindowRateLimit({
        hits: [
          "2026-07-08T09:59:59.999Z",
          "2026-07-08T10:00:00.000Z",
        ],
        nowIso: "2026-07-08T10:10:00.000Z",
        limit: 2,
        windowMinutes: 10,
      }),
    ).toMatchObject({
      allowed: true,
      retainedHits: [
        "2026-07-08T10:00:00.000Z",
        "2026-07-08T10:10:00.000Z",
      ],
      retryAfterSeconds: 0,
    });
  });

  it("parses submission rate-limit env defensively", () => {
    expect(parseSubmissionRateLimitConfig({})).toEqual({
      limit: 10,
      windowMinutes: 10,
    });

    expect(
      parseSubmissionRateLimitConfig({
        RATE_LIMIT_SUBMISSIONS: "4",
        RATE_LIMIT_WINDOW_MINUTES: "15",
      }),
    ).toEqual({ limit: 4, windowMinutes: 15 });

    expect(
      parseSubmissionRateLimitConfig({
        RATE_LIMIT_SUBMISSIONS: "0",
        RATE_LIMIT_WINDOW_MINUTES: "garbage",
      }),
    ).toEqual({ limit: 10, windowMinutes: 10 });
  });
});
