# Cleared — compliance review, before it ships

A web app where teams get customer-facing documents reviewed for compliance.
An AI pipeline — two reviewer subagents plus deterministic orchestration —
checks each document against a versioned rubric and returns a verdict with
exact quotes and fixes. Humans stay in charge: failed or uncertain documents
land in a review queue, every decision needs a note, and the full history is
exportable for audit.

Built from [GOAL.md](./GOAL.md). Tests: `npm test` (40 tests + golden-set
evals). Deploys to Vercel as a single Next.js project.

## Quick start

```sh
npm install
npm run dev        # http://localhost:3000
```

No configuration needed: without an `OPENAI_API_KEY` the app runs in demo
mode (a deterministic heuristic reviewer — the UI says so), storage is a local
JSON file (`.data/db.json`), and the store self-seeds with demo documents on
first run.

Sign in as a persona to see each customer's experience:

| Persona | Role | What they do |
|---|---|---|
| Maya Chen | author | Submit documents, act on findings, resubmit |
| Devon Park | officer | Review queue, accept/dismiss findings, approve/reject with a note |
| Priya Nair | admin | Everything + rubric editing, dashboard |
| Sam Osei | admin | Audit history and CSV export |

## Model mode

Set `OPENAI_API_KEY` and reviews run through two model reviewer subagents
(`gpt-5.4-mini` by default via the Vercel AI SDK; override with
`OPENAI_MODEL`) — one for content criteria, one for data-handling risk. Their
findings are merged, deduped, and scored **in code**
(`src/agent/`): the rubric owns severities and verdict rules, so verdicts stay
auditable regardless of model behavior. Low-confidence fail-level findings
route to a human instead of failing outright.

Model-mode failures are explicit and retryable. If the provider rejects the
key, rate-limits the request, times out, refuses, or returns malformed
structured output, the run is persisted as `error` with a human-readable
message. The submit screen shows the message without clearing the draft, and
the document history renders the failed run with "resubmit to retry." Retrying
reclaims the errored run and clears the previous error before re-executing.

### Model-mode latency and validated model (measured 2026-07-08)

The five-case golden set was run live against the OpenAI API
(`npx tsx --env-file=.env evals/run.ts`):

- **`OPENAI_MODEL=gpt-5.4` — all 5 golden cases pass, verified twice
  consecutively with identical results.** Full set: 20–26s wall clock,
  ≈ **4–5s per review** (two reviewers in parallel, then the judge —
  three model calls per review). This is the validated configuration for
  client deployments.
- **`gpt-5.4-mini` (the zero-config default) is demo-grade only:** across
  four runs it showed run-to-run variance — phantom findings (C2/C4/C5)
  on compliant documents and intermittent misses of the UK C6 absence
  check. Fine for the budget-capped public demo; do not put it in front
  of a design partner.

Calibration that got here (see `agents-build-log.md`): reviewer prompts
rewritten around a violations-only contract with an explicit
`compliantCriteria` outlet (the mini model was returning "this complies"
notes as findings), a deterministic contradiction filter (a finding whose
criterion the reviewer itself declared compliant is dropped in code), a
concrete-defect bar for judge challenges, and C2/C3/C6 rubric
descriptions sharpened at their boundaries.

With the adversarial set (11 cases, P1-4): **gpt-5.4 passes the full
set** (clean run recorded 2026-07-08). Residual variance is one mode —
the judge intermittently (~1 in 3 runs) escalates the UK capital-at-risk
case to `needs_human_review` instead of `fail`. That escape is always in
the safe direction: a human sees it, nothing wrongly passes — the
designed behavior of an escalate-only judge under uncertainty.

## How the agents work (the plain-language version)

Think of a newspaper editor's desk. When an author submits a document, it
passes down a line of specialists:

1. **Two reviewers read it at the same time.** The *policy reviewer* looks
   for things like guaranteed-returns claims and missing disclaimers; the
   *risk reviewer* looks for things like asking customers for account
   numbers. Each reads the document against the rubric — the versioned rule
   list an admin maintains — and writes findings. Every finding must include
   the **exact quote**, the rule it breaks, and a suggested fix. No vibes,
   no scores: point at the sentence or it doesn't count.
2. **A judge checks the reviewers' homework.** After findings are merged and
   deduped, the judge agent asks "is this real?" — e.g. does the quote
   actually appear in the document, or did a reviewer hallucinate it? The
   trick: **the judge can only make things stricter, never looser.** It can
   flag a possible false positive or route the document to human review, but
   it can never flip a fail into a pass — that power doesn't exist in the
   code.
3. **A robot — plain deterministic code, not AI — makes the verdict.** This
   is the house rule the whole app is built on: **agents propose, code
   disposes.** Agents only produce structured findings; unit-tested
   TypeScript (`src/agent/verdict.ts`) applies the rubric's rules ("a major
   violation = fail, minors = needs review"), computed per market
   (US/UK/EU). The same findings always produce the same verdict — that's
   what makes it auditable.
4. **A fixer, only when asked.** If the document fails and the author clicks
   **Draft fixes**, a fourth agent drafts a compliant rewrite per quoted
   violation. Code does the careful part: it locates each quote and swaps in
   the replacement, and says "apply manually" when it can't find a passage
   rather than guessing. Nothing is auto-submitted — the author reviews the
   patched draft and resubmits it.
5. **A human always has the last word.** Anything failed or uncertain lands
   in the officer's queue. He can accept or dismiss any finding but can't
   decide without a note — and his decision, not the agents', is what goes
   in the audit trail.

In the website: "Submit for review" calls `/api/submissions` (saves the
document) then `/api/runs/{id}/execute`, which runs the whole chain in
`src/agent/run.ts` and persists the result. The staged progress you see
("Policy reviewer reading… Judge verifying quotes…") is the real pipeline
order, paced so you can read it.

In demo mode every agent is replaced by a deterministic stand-in (regex
reviewers, a quote-verifying judge, templated fixes) so it costs nothing and
gives identical results every run. Set an API key and the same pipeline
swaps in real model calls — same stages, same merge, same judge rules, same
robot verdict.

## The regression loop (the part that matters)

- `evals/golden/` — golden documents with expected outcomes
- `evals/grade.ts` — grading harness (verdict + expected criteria)
- `npm test` — runs the golden set through the full pipeline in CI
- `npm run eval` — same from the CLI (uses model reviewers when a key is set)
- **Rubric publish gate** — editing the rubric in the UI creates a draft
  version; the app runs the golden set against it and shows per-case deltas
  before allowing publish. Rubric versions are immutable and every review
  records which version judged it.

Grow `evals/golden/` with sanitized real documents — that's what makes prompt,
rubric, and model changes safe.

Golden `expected.json` files can also mark eval metadata:

- `modelOnly: true` means the case is an explicit deterministic-reviewer known
  limit. Heuristic CI and demo-mode gates report it separately instead of
  failing it; model-mode evals still run it.
- `seedDemo: false` keeps adversarial or cluttering eval cases out of the
  seeded demo queue while preserving them in CI and rubric gates.

Demo-mode rubric gates also report criteria the deterministic reviewer does
not implement. Publishing a passing demo-mode gate with such custom criteria
requires an explicit acknowledgment in the rubric editor.

## Storage

Per-entity driver layer (`src/lib/store.ts` → `src/lib/db/`):

| Environment | Driver | Durability |
|---|---|---|
| Local dev | SQLite (`.data/app.db`) | Durable |
| Production (DATABASE_URL set) | Postgres via `DATABASE_URL` | Durable |
| Tests / Vercel without DB | In-memory | Per-instance demo only (dashboard warns) |

For production on Vercel, set `DATABASE_URL` to a Neon or Vercel Postgres
connection string. The app bootstraps the schema and seeds demo data on first
access automatically. The legacy `.data/db.json` can be deleted — the store
reseeds from scratch on first run.

Concurrent writes are safe: SQLite uses `BEGIN IMMEDIATE` transactions
serialized in-process; Postgres uses interactive transactions with unique
constraints as the conflict arbiter.

## Auth

Demo persona sign-in with signed httpOnly cookies (`src/lib/session.ts`,
HMAC via `AUTH_SECRET`). Persona auth is enabled by default only outside
production. To deploy the persona demo intentionally, set `DEMO_AUTH=1`,
`AUTH_SECRET`, and `APP_ACCESS_CODE`.

Production user sign-in uses Auth.js with Google OAuth. OAuth is configured
only when both `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are present; otherwise
the login page keeps the demo persona path when demo auth is enabled, or shows
an honest "OAuth not configured" state. Until WS-2 adds invitations and user
records, OAuth sign-in is fail-closed: set `ADMIN_EMAIL` to seed the first
admin, and every other Google email is rejected with a clear sign-in message.
OAuth and demo sessions normalize through `getSession()` to the same
`Session` shape used by `requireRole()`.

Google OAuth setup:

1. In Google Cloud Console, create or select a project, then configure the
   OAuth consent screen for the deployment owner.
2. Go to APIs & Services → Credentials → Create credentials → OAuth client ID.
3. Choose Web application.
4. Add authorized redirect URIs:
   - Local dev: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://<your-domain>/api/auth/callback/google`
5. Copy the client ID and secret into the deployment environment as
   `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
6. Set `AUTH_SECRET` to a strong random value and set `ADMIN_EMAIL` to the
   first admin's Google email address.

### Public demo

> **WARNING:** Production startup now refuses `DEMO_AUTH=1` or `DEMO_PUBLIC=1`
> unless `ALLOW_DEMO_DEPLOY=1` is also set. The current public demo deployment
> intentionally uses `DEMO_AUTH=1` + `DEMO_PUBLIC=1`, so set
> `ALLOW_DEMO_DEPLOY=1` in Vercel before the next deploy or the demo will fail
> closed at startup.

To share the link openly — anyone can pick a persona, no access code — add
`DEMO_PUBLIC=1` (keeping `DEMO_AUTH=1` and `AUTH_SECRET`; `APP_ACCESS_CODE`
is ignored while public). Signed-in visitors get a demo strip under the nav:
it names the current seat, offers one-click switching to the other three
personas, and suggests the one thing worth trying in each. Two guardrails
apply while `DEMO_PUBLIC=1`:

- Reviews run the free deterministic heuristic pipeline by default, even if
  `OPENAI_API_KEY` is set — visitors cannot spend your API budget unless you
  explicitly opt in to public model reviews.
- **Vercel needs a real database.** Each API route deploys as its own
  serverless function with its own memory, so the in-memory fallback cannot
  carry a submission from `/api/submissions` to the execute route — the
  submit → review loop 404s. Attach Postgres (Vercel Storage tab → Neon;
  injects `DATABASE_URL`) and the whole loop works across functions. The
  in-memory mode remains correct for tests and single-process local runs
  only, and the dashboard warns when the app is running on it.

#### Live model reviews on the public demo

To let anonymous visitors run live model reviews, set `DEMO_PUBLIC_MODEL=1`
alongside `DEMO_PUBLIC=1` and `OPENAI_API_KEY`. The app enforces
the daily model cap per UTC day, defaulting to 200 submissions. Set
`GLOBAL_MODEL_DAILY_CAP` for the production-wide cap; legacy
`DEMO_MODEL_DAILY_CAP` remains supported as the fallback. After the cap is
reached, new public-demo submissions fall back to the deterministic reviewer
and the response still reports which reviewer ran. Authenticated non-public
model submissions receive a 429 with a retry hint instead. Keep an OpenAI-side
budget cap enabled too — this application cap is a product guardrail, not a
billing control.

## Runtime guardrails

Production startup runs through `instrumentation.ts`, which calls
`assertProductionSafeEnv()` once per server process/function startup. In
`NODE_ENV=production`, the app fails closed with a plain error if demo flags
are set without `ALLOW_DEMO_DEPLOY=1`, if `AUTH_SECRET` is missing, or if no
durable Postgres URL is configured through `DATABASE_URL` or `POSTGRES_URL`.

Submission creation also has application-level caps:

- `RATE_LIMIT_SUBMISSIONS` and `RATE_LIMIT_WINDOW_MINUTES` default to 10
  submissions per signed-in user per 10 minutes.
- `MAX_DOCUMENT_CHARS` defaults to 50000 characters.
- `GLOBAL_MODEL_DAILY_CAP` defaults to 200 model-review submissions per UTC
  day; `DEMO_MODEL_DAILY_CAP` is still read as a fallback for existing demo
  deployments.

## Environment variables

See `.env.example`. Local development has zero required env vars; production
model reviews, durable storage, and demo auth fail closed unless their env vars
are explicitly configured.

## Deploy

```sh
npm run deploy     # vercel deploy
```

From a clean clone: `npm install`, set env vars in the Vercel dashboard
(add `OPENAI_API_KEY` for model reviews, `DATABASE_URL` for durable Postgres
storage, `AUTH_SECRET` + `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` +
`ADMIN_EMAIL` for Google OAuth, and `DEMO_AUTH=1` / `APP_ACCESS_CODE` only if
you are intentionally deploying the persona demo — or `DEMO_PUBLIC=1` instead
of the access code for an open demo link). If any production demo flag is set,
also set `ALLOW_DEMO_DEPLOY=1` intentionally. Then deploy. The seed runs
automatically on first access so the deployed app looks alive immediately.

The execute and rubric-gate routes declare `maxDuration = 300` for model-mode
reviews. Cleared intentionally does not add job-queue infrastructure in Phase
1. The deployment decision is: run model reviews only on Vercel Pro or on a
Hobby project with Fluid Compute enabled. If a deployment rejects
`maxDuration = 300`, keep live model reviews disabled or upgrade/enable Fluid
Compute; the deterministic demo reviewer finishes inside the shorter Hobby
budget.

## Layout

```
src/agent/        review pipeline: model + heuristic reviewers, merge, verdict
src/prompts/      orchestrator + reviewer prompts, rubric template (markdown)
src/lib/          store (drivers), sessions/roles, seed, metrics, highlight, csv
src/app/          Next.js App Router: pages per persona + API routes
src/components/   result view w/ inline quote highlights, decision panel, rubric editor…
evals/            golden set, grading harness, pipeline eval, eval CLI
```

## A note on eve

GOAL.md targeted Vercel's eve agent framework. eve shipped after this
implementation's knowledge cutoff and its docs weren't reachable during the
build, so rather than guess at its API the review pipeline is implemented
directly on the Vercel AI SDK — deployable today, with the agent definition
kept portable in `src/agent.config.ts` + `src/prompts/`. Migrating the
pipeline onto eve (durable execution, built-in approvals) is a contained swap
inside `src/agent/run.ts` and the two API routes that call it.
