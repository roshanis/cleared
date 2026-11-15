import { describe, expect, it } from "vitest";
import { generateObject } from "ai";
import { z } from "zod";
import {
  credentialEnvName,
  DEFAULT_OPENAI_MODEL,
  HUGGINGFACE_BASE_URL,
  languageModel,
  providerLabel,
  resolveProvider,
} from "./provider";

describe("resolveProvider", () => {
  it("uses OpenAI when only its key is set", () => {
    expect(resolveProvider({ OPENAI_API_KEY: "sk-test" })).toEqual({
      kind: "openai",
      modelId: DEFAULT_OPENAI_MODEL,
    });
  });

  it("honours OPENAI_MODEL", () => {
    expect(
      resolveProvider({ OPENAI_API_KEY: "sk-test", OPENAI_MODEL: "gpt-4.1" }),
    ).toEqual({ kind: "openai", modelId: "gpt-4.1" });
  });

  it("uses Hugging Face when a token and a model are both set", () => {
    expect(
      resolveProvider({ HF_TOKEN: "hf_x", HF_MODEL: "Qwen/Qwen3-32B" }),
    ).toEqual({ kind: "huggingface", modelId: "Qwen/Qwen3-32B" });
  });

  it("ignores a Hugging Face token with no model id", () => {
    // There is no sensible default for "whichever open model you meant", and
    // reporting a model backend we cannot actually call is worse than the
    // deterministic reviewer.
    expect(resolveProvider({ HF_TOKEN: "hf_x" })).toBeNull();
  });

  it("ignores a model id with no token", () => {
    expect(resolveProvider({ HF_MODEL: "Qwen/Qwen3-32B" })).toBeNull();
  });

  it("uses a self-hosted endpoint when a base URL and model are set", () => {
    expect(
      resolveProvider({
        MODEL_BASE_URL: "http://localhost:8000/v1",
        MODEL_ID: "my-local-model",
      }),
    ).toEqual({ kind: "compatible", modelId: "my-local-model" });
  });

  it("keeps an existing deployment on OpenAI when a second backend appears", () => {
    // Adding HF_TOKEN must not silently re-point production at another model.
    expect(
      resolveProvider({
        OPENAI_API_KEY: "sk-test",
        HF_TOKEN: "hf_x",
        HF_MODEL: "Qwen/Qwen3-32B",
      }),
    ).toEqual({ kind: "openai", modelId: DEFAULT_OPENAI_MODEL });
  });

  it("lets MODEL_PROVIDER choose deliberately", () => {
    expect(
      resolveProvider({
        MODEL_PROVIDER: "huggingface",
        OPENAI_API_KEY: "sk-test",
        HF_TOKEN: "hf_x",
        HF_MODEL: "Qwen/Qwen3-32B",
      }),
    ).toEqual({ kind: "huggingface", modelId: "Qwen/Qwen3-32B" });
  });

  it("does not fall through when the named provider is unconfigured", () => {
    // Asking for Hugging Face and getting OpenAI silently would bill the
    // wrong account and review on the wrong model.
    expect(
      resolveProvider({ MODEL_PROVIDER: "huggingface", OPENAI_API_KEY: "sk-test" }),
    ).toBeNull();
  });

  it("rejects an unknown provider name rather than guessing", () => {
    expect(
      resolveProvider({ MODEL_PROVIDER: "gemini", OPENAI_API_KEY: "sk-test" }),
    ).toBeNull();
  });

  it("treats blank and whitespace values as unset", () => {
    expect(resolveProvider({ OPENAI_API_KEY: "   " })).toBeNull();
    expect(resolveProvider({})).toBeNull();
  });

  it("names the live backend for the UI", () => {
    expect(
      providerLabel({ kind: "huggingface", modelId: "Qwen/Qwen3-32B" }),
    ).toBe("Hugging Face · Qwen/Qwen3-32B");
    expect(providerLabel({ kind: "openai", modelId: "gpt-4.1" })).toBe(
      "OpenAI · gpt-4.1",
    );
  });

  it("names the credential each backend reads", () => {
    expect(credentialEnvName({ kind: "openai", modelId: "x" })).toBe("OPENAI_API_KEY");
    expect(credentialEnvName({ kind: "huggingface", modelId: "x" })).toBe("HF_TOKEN");
    expect(credentialEnvName({ kind: "compatible", modelId: "x" })).toBe("MODEL_API_KEY");
  });
});

/**
 * The Hugging Face router is not reachable from CI, so assert the request we
 * would send. The thing most likely to be wrong is silent: the bare
 * `openai(id)` callable targets /responses, which the router does not
 * implement, and the resulting 404 reads like a bad model id.
 */
describe("the request sent to a non-OpenAI backend", () => {
  const capture = () => {
    const seen: { url: string; headers: Record<string, string>; body: unknown }[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      // Headers arrive as a Headers instance, an array of pairs, or a plain
      // object depending on the runtime — normalise to lowercase keys.
      const raw = init?.headers;
      const headers: Record<string, string> = {};
      if (raw instanceof Headers) {
        raw.forEach((value, key) => (headers[key.toLowerCase()] = value));
      } else if (Array.isArray(raw)) {
        for (const [key, value] of raw) headers[key.toLowerCase()] = value;
      } else if (raw) {
        for (const [key, value] of Object.entries(raw)) {
          if (value != null) headers[key.toLowerCase()] = String(value);
        }
      }
      seen.push({
        url: String(input),
        headers,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return new Response(
        JSON.stringify({
          id: "x",
          object: "chat.completion",
          created: 0,
          model: "test",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: '{"ok":true}' },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    return { seen, fetchImpl };
  };

  it("posts chat completions to the Hugging Face router with the token", async () => {
    const { seen, fetchImpl } = capture();
    const env = { HF_TOKEN: "hf_secret", HF_MODEL: "Qwen/Qwen3-32B" };
    const model = languageModel(resolveProvider(env)!, env, fetchImpl);

    await generateObject({
      model,
      schema: z.object({ ok: z.boolean() }),
      prompt: "say ok",
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toBe(`${HUGGINGFACE_BASE_URL}/chat/completions`);
    expect(seen[0]!.url).not.toContain("/responses");
    expect(seen[0]!.headers.authorization).toBe("Bearer hf_secret");
    expect((seen[0]!.body as { model: string }).model).toBe("Qwen/Qwen3-32B");
  });

  it("posts to a self-hosted base URL and works without a key", async () => {
    const { seen, fetchImpl } = capture();
    const env = {
      MODEL_BASE_URL: "http://localhost:8000/v1",
      MODEL_ID: "local-llama",
    };
    const model = languageModel(resolveProvider(env)!, env, fetchImpl);

    await generateObject({
      model,
      schema: z.object({ ok: z.boolean() }),
      prompt: "say ok",
    });

    expect(seen[0]!.url).toBe("http://localhost:8000/v1/chat/completions");
    expect((seen[0]!.body as { model: string }).model).toBe("local-llama");
  });
});
