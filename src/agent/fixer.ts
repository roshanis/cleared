import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { Fix } from "@/lib/patch";
import type { Finding } from "@/schema";

/**
 * The fix-it agent drafts compliant rewrites for findings. It only ever
 * proposes text: applyFixes() (src/lib/patch.ts) decides deterministically
 * where the text lands, and nothing is submitted without the author.
 */

/**
 * Demo-mode fixer: templated fixes for the seed criteria. The fixer.test.ts
 * proof loop guarantees these turn the failing sample document into a pass —
 * keep the templates rubric-clean when editing.
 */
const templates: Record<
  string,
  { kind: Fix["kind"]; replacement: string; note: string }
> = {
  C1: {
    kind: "insert",
    replacement:
      "Past performance is not indicative of future results, and investments may lose value.",
    note: "Appends the required risk disclaimer.",
  },
  C2: {
    kind: "replace",
    replacement: "Our fund seeks long-term growth in line with your goals.",
    note: "Removes the performance guarantee.",
  },
  C3: {
    kind: "replace",
    replacement:
      "We aim to deliver consistently strong performance for our clients.",
    note: "Removes the unsubstantiated competitor comparison.",
  },
  C4: {
    kind: "replace",
    replacement:
      "To upgrade your plan, sign in to your secure portal — we never collect account details by email.",
    note: "Replaces the unsecured data request with the secure-portal path.",
  },
  C5: {
    kind: "insert",
    replacement:
      "Details of our fees are available in our fee schedule and Form ADV.",
    note: "Appends the fee-schedule reference.",
  },
  C6: {
    kind: "insert",
    replacement:
      "Your capital is at risk. The value of investments can go down as well as up.",
    note: "Appends the UK capital-at-risk warning.",
  },
  C7: {
    kind: "replace",
    replacement:
      "We continue to work on reducing the environmental impact of our operations.",
    note: "Removes the unsubstantiated sustainability claim.",
  },
};

export function heuristicFixes(findings: Finding[]): Fix[] {
  return findings.flatMap((finding, findingIndex) => {
    const template = templates[finding.criterionId];
    if (!template) return [];
    return [
      {
        findingIndex,
        kind: template.kind,
        quote: finding.quote,
        replacement: template.replacement,
        note: template.note,
      },
    ];
  });
}

const fixerOutputSchema = z.object({
  fixes: z.array(
    z.object({
      findingIndex: z.number().int().min(0),
      kind: z
        .enum(["replace", "insert"])
        .describe(
          "replace = rewrite the quoted passage; insert = append missing required language",
        ),
      replacement: z.string(),
      note: z.string().describe("One line telling the author what changed and why"),
    }),
  ),
});

/** Model-mode fixer: one structured call drafting a fix per finding. */
export async function modelFixes({
  document,
  findings,
  instructions,
  modelId,
}: {
  document: string;
  findings: Finding[];
  instructions: string;
  modelId: string;
}): Promise<Fix[]> {
  const { object } = await generateObject({
    model: openai(modelId),
    schema: fixerOutputSchema,
    system: instructions,
    prompt: [
      "Draft one fix per finding below. The quoted passages are verbatim from the document.",
      JSON.stringify(
        findings.map((f, index) => ({
          index,
          criterionId: f.criterionId,
          severity: f.severity,
          quote: f.quote,
          explanation: f.explanation,
          recommendation: f.recommendation,
        })),
        null,
        2,
      ),
      "",
      "<document>",
      document,
      "</document>",
    ].join("\n"),
  });
  // The model proposes text; the quote it targets always comes from the
  // finding itself so it cannot redirect a fix at unrelated passages.
  return object.fixes
    .filter((fix) => fix.findingIndex >= 0 && fix.findingIndex < findings.length)
    .map((fix) => ({
      ...fix,
      quote: findings[fix.findingIndex].quote,
    }));
}
