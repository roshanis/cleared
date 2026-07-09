import { describe, expect, it } from "vitest";
import { reviewErrorMessage } from "./review-error";

describe("reviewErrorMessage", () => {
  it("sanitizes OpenAI authentication failures", () => {
    const error = new Error(
      "401 invalid_api_key: Incorrect API key provided: sk-test-secret",
    );

    expect(reviewErrorMessage(error)).toBe(
      "Model provider authentication failed. Check OPENAI_API_KEY and retry the review.",
    );
  });

  it("maps provider rate limits to a clear retry message", () => {
    const error = Object.assign(new Error("429 rate_limit_exceeded"), {
      statusCode: 429,
    });

    expect(reviewErrorMessage(error)).toBe(
      "Model provider rate limit reached. Wait a moment, then retry the review.",
    );
  });

  it("maps nested AI SDK retry rate limits to a clear retry message", () => {
    const error = Object.assign(new Error("Failed after 3 attempts"), {
      name: "AI_RetryError",
      lastError: Object.assign(new Error("rate_limit_exceeded"), {
        statusCode: 429,
      }),
    });

    expect(reviewErrorMessage(error)).toBe(
      "Model provider rate limit reached. Wait a moment, then retry the review.",
    );
  });

  it("maps timeouts to a clear retry message", () => {
    const error = Object.assign(new Error("Request timed out after 60000ms"), {
      name: "TimeoutError",
    });

    expect(reviewErrorMessage(error)).toBe(
      "Model review timed out before the provider returned a result. Retry the review.",
    );
  });

  it("maps malformed structured output to a clear message", () => {
    const error = Object.assign(new Error("No object generated: schema mismatch"), {
      name: "AI_NoObjectGeneratedError",
    });

    expect(reviewErrorMessage(error)).toBe(
      "Model provider returned malformed review output. Retry the review; if it repeats, switch to the demo reviewer.",
    );
  });

  it("maps model refusals to an honest message", () => {
    const error = new Error("The model refused to generate the requested output.");

    expect(reviewErrorMessage(error)).toBe(
      "Model provider refused to generate a review for this document. Try a narrower document or use the demo reviewer.",
    );
  });

  it("uses a generic provider failure without leaking raw payloads", () => {
    const error = new Error(
      "OpenAI 500 internal_error request failed with token sk-test-secret",
    );

    expect(reviewErrorMessage(error)).toBe(
      "Model provider failed while generating the review. Retry the review.",
    );
  });
});
