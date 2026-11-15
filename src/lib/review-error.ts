type ErrorLike = {
  name?: unknown;
  message?: unknown;
  status?: unknown;
  statusCode?: unknown;
  code?: unknown;
  cause?: unknown;
  errors?: unknown;
  lastError?: unknown;
};

const authMessage = (credentialEnvName: string) =>
  `Model provider authentication failed. Check ${credentialEnvName} and retry the review.`;
const RATE_LIMIT_MESSAGE =
  "Model provider rate limit reached. Wait a moment, then retry the review.";
const TIMEOUT_MESSAGE =
  "Model review timed out before the provider returned a result. Retry the review.";
const MALFORMED_MESSAGE =
  "Model provider returned malformed review output. Retry the review; if it repeats, switch to the demo reviewer.";
const REFUSAL_MESSAGE =
  "Model provider refused to generate a review for this document. Try a narrower document or use the demo reviewer.";
const GENERIC_MESSAGE =
  "Model provider failed while generating the review. Retry the review.";

function errorLike(error: unknown): ErrorLike {
  return error && typeof error === "object" ? (error as ErrorLike) : {};
}

function lower(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function status(error: ErrorLike): number | null {
  for (const value of [error.status, error.statusCode]) {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function collect(error: unknown, seen = new Set<unknown>()): ErrorLike[] {
  if (!error || seen.has(error)) return [];
  seen.add(error);
  const like = errorLike(error);
  const nested = [like.cause, like.lastError];
  if (Array.isArray(like.errors)) nested.push(...like.errors);
  return [like, ...nested.flatMap((value) => collect(value, seen))];
}

/**
 * `credentialEnvName` names the backend actually in use — the reviewers can
 * run on OpenAI, the Hugging Face router, or a self-hosted endpoint, so
 * "check OPENAI_API_KEY" is wrong advice for two of the three.
 */
export function reviewErrorMessage(
  error: unknown,
  credentialEnvName = "OPENAI_API_KEY",
): string {
  const chain = collect(error);
  const fields = chain.map((like) => ({
    name: lower(like.name),
    message: lower(like.message ?? String(error)),
    code: lower(like.code),
    status: status(like),
  }));
  const text = fields
    .map(({ name, code, message }) => `${name} ${code} ${message}`)
    .join(" ");

  if (
    fields.some(({ status }) => status === 401 || status === 403) ||
    text.includes("invalid_api_key") ||
    text.includes("incorrect api key") ||
    text.includes("authentication")
  ) {
    return authMessage(credentialEnvName);
  }

  if (
    fields.some(({ status }) => status === 429) ||
    text.includes("rate_limit") ||
    text.includes("rate limit") ||
    text.includes("too many requests")
  ) {
    return RATE_LIMIT_MESSAGE;
  }

  if (
    fields.some(
      ({ name, code }) =>
        name.includes("timeout") || code === "etimedout" || code === "timeout",
    ) ||
    text.includes("timed out") ||
    text.includes("timeout")
  ) {
    return TIMEOUT_MESSAGE;
  }

  if (
    fields.some(
      ({ name }) =>
        name.includes("noobjectgenerated") ||
        name.includes("no_object_generated"),
    ) ||
    text.includes("no object generated") ||
    text.includes("schema") ||
    text.includes("malformed") ||
    text.includes("invalid json") ||
    text.includes("zoderror")
  ) {
    return MALFORMED_MESSAGE;
  }

  if (text.includes("refusal") || text.includes("refused")) {
    return REFUSAL_MESSAGE;
  }

  return GENERIC_MESSAGE;
}
