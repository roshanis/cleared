# GOAL — Take Cleared live for 100 users (Phase 1 of ROADMAP.md)

> **How to use this file:** paste it as the first message to a coding agent
> working in this repo (or run it via `/goal`). It executes Phase 1 of
> [ROADMAP.md](./ROADMAP.md): live with 1–3 design-partner clients,
> ~100 total users, one deployment per client. Read `README.md`,
> [GOAL-HARDENING.md](./GOAL-HARDENING.md), and `agents-build-log.md`
> first — hardening P0-2 (durable per-entity storage) already shipped;
> P0-1, P0-3, and P1-4/5/6 have not.

## Ground rules

- **Demo mode stays first-class.** `npm install && npm run dev` with zero
  config keeps working exactly as today: heuristic reviewer, local storage,
  persona sign-in. Going live adds production paths; it never breaks the
  zero-config path or the public demo (`DEMO_PUBLIC=1`).
- **The existing suite is the floor.** All tests and golden-set evals stay
  green. Extend the driver seam (`src/lib/db/`) and pipeline seam
  (`src/agent/run.ts`); don't rewrite them.
- **TDD:** every workstream lands with tests that fail without it.
- Work in priority order; finish a workstream (tests + README + build-log
  entry) before starting the next. If an operator-provided item is missing,
  build to that wall, document the remaining step, and move on.

---

## WS-1. Execute the open GOAL-HARDENING items (by reference)

These are specced in GOAL-HARDENING.md and are unchanged prerequisites;
do them first, in this order:

1. **P0-1 — exercise the real model path** (model-mode golden set green,
   background execution or documented plan-tier behavior for long reviews,
   honest error states for provider failures).
2. **P0-3 — auth that actually authenticates** (Auth.js with one OAuth
   provider, stable user IDs, fail-closed secrets, CSRF).
3. **P1-6 — cost and rate controls** (per-user rate limits + global daily
   cap, 429s the UI renders). Promoted from P1 to go-live blocker: the
   moment real clients share a deployment with real API spend, this is P0.
4. **P1-4 and P1-5** (adversarial golden cases; fuzzy quote location) —
   required before a design partner sees model-mode output, because both
   protect the product's core honesty claims.

Their "Done when" clauses apply verbatim.

## WS-2. Users are records, not personas

P0-3 gives us authentication; this workstream gives us user management.
Today the four personas are hardcoded in `src/lib/session.ts` and
attribution keys off display names.

- Add a `users` entity to the driver layer (all three drivers): id, email,
  display name, role (`author`/`officer`/`admin`/`auditor`), status
  (`invited`/`active`/`deactivated`), created/updated timestamps.
- **Invitation flow, no self-signup:** an admin invites by email; the
  invitee signs in via the OAuth provider and lands with the assigned
  role. Seed the first admin by env var (`ADMIN_EMAIL`), as P0-3 specs.
  Sign-in by an email with no user record or a `deactivated` status is
  rejected with a clear screen — never auto-provisioned.
- **Admin user-management screen** (admin role only): list users with role
  and status, invite, change role, deactivate/reactivate. Deactivation
  invalidates live sessions (session tokens carry a generation or the
  session check consults user status — a deactivated officer's next
  request lands on the sign-in page, tested).
- Migrate attribution: `document.author`, run/decision actors, and rubric
  attribution reference user ids. Existing demo persona data maps to
  seeded demo users so demo mode is unchanged.
- Demo mode: personas become seeded user records behind the same entity,
  so there is one code path for "who did this" everywhere.

**Needs from operator:** nothing new beyond P0-3's OAuth credentials.

**Done when:** an invited user can sign in and holds exactly the assigned
role; an uninvited OAuth sign-in is rejected (tested); deactivation kills
a live session (tested); every run/decision in a fresh production flow
records a real user id; demo mode still self-seeds and all four personas
work with zero config.

## WS-3. Production refuses to be a demo

The README warns operators not to ship demo flags to production; the app
should enforce it.

- Startup assertion in production builds (`NODE_ENV=production` on
  Vercel): if `DEMO_AUTH=1` or `DEMO_PUBLIC=1` is set **and**
  `ALLOW_DEMO_DEPLOY=1` is not, refuse to serve with a plain explanation
  (the intentional public demo sets `ALLOW_DEMO_DEPLOY=1` explicitly).
- Same assertion for missing `AUTH_SECRET` or missing `DATABASE_URL` in
  production: fail loudly at startup, per P0-2/P0-3's fail-closed rule.
- Input caps on submit routes: max document size (env, sensible default),
  rejected with a message the form renders. Test at the boundary.

**Done when:** a production boot with demo flags and no explicit override
fails with a clear message (tested via the assertion function); oversized
submissions are rejected gracefully (tested); the public demo deployment
still works when configured intentionally.

## WS-4. Operations: backups, restore, onboarding runbook

- Document and rehearse restore: with Neon PITR enabled, write
  `docs/operations.md` covering backup posture, a step-by-step restore
  rehearsal, and secret rotation (`AUTH_SECRET`, OAuth, `OPENAI_API_KEY`).
  Where a step needs operator hands, write the exact click-path.
- Write `docs/client-onboarding.md`: the deployment-per-client checklist —
  Vercel project, Neon database, env vars, first-admin seeding, smoke
  checks (submit → verdict → decision → audit export as real users).
  This checklist **is** the Phase-1 tenancy model; make it exact enough
  that onboarding client #3 is boring.
- Add a `/api/health` route reporting storage driver, reviewer mode, and
  schema version — the onboarding smoke check curls it.

**Needs from operator:** Neon PITR toggle; one rehearsed restore on a
throwaway branch database.

**Done when:** both docs exist and were walked once for real; health route
tested; a fresh clone + checklist produces a working client deployment.

## WS-5. Utilization metrics that prove the product works

Phase 1's exit question is "do design partners actually use it?" —
instrument the answer. `src/lib/metrics` exists; extend it.

- Compute and show on the admin dashboard: reviews per author per week,
  time-to-first-verdict (p50/p95), time-to-officer-decision (p50/p95),
  % of runs routed to human review, model error rate, reviews-today
  against the global cap (from P1-6).
- Record real model-mode latency in README as P0-1 requires.
- No external analytics service; compute from the entities we already
  store. Tests cover the metric computations with fixture data.

**Done when:** the dashboard shows all six numbers from stored data
(tested with fixtures); README records measured model-mode latency.

---

## Operator checklist (things an agent cannot do for you)

1. OAuth app credentials for the chosen provider (P0-3) and
   `OPENAI_API_KEY` (P0-1); set env vars in Vercel per deployment.
2. Provision one Neon database per client; enable PITR; confirm the
   Vercel plan tier (decides P0-1's timeout strategy).
3. Nominate the first admin email per client (`ADMIN_EMAIL`).
4. Walk `docs/client-onboarding.md` end-to-end for client #1 on the
   deployed URL, as the invited users (not personas).
5. Rehearse one restore per `docs/operations.md`.
6. Run `/security-review` on the final branch and triage findings before
   the first client touches it.

## Non-goals (deferred to ROADMAP.md Phase 2)

No multi-tenancy or org/team tables; no SSO/SAML/SCIM; no billing or
metering beyond the daily cap; no job-queue infrastructure beyond what
P0-1's timeout strategy needs; no SOC 2 tooling; no UI redesign.

## Working agreements

Make reasonable calls on minor decisions and note them; stop only for
destructive actions, spending/account decisions, or conflicts with this
spec. Report with evidence — test output, latency numbers, curl
transcripts — and never claim a "done when" you didn't verify.
