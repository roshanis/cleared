# Cleared redesign: landing page, personas, per-role workflows, real database

## Context

Cleared works as a demo, but four things keep it from reading as a real product:
there is no public landing page (unauthenticated visitors land straight on the
sign-in screen), the personas are thin labels rather than distinct experiences
(Sam is an "auditor" who is actually an admin), each role lands on a generic
page instead of a purpose-built home, and all data lives in a single JSON blob
(file locally, Upstash/memory on Vercel) that can silently clobber concurrent
writes — GOAL-HARDENING P0-2's known gap.

User decisions already made:
- **Database:** per-entity storage with two real drivers — SQLite locally
  (keeps the zero-config `npm run dev` promise) and Postgres in production
  (Neon / Vercel Postgres via env vars). Memory driver stays for tests.
- **Auditor:** becomes a real fourth role (read-only + export), not an admin.

Ground rules carried over from GOAL-HARDENING: demo mode stays first-class;
the existing test suite (50 tests + golden evals) is the floor; TDD for every
behavior change; Codex is working in this repo in parallel — read
`agents-build-log.md` before starting and log after each workstream.

## Workstream 1 — Redo the landing page

`src/app/page.tsx` is already a landing page (hero over a dimmed
`/landing-dashboard.png`, 01/02 workflow list, audiences, CTA band). Redo it:

- **Hero:** replace the wordmark-as-headline and ghosted-screenshot backdrop
  with a value-prop headline ("Compliance review, before it ships") on a
  clean accent-strong panel; primary CTA "Try the demo" → `/login`, secondary
  "See a real review" → in-page anchor. Two CTAs must not share one href.
- **Live product proof (the centerpiece):** server-render the REAL review of
  `sampleDocument` (`src/lib/copy.ts`) through the actual pipeline —
  `runReview(sampleDocument.content, defaultRubricDraft, "heuristic")` is
  deterministic, offline, and test-guaranteed to fail with exact quotes —
  and display it with the real `ResultView` component. The pitch is the
  actual product output, not a screenshot.
- **How it works:** keep the 4-step Submit → Review → Decide → Audit story
  but redesign away the `01 /` mono-eyebrow scaffolding (numbered circles à
  la the submit form's `HowItWorksStep`; extract that into `ui.tsx`).
- **Personas:** each of the four cards links to `/login?as=<personaId>` and
  the login page highlights that card.
- Signed-in visitors: keep the current behavior (landing still renders with
  "Open Cleared" CTA to their role home) — cheap and lets users re-read the
  pitch.
- Drop `/landing-dashboard.png` usage; delete the `-mx-6 -mt-8` wrapper hacks
  by giving the landing route its own full-bleed layout treatment.

`/login` stays sign-in-focused (persona cards + access code); add the `?as=`
highlight and a link back to `/`.

## Workstream 2 — Personas and the auditor role

- Add `"auditor"` to the `Role` union (`src/lib/session.ts:5`); change Sam
  Osei (`session.ts:43-47`) from `admin` to `auditor` with an honest tagline.
- Authorization matrix after the change (TDD: add a role-matrix test):
  - `/queue` + `/dashboard` pages: `requireRole("officer", "admin")` →
    dashboard also admits `"auditor"`; queue stays officer/admin.
  - `/rubric` page + `api/rubric*` routes: admin only (unchanged).
  - `api/decisions`: rejects author today — must also reject auditor
    (change the check to allow only officer/admin).
  - `api/export`: rejects author today — auditor is implicitly allowed
    already; keep, add test.
  - `api/submissions` + `/submit` page: currently any session — restrict to
    author/admin (an auditor must not create documents).
  - New `/audit` page: officer/admin/auditor.
- `linksByRole` (`src/components/nav.tsx:6-23`) gains
  `auditor: [Documents, Audit log, Dashboard]`.
- Persona cards on /login get a one-line "what you'll see" per role.

## Workstream 3 — Login + per-role workflow homes

Root redirect (`src/app/page.tsx`) sends each role to a purpose-built home:

- **Author (Maya) → `/documents`** upgraded into a working board: status of
  each submission (verdict badge, decision, "action needed" flag when a fail
  awaits her fix), prominent Submit CTA, sample-document affordance for the
  empty state.
- **Officer (Devon) → `/queue`**: stays queue-first; add a queue-empty state
  that points to the dashboard, and decision context (rule descriptions are
  already in ResultView).
- **Admin (Priya) → `/dashboard`**: adds a "rubric health" card (live version,
  last gate result, draft pending?) linking to /rubric.
- **Auditor (Sam) → `/audit` (new page)**: chronological decision log —
  every decision with document, officer, note, rubric version, verdict —
  filterable by action, with the CSV export button. Read-only.

Routing mechanics: the `homeByRole` map lives in `src/app/page.tsx:5-9`
(author→/submit today). Move it into `src/lib/session.ts` as the single
role→home source, change author→/documents, add auditor→/audit, and use it
from both the landing CTA and the post-login redirect. Login's
`router.push("/")` flow needs no client changes.

## Workstream 4 — Per-entity database (SQLite local / Postgres prod)

The compatibility contract: **every exported signature in `src/lib/store.ts`
stays identical** (including `addDecision`/`claimRunForReview` result unions
and `getDb(): Promise<Db>` full-snapshot reads), so no page, API route,
`metrics.ts`, `access.ts`, `seed.ts`, or `store.test.ts` changes. Only
store.ts internals are rewritten onto a driver layer.

**New files:**
- `src/lib/db/driver.ts` — `StoreDriver` (init / snapshot / transact) + `Tx`
  per-entity primitives (getDocument, nextVersionNumber, insertRun, claimRun,
  getDecisionByRunId, insertDecision, …), `UniqueViolationError`, shared
  snake_case→camelCase row mappers with JSON parse/stringify.
- `src/lib/db/memory.ts` — test driver; rollback via structuredClone.
- `src/lib/db/sqlite.ts` — built-in `node:sqlite` (Node 26 locally; zero
  install, no `serverExternalPackages` needed), file `.data/app.db`, WAL +
  busy_timeout, `BEGIN IMMEDIATE` transactions serialized in-process.
  Fallback if `node:sqlite` misbehaves: `better-sqlite3` (same sync shape).
- `src/lib/db/postgres.ts` — `pg` Pool (max 3, memoized on globalThis),
  pooled Neon/Vercel-Postgres URL, interactive transactions per request.
- `src/lib/db/index.ts` — selection: `DATABASE_URL || POSTGRES_URL` →
  postgres; `NODE_ENV=test` → memory; `VERCEL` without DB → memory (keeps
  the dashboard's honest ephemeral-storage banner); else sqlite.

**Schema:** 5 tables (documents, versions, rubrics, runs, decisions), TEXT
ids/ISO timestamps (app compares lexicographically), JSON blobs as TEXT
(result, overrides, criteria, goldenGate), `UNIQUE(document_id, number)` on
versions, `UNIQUE(run_id)` on decisions (the duplicate-decision guard),
`idx_runs_version_created`. DDL runs as an idempotent embedded bootstrap in
`init()` plus a `meta(schema_version)` row — no migration runner at this
scale.

**Atomicity:** domain ops become `transact()` units of work; the two
dialect-sensitive spots live in drivers — `claimRun` is
`UPDATE … SET status='reviewing' WHERE id=$1 AND status IN ('queued','error')
RETURNING *` (exactly one winner under concurrency), and duplicate decisions
are caught by the unique index → normalized `UniqueViolationError` → existing
`{status:"duplicate"}`. Seeding: `seedInto` stays untouched; first boot
builds a Db in memory then bulk-inserts in one transaction (seed races roll
back harmlessly). No `.data/db.json` migration — document reseed; retire the
Upstash blob driver and dependency.

**TDD order:** (1) driver contract tests (`src/lib/db/driver.test.ts`,
parameterized over drivers: CRUD round-trips, claim transition matrix,
unique-violation mapping, rollback-on-throw) red against a stub; (2) memory
then sqlite drivers green; (3) rewrite store.ts internals — gate:
`store.test.ts` passes **unmodified**; (4) new
`src/lib/store.concurrency.test.ts`: two parallel `createSubmission`s both
persist, submission concurrent with decision both persist, double-decision
race yields exactly one `created` (runs on memory + sqlite; Postgres pass is
`describe.skipIf(!process.env.DATABASE_URL)`); (5) postgres driver +
`serverExternalPackages: ["pg"]`; (6) README/env docs.

**Needs from operator:** a Neon/Vercel Postgres `DATABASE_URL` to exercise
the production driver; everything up to that wall works locally.

## Execution order & coordination

1. WS2 personas/auditor role (small, unblocks workflows)
2. WS3 per-role homes incl. new `/audit` page
3. WS1 landing-page redo + login polish
4. WS4 database layer (contracts preserved; safest last)

Codex works in this repo in parallel: read `agents-build-log.md` before each
workstream, append an entry after each, and re-read any file just before
editing it.

## Verification

Per workstream: new tests written first and failing, then green; full suite
(50+ floor) + `tsc --noEmit` + `next build` before moving on; build-log entry.

Final end-to-end (production server, `DEMO_AUTH=1`, heuristic mode — no
external calls):
- Unauthenticated `/` shows the new landing with the live sample review
  rendered by the real pipeline; CTAs go to `/login` and the anchor.
- Sign in as each of the four personas → lands on the right home
  (author `/documents` board, officer `/queue`, admin `/dashboard`,
  auditor `/audit`); nav shows the right links; auditor gets 403/redirect on
  submit, decide, and rubric routes (asserted by tests too).
- Full loop on SQLite: Maya submits sample → fail with quotes → Devon decides
  → Sam sees it in `/audit` and exports CSV; restart the server and confirm
  the data survived (durability proof the JSON-blob memory mode never had).
- `npm run eval` still green; concurrency test green on sqlite.
