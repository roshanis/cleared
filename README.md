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
`admin`) and every `requireRole()` call site carry over unchanged.

## Environment variables

See `.env.example`. Local development has zero required env vars; production
model reviews and demo auth fail closed unless their env vars are explicitly
configured.

## Deploy

```sh
npm run deploy     # vercel deploy
```

From a clean clone: `npm install`, set env vars in the Vercel dashboard
(add `OPENAI_API_KEY` for model reviews, the Upstash pair for durable storage,
and `DEMO_AUTH=1` / `AUTH_SECRET` / `APP_ACCESS_CODE` only if you are
intentionally deploying the persona demo), then deploy. The seed runs
automatically on first access so the deployed app looks alive immediately.

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
