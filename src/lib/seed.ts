import path from "node:path";
import { runReview } from "@/agent/run";
import { loadGoldenCases } from "../../evals/grade";
import { defaultRubricDraft } from "./rubric";
import {
  newId,
  publishedRubric,
  type Db,
  type Decision,
  type FindingOverride,
} from "./store";

const daysAgo = (days: number, extraMinutes = 0) =>
  new Date(Date.now() - days * 86400e3 + extraMinutes * 60e3).toISOString();

const titleFrom = (input: string, fallback: string) => {
  const subject = input.match(/^Subject:\s*(.+)$/m);
  return subject ? subject[1].trim() : fallback;
};

interface DemoCase {
  id: string;
  input: string;
  jurisdictions?: string[];
}

const demoCases: DemoCase[] = [
  {
    id: "006-monthly-client-newsletter",
    jurisdictions: ["US"],
    input: `Subject: July market note for Meridian clients

Hi Jordan,

Our July note is now available in the secure client portal. It covers recent
allocation changes, why we increased short-duration bond exposure, and how the
committee is thinking about diversification through the rest of the year.

Past performance is not indicative of future results, and all investments may
lose value. Details of our advisory fees are available in our fee schedule and
Form ADV.

Please log in to the portal for the full commentary. Do not reply with account
details.

-- The Meridian Advisory Team`,
  },
  {
    id: "007-fee-waiver-promotion",
    jurisdictions: ["US"],
    input: `Subject: 90-day advisory fee waiver for new deposits

Hi Taylor,

For accounts opened by Friday, Meridian will waive advisory fees for the first
90 days. The Balanced Portfolio remains subject to market movement and is built
for long-term investors, not short-term certainty.

Past performance is not indicative of future results, and all investments may
lose value.

Schedule a call in the portal if you would like to review whether the offer fits
your plan.

-- Meridian Growth Desk`,
  },
  {
    id: "008-uk-income-fund-email",
    jurisdictions: ["UK"],
    input: `Subject: UK clients: Meridian Income Fund update

Dear investor,

The Meridian Income Fund is open for new subscriptions this month. The fund
invests in a diversified mix of dividend-paying equities and investment-grade
bonds, with income distributed quarterly.

Past performance is not indicative of future results, and all investments may
lose value. Details of our fees are available in our fee schedule and Form ADV.

Speak with your adviser through the secure portal if you would like to review
the fund.

Best regards,
The Meridian Team`,
  },
  {
    id: "009-eu-sustainable-portfolio",
    jurisdictions: ["EU"],
    input: `Subject: EU clients: sustainable portfolio option

Dear investor,

Meridian's sustainable portfolio option is now available for clients who want a
long-term allocation built around diversified global equities and bonds.

Past performance is not indicative of future results, and all investments may
lose value. Details of our fees are available in our fee schedule and Form ADV.

Please contact your adviser through the secure portal to learn more.

Best regards,
The Meridian Team`,
  },
];

const ageByCase: Record<string, number> = {
  "001-compliant-review-notice": 14,
  "006-monthly-client-newsletter": 12,
  "002-guaranteed-returns-pitch": 10,
  "007-fee-waiver-promotion": 8,
  "003-unsubstantiated-comparison": 6,
  "008-uk-income-fund-email": 4,
  "004-uk-missing-capital-at-risk": 2,
  "009-eu-sustainable-portfolio": 1,
  "005-multimarket-clean": 0,
};

const decisionPlan: Record<
  string,
  {
    action: Decision["action"];
    note: string;
    overrideAction: FindingOverride["action"];
    extraMinutes: number;
  }
> = {
  "002-guaranteed-returns-pitch": {
    action: "reject",
    overrideAction: "accept",
    note:
      "Rejecting. The guarantee, missing baseline disclaimer, and request for account details all need to come out before this can be sent.",
    extraMinutes: 45,
  },
  "007-fee-waiver-promotion": {
    action: "approve",
    overrideAction: "dismiss",
    note:
      "Approved for the demo campaign. I am dismissing the fee-reference finding because the linked landing page already carries the full fee schedule and Form ADV language.",
    extraMinutes: 90,
  },
  "003-unsubstantiated-comparison": {
    action: "approve",
    overrideAction: "dismiss",
    note:
      "Approved after checking the source deck. The Vanguard comparison is backed by the benchmark study the advisor will attach before sending.",
    extraMinutes: 120,
  },
  "008-uk-income-fund-email": {
    action: "reject",
    overrideAction: "accept",
    note:
      "Rejecting for the UK send. Add the capital-at-risk warning next to the product description, then resubmit.",
    extraMinutes: 60,
  },
};

/**
 * Idempotent seed: rubric v1 (published) always; demo data — the golden
 * documents reviewed through the real pipeline (deterministic heuristic
 * reviewers) plus lived-in officer decisions — unless disabled.
 */
export async function seedInto(
  db: Db,
  opts: { demoData?: boolean } = {},
): Promise<void> {
  const { demoData = true } = opts;

  if (db.rubrics.length === 0) {
    db.rubrics.push({
      ...defaultRubricDraft,
      version: 1,
      author: "Priya Nair",
      createdAt: daysAgo(40),
      publishedAt: daysAgo(40),
      goldenGate: null,
    });
  }

  if (!demoData || db.documents.length > 0) return;

  const rubric = publishedRubric(db);
  const goldens = loadGoldenCases(path.join(process.cwd(), "evals", "golden"));
  const cases: DemoCase[] = [
    ...goldens
      .filter((golden) => golden.expected.seedDemo)
      .map((golden) => ({
        id: golden.id,
        input: golden.input,
        jurisdictions: golden.expected.jurisdictions,
      })),
    ...demoCases,
  ].sort((a, b) => (ageByCase[b.id] ?? 0) - (ageByCase[a.id] ?? 0));

  for (const demo of cases) {
    const age = ageByCase[demo.id] ?? 2;
    const createdAt = daysAgo(age);
    const document = {
      id: newId("doc"),
      title: titleFrom(demo.input, demo.id),
      author: "Maya Chen",
      createdAt,
    };
    db.documents.push(document);
    const version = {
      id: newId("ver"),
      documentId: document.id,
      number: 1,
      author: document.author,
      content: demo.input,
      createdAt,
    };
    db.versions.push(version);
    const result = await runReview(
      demo.input,
      rubric,
      "heuristic",
      demo.jurisdictions,
    );
    const run = {
      id: newId("run"),
      documentId: document.id,
      versionId: version.id,
      status: "done" as const,
      reviewer: "heuristic" as const,
      rubricVersion: rubric.version,
      result,
      error: null,
      createdAt,
      finishedAt: daysAgo(age, 1),
      jurisdictions: demo.jurisdictions,
    };
    db.runs.push(run);

    const plannedDecision = decisionPlan[demo.id];
    if (plannedDecision && result.verdict !== "pass") {
      db.decisions.push({
        id: newId("dec"),
        runId: run.id,
        documentId: document.id,
        officer: "Devon Park",
        action: plannedDecision.action,
        note: plannedDecision.note,
        overrides: result.findings.map((_, findingIndex) => ({
          findingIndex,
          action: plannedDecision.overrideAction,
        })),
        createdAt: daysAgo(age, plannedDecision.extraMinutes),
      });
    }
  }
}
