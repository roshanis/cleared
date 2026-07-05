# GOAL — Harden Cleared for people outside the team

> **How to use this file:** paste it as the first message to a coding agent
> working in this repo (or run it via `/goal`). It is the follow-up to
> [GOAL.md](./GOAL.md), which built the app. Read `README.md` and
> `agents-build-log.md` first — they record what exists and why.
>
> The app works as a demo. This goal is about the gap between "demo" and
> "something people outside the team can touch": the model path is
> unexercised, storage can lose or clobber data, and auth is decorative.
> Fix in priority order — P0 items block external users; P1 items block
> trusting the product's own claims.

## Ground rules (apply to every workstream)

- **Demo mode stays first-class.** `npm install && npm run dev` with zero
  config must keep working exactly as today: heuristic reviewer, file
  storage, persona sign-in. Hardening adds production paths; it never breaks
  the zero-config path.
- **The existing suite is the floor.** All 40 tests and the golden-set evals
  stay green. Extend `src/lib/store.ts`'s driver seam and `src/agent/run.ts`'s
  pipeline seam rather than rewriting them.
- **TDD:** every fix lands with a test that fails without it.
- Some items need things only the operator has (API key, accounts, a deployed
  URL). Each workstream lists them under **Needs from operator** — if it isn't
  provided, build everything up to that wall, document the remaining step in
  README, and move on. Do not stall.

---

## P0-1. Exercise the real model path

Everything green so far ran on the deterministic heuristic. The
`generateObject` + OpenAI model path has never executed — schema
mismatches, AI SDK version drift, and latency surprises are all hiding there.

- Run `npm run eval` and a full submit→review flow with a real key. Fix
  whatever breaks (schema shape, zod version interplay, SDK API drift) until
  the golden set passes in **model mode**.
- Measure and record real latency (append to README). Handle the failure
  modes the heuristic never hits: provider errors, rate limits, refusals,
  malformed outputs — each must surface as the run's `error` state with an
  honest UI message, never a hang or a silent `pass`.
- **Function-timeout reality:** `maxDuration = 300` on the execute route only
  works on Vercel Pro; Hobby caps around 60s. Restructure so a model review
  survives a Hobby deploy (e.g. background execution via `waitUntil` +
  status polling against durable storage, or chunked per-reviewer steps), or
  — if you choose to require Pro — make the app detect and say so rather
  than timing out opaquely. Document the chosen behavior per plan tier.

**Needs from operator:** `OPENAI_API_KEY`; which Vercel plan to target.

**Done when:** golden set passes in model mode; a model-mode submit completes
on the target plan's timeout budget; every provider failure mode has a test
and an honest UI state.

## P0-2. Storage that can't lose or clobber data

Two problems: without Upstash, deployed data is per-lambda memory (documents
can 404 between requests); and even with Redis, the whole-DB-as-one-JSON-blob
design lets two concurrent writes silently clobber each other. A compliance
product is eventually a system of record — the audit trail must not be lossy.

- Replace the single-blob production path with per-entity storage that has
  real concurrency semantics: either Postgres (recommended for the
  trajectory; Neon/Vercel Postgres) with a small schema + migrations, or
  Upstash restructured with per-entity keys and optimistic concurrency.
  Keep the zero-config file driver for local dev behind the same interface.
- Add a concurrency test: two simultaneous submissions (and a submission
  concurrent with a decision) both persist. This test must fail against the
  current blob driver before the fix.
- If a production deploy has no durable store configured, fail loudly at
  startup or plaster the UI with the demo-storage warning — never quietly
  drop an officer's decision.

**Needs from operator:** provisioned database (one click in Vercel
Marketplace) + its env vars, if Postgres is chosen.

**Done when:** the concurrency test passes; a deployed submission survives
across lambda instances; decisions and rubric versions are never lost or
overwritten; README documents the schema and migration story.

## P0-3. Auth that actually authenticates

Today anyone with the URL can sign in as admin unless `APP_ACCESS_CODE` is
set; `AUTH_SECRET` falls back to a hardcoded dev secret (forgeable tokens);
authorization keys off display names; mutating POSTs have no CSRF protection.

- Integrate a real identity provider via Auth.js (recommended: one OAuth
  provider to start), with roles assigned server-side (seed an initial admin
  by email via env var). Keep persona sign-in available only when explicitly
  enabled (`DEMO_AUTH=1`, default on locally, off in production).
- Key all authorization off stable user IDs, not display names. Migrate
  `document.author` and decision/rubric attribution accordingly.
- Production fails closed: no `AUTH_SECRET` (or equivalent) set → refuse to
  start, not fall back to the dev secret.
- CSRF: enforce same-origin on all mutating routes (Origin/Sec-Fetch-Site
  checks or tokens) with tests.

**Needs from operator:** OAuth app credentials for the chosen provider.

**Done when:** an unauthenticated stranger can reach nothing but the sign-in
page in production config; forged/absent-secret tokens are rejected by a
test; an author cannot touch another author's documents by any route;
cross-origin POSTs are rejected by a test.

---

## P1-4. Make the golden set prove something

The three golden cases were written alongside the heuristic's regexes — evals
passing shows the regexes match their own test data, not that the product
catches real violations. And the rubric publish gate silently ignores custom
criteria in demo mode (the heuristic only knows C1–C5).

- Add adversarial golden cases the current heuristic was *not* tuned on:
  paraphrased guarantees ("returns you can count on"), re-worded disclaimers,
  a clean document that superficially resembles a violation, a violation
  buried mid-paragraph. It is acceptable — and informative — if the heuristic
  fails some; mark expected-to-fail-in-demo-mode cases so CI distinguishes
  "heuristic limitation" from "regression". Model mode should pass all.
- Gate honesty: when a rubric contains criteria the heuristic doesn't
  implement, the demo-mode gate must say so explicitly ("2 criteria not
  exercised by the demo reviewer") instead of green-lighting; publishing such
  a rubric from a demo-mode gate requires an explicit acknowledgment.

**Done when:** the golden set includes ≥4 new adversarial cases with recorded
per-mode expectations; the gate visibly distinguishes exercised from
unexercised criteria; CI reports heuristic-known-limits separately from
regressions.

## P1-5. Quote highlighting that survives model paraphrase

Model reviewers re-wrap whitespace and lightly paraphrase quotes; exact
substring matching will miss them and Maya silently loses inline highlights.

- Add fuzzy quote location: whitespace/punctuation-normalized matching first,
  then a bounded similarity fallback (e.g. normalized token-window match).
  Never highlight the wrong passage — below the confidence bar, don't match.
- When a quote can't be located, the finding card says "quote not located in
  document" instead of pretending nothing is missing.
- Tests: re-wrapped whitespace matches; light paraphrase matches; a fabricated
  quote does not match and triggers the honest fallback.

**Done when:** those tests pass and a model-mode review of a golden document
renders highlights for every locatable finding.

## P1-6. Cost and rate controls

A signed-in user can currently spam submissions, each fanning out multiple
Opus calls, uncapped.

- Per-user rate limit on submission + execute routes (sensible default, env
  override) returning 429 with a clear message the UI renders.
- A global daily review cap (env) as the blunt backstop; admin dashboard
  shows reviews-today against it.
- Tests for both limits.

**Done when:** limits are enforced and tested, and a rate-limited Maya sees
a human explanation, not a broken form.

---

## Operator checklist (things an agent cannot do for you)

1. `vercel deploy` from your account; set env vars (`AUTH_SECRET`, provider
   keys, `OPENAI_API_KEY`, database/Upstash credentials).
2. Provision the durable store (Vercel Marketplace) and the OAuth app.
3. Confirm plan tier (Hobby vs Pro) — it decides the P0-1 timeout strategy.
4. Walk GOAL.md §7's definition-of-done boxes **on the deployed URL**.
5. Decide the eve question: this build deliberately runs on plain Next.js +
   Vercel AI SDK because eve's real API couldn't be verified offline. If you
   want the eve runtime (durable execution, built-in approvals), rerun that
   migration as its own goal *with eve's docs available* — don't let an agent
   guess at the API. The seam is `src/agent/run.ts` + the two routes calling it.

## Non-goals

No UI redesign; no new personas or features beyond what hardening requires;
no billing; no enterprise SSO/SCIM; no eve migration inside this goal (see
checklist item 5); no speculative microservice/queue infrastructure beyond
what P0-1's timeout strategy needs.

## Working agreements

Work in priority order; finish a workstream (tests + README + build-log
entry) before starting the next. Make reasonable calls on minor decisions and
note them; stop only for destructive actions, spending/account decisions, or
conflicts with this spec. Report with evidence — test output, latency
numbers, curl transcripts — and never claim a "done when" you didn't verify.
