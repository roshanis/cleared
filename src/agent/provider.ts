import { createOpenAI, openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Which model backend the reviewers, judge and fixer run on.
 *
 * The pipeline only ever needs `generateObject` against a chat model, so any
 * OpenAI-compatible endpoint works — Hugging Face's inference router, a
 * self-hosted vLLM or TGI server, Ollama, or a gateway. That is why there is
 * no second SDK dependency here: one provider factory, three base URLs.
 */
export type ProviderKind = "openai" | "huggingface" | "compatible";

export interface ProviderChoice {
  kind: ProviderKind;
  modelId: string;
}

export const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";

/** Hugging Face Inference Providers speak OpenAI Chat Completions here. */
export const HUGGINGFACE_BASE_URL = "https://router.huggingface.co/v1";

type Env = Record<string, string | undefined>;

const clean = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * Resolve the backend from the environment.
 *
 * A provider counts as configured only when it has everything it needs to
 * make a call, so `activeReviewer()` can never report "model" and then fail:
 * Hugging Face and a compatible endpoint both need a model id, because there
 * is no sane default for "whichever open model you happened to mean".
 *
 * With no MODEL_PROVIDER set, OpenAI wins when its key is present. That keeps
 * an existing deployment on the backend it already had — adding HF_TOKEN
 * should not silently re-point production at a different model. Set
 * MODEL_PROVIDER to choose deliberately.
 */
export function resolveProvider(env: Env = process.env): ProviderChoice | null {
  const openaiChoice: ProviderChoice | null = clean(env.OPENAI_API_KEY)
    ? {
        kind: "openai",
        modelId: clean(env.OPENAI_MODEL) ?? DEFAULT_OPENAI_MODEL,
      }
    : null;

  const hfModel = clean(env.HF_MODEL);
  const huggingfaceChoice: ProviderChoice | null =
    clean(env.HF_TOKEN) && hfModel
      ? { kind: "huggingface", modelId: hfModel }
      : null;

  const compatibleModel = clean(env.MODEL_ID);
  const compatibleChoice: ProviderChoice | null =
    clean(env.MODEL_BASE_URL) && compatibleModel
      ? { kind: "compatible", modelId: compatibleModel }
      : null;

  const explicit = clean(env.MODEL_PROVIDER);
  if (explicit) {
    // An explicit choice that is not configured yields null, not a silent
    // fall-through to a different provider than the operator asked for.
    if (explicit === "openai") return openaiChoice;
    if (explicit === "huggingface") return huggingfaceChoice;
    if (explicit === "compatible") return compatibleChoice;
    return null;
  }

  return openaiChoice ?? huggingfaceChoice ?? compatibleChoice;
}

/** Human-readable backend name, for the UI and the run record. */
export function providerLabel(choice: ProviderChoice): string {
  if (choice.kind === "openai") return `OpenAI · ${choice.modelId}`;
  if (choice.kind === "huggingface") return `Hugging Face · ${choice.modelId}`;
  return `Self-hosted · ${choice.modelId}`;
}

/** Which env var holds this backend's credential, for error messages. */
export function credentialEnvName(choice: ProviderChoice): string {
  if (choice.kind === "openai") return "OPENAI_API_KEY";
  if (choice.kind === "huggingface") return "HF_TOKEN";
  return "MODEL_API_KEY";
}

/** The credential to name in an auth error for whatever backend is live. */
export function activeCredentialEnvName(env: Env = process.env): string | undefined {
  const choice = resolveProvider(env);
  return choice ? credentialEnvName(choice) : undefined;
}

/**
 * Build the model handle the AI SDK calls.
 *
 * Note `.chat(...)` for everything that is not OpenAI itself: the bare
 * `openai(id)` callable targets the Responses API, which the Hugging Face
 * router and the usual self-hosted servers do not implement. Calling it
 * against them fails with a 404 that looks like a bad model id.
 */
export function languageModel(
  choice: ProviderChoice,
  env: Env = process.env,
  // Injectable for tests: asserting the request we would send is the only way
  // to check this wiring without a live endpoint.
  fetchImpl?: typeof fetch,
): LanguageModel {
  if (choice.kind === "openai") {
    return fetchImpl
      ? createOpenAI({ apiKey: clean(env.OPENAI_API_KEY) ?? "", fetch: fetchImpl })(
          choice.modelId,
        )
      : openai(choice.modelId);
  }

  if (choice.kind === "huggingface") {
    return createOpenAI({
      name: "huggingface",
      baseURL: HUGGINGFACE_BASE_URL,
      apiKey: clean(env.HF_TOKEN) ?? "",
      ...(fetchImpl ? { fetch: fetchImpl } : {}),
    }).chat(choice.modelId);
  }

  return createOpenAI({
    name: "openai-compatible",
    baseURL: clean(env.MODEL_BASE_URL) ?? "",
    // A local server often wants no key; the SDK still requires a string.
    apiKey: clean(env.MODEL_API_KEY) ?? "not-required",
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  }).chat(choice.modelId);
}

/**
 * The model for this process, or null when nothing is configured — in which
 * case the pipeline runs its deterministic reviewer instead.
 */
export function activeModel(
  env: Env = process.env,
  fetchImpl?: typeof fetch,
): { model: LanguageModel; choice: ProviderChoice } | null {
  const choice = resolveProvider(env);
  if (!choice) return null;
  return { model: languageModel(choice, env, fetchImpl), choice };
}
