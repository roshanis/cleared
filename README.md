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
`AUTH_SECRET`, and `APP_ACCESS_CODE`. **Swap in a real identity provider before
opening this to untrusted users** — the role model (`author` / `officer` /
`admin` / `auditor`) and every `requireRole()` call site carry over unchanged.

### Public demo

To share the link openly — anyone can pick a persona, no access code — add
`DEMO_PUBLIC=1` (keeping `DEMO_AUTH=1` and `AUTH_SECRET`; `APP_ACCESS_CODE`
is ignored while public). Signed-in visitors get a demo strip under the nav:
it names the current seat, offers one-click switching to the other three
personas, and suggests the one thing worth trying in each. Two guardrails
apply while `DEMO_PUBLIC=1`:

- Reviews always run the free deterministic heuristic pipeline, even if
  `OPENAI_API_KEY` is set — visitors cannot spend your API budget.
- **Vercel needs a real database.** Each API route deploys as its own
  serverless function with its own memory, so the in-memory fallback cannot
  carry a submission from `/api/submissions` to the execute route — the
  submit → review loop 404s. Attach Postgres (Vercel Storage tab → Neon;
  injects `DATABASE_URL`) and the whole loop works across functions. The
  in-memory mode remains correct for tests and single-process local runs
  only, and the dashboard warns when the app is running on it.

## Environment variables

See `.env.example`. Local development has zero required env vars; production
model reviews and demo auth fail closed unless their env vars are explicitly
configured.

## Deploy

```sh
npm run deploy     # vercel deploy
```

From a clean clone: `npm install`, set env vars in the Vercel dashboard
(add `OPENAI_API_KEY` for model reviews, `DATABASE_URL` for durable Postgres
storage, and `DEMO_AUTH=1` / `AUTH_SECRET` / `APP_ACCESS_CODE` only if you are
intentionally deploying the persona demo — or `DEMO_PUBLIC=1` instead of the
access code for an open demo link), then deploy. The seed runs
automatically on first access so the deployed app looks alive immediately.

The execute and rubric-gate routes declare `maxDuration = 300` for model-mode
reviews. That works on Vercel Pro and on Hobby projects with Fluid Compute
(the default for new projects); if your deploy rejects it, lower both to 60 —
demo-reviewer runs finish instantly either way.

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
