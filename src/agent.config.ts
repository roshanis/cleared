// Framework-portable agent definition. The runtime pipeline lives in
// src/agent/run.ts (reviewer subagents via the Vercel AI SDK, orchestration
// as deterministic code); this file remains the single place that names the
// model and the prompt assets.
import { readFileSync } from "node:fs";
import path from "node:path";
import { reviewResultSchema } from "./schema";

export const MODEL_ID = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";

export const promptFile = (name: string) =>
  readFileSync(path.join(process.cwd(), "src", "prompts", `${name}.md`), "utf8");

export const agentConfig = {
  name: "compliance-reviewer",
  model: MODEL_ID,
  outputSchema: reviewResultSchema,
  prompts: {
    orchestrator: "orchestrator",
    subagents: [
      { name: "policy-reviewer", prompt: "reviewer-policy", area: "content" },
      { name: "risk-reviewer", prompt: "reviewer-risk", area: "risk" },
    ],
  },
} as const;
