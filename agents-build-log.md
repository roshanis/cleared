# Agents Build Log

## [AGENT: Claude] 2026-07-04
### Action: Initial scaffold of the compliance-review agent starter (eve target)
### Files changed:
- package.json, tsconfig.json, .gitignore, .env.example, README.md
- src/schema.ts, src/agent.config.ts
- src/prompts/{orchestrator,reviewer-policy,reviewer-risk,rubric}.md
- evals/grade.ts, evals/grade.test.ts
- evals/golden/{001-compliant-review-notice,002-guaranteed-returns-pitch,003-unsubstantiated-comparison}/
### Diff summary:
Framework-portable core (rubric, orchestrator + two reviewer subagent prompts,
zod output schema, golden set, pure grading harness with vitest coverage) plus
a thin, clearly-marked eve wiring layer. eve's exact API was not verifiable
offline (post-cutoff release, web access declined this session) — verification
points are listed in README.md.
### Recommendations / Next steps:
1. Install eve per Vercel docs (verify package name) and map agent.config.ts onto its API
2. Replace the template rubric criteria with the real policy
3. Grow the golden set with sanitized real documents
4. git init + first commit (repo is not yet under version control)

## [AGENT: Claude] 2026-07-04
### Action: Wrote GOAL.md — full product spec / goal prompt for building the Cleared web app
### Files changed: GOAL.md
### Diff summary: Persona-driven spec (author, officer, admin, auditor), feature scope, concrete design direction, gradeable definition of done, explicit non-goals. Anchored to existing agent core (agent.config.ts, schema, prompts, evals) as source of truth.
### Recommendations / Next steps: paste GOAL.md into a coding agent session to build the app; review personas/design section first and adjust to taste

## [AGENT: Claude] 2026-07-04
### Action: Built the Cleared web app end-to-end per GOAL.md
### Files changed:
- App: src/app/** (login, submit, documents, documents/[id], queue, rubric, dashboard + 10 API routes), src/components/**
- Agent pipeline: src/agent/{run,merge,verdict,heuristic,model-reviewer}.ts (+ tests)
- Platform: src/lib/{store,session,token,seed,metrics,highlight,csv,rubric}.ts (+ tests), evals/{run.ts,pipeline.test.ts}
- Config: package.json (Next 15/React 19/AI SDK/Tailwind 4), next.config.ts, vitest.config.ts, tsconfig.json, globals.css
- Docs: README.md rewritten, .env.example
### Diff summary:
Full four-persona product: submit w/ live progress + inline quote highlights,
review queue w/ per-finding overrides + mandatory decision notes, versioned
rubric editor with golden-set publish gate, dashboard + audit CSV export.
Pipeline = 2 reviewer subagents (model via AI SDK claude-opus-4-8, or
deterministic heuristic in demo mode) + orchestration in code. Storage:
file/Upstash/memory drivers, auto-seeded. Demo persona auth w/ signed cookies.
### Verification:
40 vitest tests pass (incl. golden set through the pipeline); tsc clean;
next build succeeds (18 routes); full persona flows exercised against a
running production server via curl: submit→fail w/ 5 findings→Devon reject
(dup 409, author 403)→resubmit v2 pass w/ diff chips; rubric draft→publish
blocked pre-gate (409)→gate caught intentional regression→publish; CSV export
correct; npm run eval passes.
### Decisions / deviations from GOAL.md:
- eve runtime not used: docs unreachable this session (post-cutoff release),
  so the pipeline runs directly on the Vercel AI SDK; agent definition kept
  portable. Migration path documented in README.
- Auth is demo-persona sign-in (signed cookies + optional access code), per
  GOAL's "simple Vercel-friendly" allowance; swap-in point documented.
- vercel deploy itself not run (needs the user's Vercel login) — build +
  runtime verified locally instead.
### Recommendations / Next steps:
1. `vercel deploy` + set AUTH_SECRET (+ ANTHROPIC_API_KEY, Upstash pair)
2. git init + first commit
3. Replace template rubric with the real policy; grow the golden set

## [AGENT: Claude] 2026-07-04
### Action: Wrote GOAL-HARDENING.md — follow-up goal prompt targeting the build's known blindspots
### Files changed: GOAL-HARDENING.md
### Diff summary: Six prioritized workstreams (P0: unexercised model path + function timeouts, storage durability/concurrency, real auth; P1: adversarial golden cases + honest publish gate, fuzzy quote matching, cost/rate limits), each with operator prerequisites and gradeable done-when criteria; operator checklist for deploy/provisioning/eve decision; ground rules preserving the zero-config demo path and the existing 40-test floor.
### Recommendations / Next steps: provision the operator items (API key, store, OAuth app), then hand GOAL-HARDENING.md to a fresh agent session

## [AGENT: Codex] 2026-07-04 13:05:22 CDT
### Action: Repaired dependency tree after `npm audit fix --force` downgraded Next
### Files changed:
- package.json
- package-lock.json
- package.json.bak
- package-lock.json.bak
- agents-build-log.md
### Diff summary:
Restored the app-compatible dependency ranges for Next/App Router and AI SDK
(`next` back to the 15.x line, `ai` back to 5.x, `@ai-sdk/anthropic` back to
2.x), then regenerated the lockfile with `npm install`. Created `.bak`
backups first because the directory is not a Git repo.
### Recommendations / Next steps:
Do not run `npm audit fix --force` on this project; it can choose breaking
framework downgrades/upgrades. Treat the remaining audit advisories as a
separate dependency-upgrade task and verify with typecheck, tests, and build.

## [AGENT: Codex] 2026-07-04 13:38:11 CDT
### Action: Improved the Cleared web UI across core workflow and admin screens
### Files changed:
- src/app/globals.css
- src/components/ui.tsx
- src/components/nav.tsx
- src/components/nav-links.tsx
- src/components/submit-form.tsx
- src/components/result-view.tsx
- src/components/decision-panel.tsx
- src/app/documents/page.tsx
- src/app/documents/[id]/page.tsx
- src/app/queue/page.tsx
- src/components/rubric-editor.tsx
- src/app/rubric/page.tsx
- src/app/dashboard/page.tsx
- agents-build-log.md
### Diff summary:
Added shared UI primitives for badges, table shells, consistent form controls,
and tighter button/card treatment; polished submit/review/decision surfaces;
made list tables responsive; improved document detail metadata and audit
history; redesigned the rubric editor/gate results; upgraded dashboard metric
cards; fixed authenticated nav overflow on narrow screens. Created file
backups under `.codex-backups/ui-20260704-132813` before edits because the
directory is not a Git repo.
### Verification:
`npm run typecheck` passed; `npm test` passed (45 tests); `npm run build`
passed (18 routes). Local browser checks on `http://localhost:3001` covered
dashboard, queue, documents, document detail, rubric, and submit at desktop
width with no console errors or page-level horizontal overflow. A 390px-wide
browser check initially found nav overflow; after the nav fix, the same routes
reported no page-level horizontal overflow. Post-check local preview is running
via `npm run dev -- -p 3001` in a detached `screen` session named
`eveagents-ui`; `next start` on the same port returned a Next runtime loader
500 in this environment despite the successful build, so the live local preview
uses the dev server.
### Recommendations / Next steps:
Review the running app at `http://localhost:3001`. If this moves toward a real
release, the next useful UI pass is a focused mobile navigation pattern and
screenshots for README/deploy QA.

## [AGENT: Codex] 2026-07-04 13:54:19 CDT
### Action: Added a product landing page and prepared the directory for Git
### Files changed:
- src/app/page.tsx
- src/components/nav.tsx
- public/landing-dashboard.png
- .gitignore
- agents-build-log.md
### Diff summary:
Replaced the root signed-in redirect with a public Cleared landing page that
describes the product, shows a real dashboard screenshot in the hero, explains
the submit/review/decide/audit workflow, and links into the persona demo. Added
a signed-out nav CTA. Expanded `.gitignore` so generated build output, demo
data, Codex logs/backups, TypeScript build info, and backup files stay out of
the initial Git history.
### Verification:
Landing page work passed `npm run typecheck`, `npm test` (45 tests), and
`npm run build` (18 routes). Browser checks confirmed `/` rendered the product
hero image, had no page-level horizontal overflow at desktop or 390px width,
and left the next section visible in the first viewport. A local Next cache
collision appeared after mixing `next dev` and `next build`; no generated cache
files were deleted without explicit approval.
### Recommendations / Next steps:
Initialize Git, inspect tracked/ignored files carefully, then create the first
commit without adding generated caches, local demo storage, logs, or secrets.

## [AGENT: Codex] 2026-07-04 13:56:47 CDT
### Action: Verified the local UI is running
### Files changed:
- agents-build-log.md
### Diff summary:
Checked active local ports and confirmed a Next.js server for Cleared is
already listening on port 3000. Verified `/` returns the Cleared landing page
and `/login` returns the persona sign-in UI.
### Verification:
`curl -i http://localhost:3000/` returned HTTP 200 with the Cleared landing
page content. `curl -i http://localhost:3000/login` returned HTTP 200 with the
persona sign-in content.
### Recommendations / Next steps:
Open `http://localhost:3000` to use the UI.

## [AGENT: Codex] 2026-07-04 14:15:57 CDT
### Action: Redid the Cleared UI using the Impeccable design guidance
### Files changed:
- PRODUCT.md
- DESIGN.md
- src/app/{page,layout,globals,login,submit,dashboard,queue,documents,rubric}/
- src/app/documents/[id]/page.tsx
- src/components/{ui,nav,nav-links,login-cards,submit-form,result-view,decision-panel,rubric-editor}.tsx
- agents-build-log.md
### Diff summary:
Added Impeccable-style product and design context files; tightened the shared
visual system around a more restrained operational register; redesigned the
landing page with real product evidence and a ruled workflow narrative; refined
login, submit, result, decision, dashboard, table, document detail, and rubric
editing surfaces to reduce generic card repetition, improve hierarchy, and keep
state/controls consistent.
### Verification:
`npm run typecheck` passed. `npm test` passed (45 tests). `npm run build`
passed (18 routes). Browser QA passed on a clean preview at
`http://localhost:3004`: public landing desktop/mobile and authenticated
mobile `/dashboard`, `/queue`, `/documents`, `/rubric`, and `/submit` routes
showed no page-level horizontal overflow and no console errors. Landing
screenshot asset loaded and stayed constrained on mobile.
### Recommendations / Next steps:
Use `http://localhost:3004` for the running updated UI. It runs from a
temporary clean copy at `/tmp/eveagents-ui.7MpikJ` with `node_modules`
symlinked back to this repo. The normal Webpack dev/preview path and a
Turbopack attempt still hit generated `.next` cache/runtime collisions
(`Cannot find module './611.js'` and a React client manifest error); no cache
files were deleted without explicit approval.

## [AGENT: Codex] 2026-07-04 14:16:48 CDT
### Action: Summarized the product purpose and usage model for "Cleared"
### Files changed:
- agents-build-log.md
### Diff summary:
Read README.md, PRODUCT.md, DESIGN.md, GOAL.md, and core app pages to ground a
plain-language product explanation in the current implementation.
### Recommendations / Next steps:
Use the summary as product positioning copy, onboarding copy, or README intro
language; no code changes were made.

## [AGENT: Codex] 2026-07-04 14:27:01 CDT
### Action: Created local OpenAI environment placeholder file
### Files changed:
- .env
- agents-build-log.md
### Diff summary:
Added a local, git-ignored `.env` with blank `OPENAI_API_KEY` and
`OPENAI_MODEL` placeholders for OpenAI LLM API calls. No secret values were
added or logged.
### Recommendations / Next steps:
Fill `OPENAI_API_KEY` locally when you are ready to make real OpenAI API calls.

## [AGENT: Codex] 2026-07-04 14:30:04 CDT
### Action: Prepared repository for GitHub push to roshanis/cleared
### Files changed:
- agents-build-log.md
### Diff summary:
Verified the working tree before publishing, confirmed `.env` remains ignored,
checked the target GitHub repository, and prepared the current UI/docs updates
for a normal `main` branch push without force-pushing.
### Verification:
`git diff --check` passed. A quick secret-pattern scan of commit candidates
returned no matches. `npm test` passed (45 tests). `npm run build` passed (18
routes). An initial `npm run typecheck` failed on stale generated `.next/types`
references, then passed after `npm run build` regenerated the Next type files.
### Recommendations / Next steps:
Push `main` to `https://github.com/roshanis/cleared.git` after committing the
current non-ignored project files.

## [AGENT: Claude] 2026-07-04 17:10 CDT
### Action: UI redesign pass (impeccable design system) + two fixes found during verification
### Files changed:
- src/app/globals.css, src/components/ui.tsx (initial versions; Codex refined tokens/components after)
- src/components/{nav,nav-links,login-cards,result-view,decision-panel}.tsx
- src/app/{login,dashboard,documents,queue}/page.tsx
- src/components/ui.test.ts (new), src/agent/run.test.ts (new)
- src/lib/store.test.ts (stale assertion fix), src/agent/run.ts (one-line fix)
### Diff summary:
Applied pbakaus/impeccable product-register guidance per user request: removed
side-stripe borders, uppercase-tracked eyebrows, and identical metric-card
grids; added shared button/input vocabulary, active nav state, verdict badges
with status dots, criterion chips, stat strip dashboard, split login layout,
reduced-motion support, tokenized SVG colors. Codex extended the pass to the
remaining files (submit-form, documents/[id], rubric) and the token layer —
kept all of it.
Fix 1: store.test.ts asserted addDecision's old direct-return shape; updated
to the new `{status, decision}` contract (matches api/decisions consumer).
Fix 2: run.ts MODEL_ID used `?? "gpt-5.4-mini"`, which passes through the
empty string from .env's blank OPENAI_MODEL — the API was asked for model ''.
Changed to `||` with a regression test.
### Verification:
47/47 tests pass; tsc clean; next build 19 routes. Production server walked
via curl in heuristic demo mode (OPENAI_API_KEY pinned empty — no external
calls): all persona pages 200; submit → fail verdict with C2/C4 exact quotes;
document page renders findings/highlights/history; officer decision recorded
and queue cleared; all new design tokens confirmed present in compiled CSS.
Note: verification wrote two "UI verify" documents into local .data/db.json
(left in place — deletion needs human approval per house rules).
### Recommendations / Next steps:
1. Model mode is still unexercised end-to-end (GOAL-HARDENING P0-1): the
   real OPENAI_API_KEY in .env is live, so a real submit will now call
   OpenAI with gpt-5.4-mini — operator should confirm model id + budget.
2. Visual QA in a browser (screenshots at mobile/desktop breakpoints) is the
   remaining polish step; curl can't judge aesthetics.

## [AGENT: Claude] 2026-07-04 18:55 CDT
### Action: Comprehension pass — make the product self-explanatory (/goal)
### Files changed:
- src/lib/copy.ts (new), src/lib/copy.test.ts (new)
- src/components/result-view.tsx, src/components/submit-form.tsx
- src/app/submit/page.tsx, src/app/documents/[id]/page.tsx
### Diff summary:
New src/lib/copy.ts: verdictNextStep() (plain-language "what happens next"
per verdict) and sampleDocument (one-click demo content; its test runs it
through the real heuristic pipeline so it is guaranteed to fail with
exact-quote C2/C4 findings). ResultView takes optional rubric criteria and
renders "Rule C2: <description>" under each finding plus the next-step line
under the verdict; submit page passes the published rubric's criteria,
document page passes the criteria of the rubric version the run was judged
with. Submit form gains a 3-step "how it works" strip and a "Try a sample
document" button (both only on a fresh, empty form).
### Verification:
50/50 tests; tsc clean; next build. Live server walk (heuristic mode, no
external calls): submit page shows intro strip + sample button; sample
submitted via API fails with C2/C4/C1; document page renders rule
descriptions and the officer-review explainer (confirmed after stripping
React SSR comment nodes).
### Recommendations / Next steps:
Officer-side comprehension (decision panel rule descriptions) left out to
keep scope tight — ResultView above the panel now carries them.

## [AGENT: Claude] 2026-07-05 10:30 CDT
### Action: Redesign branch checkpoint — WS1-3 done, WS4 saved as WIP
### Files changed: (branch redesign-ui-db, commits 126cede..04c990e)
### Diff summary:
Approved plan in PLAN-REDESIGN.md. Landed and verified: WS2 auditor role +
tested authorization matrix (src/lib/roles.ts, 28 tests); WS3 per-role homes
(homeByRole in session.ts, author status board, admin rubric-health card,
new /audit decision log, 15 tests); WS1 landing redo (live pipeline-rendered
sample review via real ResultView, persona deep-links to /login?as=).
WS4 (SQLite/Postgres per-entity storage) was stopped by the user mid-TDD and
committed as WIP 04c990e: driver interface + memory driver + 28 contract
tests exist; sqlite.ts is a stub (its 14 contract tests are red by design);
store.ts untouched — app still runs on the JSON-blob store and the original
93 tests pass. tsc clean at every commit.
### Recommendations / Next steps:
Resume WS4 from PLAN-REDESIGN.md step 4 (implement sqlite.ts), then store.ts
rewrite + concurrency tests + postgres driver + cleanup. Do not merge the
branch before WS4 finishes or the red contract tests are removed.

## [AGENT: Claude] 2026-07-05 10:35 CDT
### Action: Merged redesign-ui-db into main (fast-forward)
### Diff summary:
WS1-3 of PLAN-REDESIGN.md are now on main: auditor role + tested auth
matrix, per-role homes incl. /audit, landing redo with live pipeline proof.
The WS4 WIP (per-entity DB drivers) was reverted before merge to keep main
green — the work is preserved in history at 04c990e (revert 829153f);
resume by reverting the revert or cherry-picking, then continue from
PLAN-REDESIGN.md WS4 step 4.
### Verification: 93/93 tests, tsc clean, next build — on main post-merge.

## [AGENT: Codex] 2026-07-05 14:15 CDT
### Action: Published merged main to origin
### Files changed:
- agents-build-log.md
### Diff summary:
Pushed explicit local main ref to origin/main after Fable's local merge:
origin/main advanced from 3987637 to a01fd08. The active checkout had already
moved to redesign-ui-db with uncommitted WS4 database work, so Codex did not
switch branches, stash, revert, or touch that work; only git push origin main
was published.
### Verification:
git diff --check origin/main..main clean before push; npm test passed
121/121, npm run typecheck passed, and npm run build passed in the active
redesign-ui-db checkout. Remote verification after push confirmed
origin/main at a01fd08f7977af9ba7e2b03b5353383b4ac203bd.
### Recommendations / Next steps:
Current checkout remains redesign-ui-db with existing uncommitted WS4 changes
in src/lib/db/sqlite.ts plus untracked src/lib/db/index.ts and
src/lib/db/postgres.ts. Treat that as separate in-progress WS4 work.

## [AGENT: Claude] 2026-07-05 14:35 CDT
### Action: WS4 complete — per-entity SQLite/Postgres storage; redesign branch finished
### Files changed: src/lib/db/{driver,memory,sqlite,postgres,index}.ts,
src/lib/store.ts (internals only), store.concurrency.test.ts, next.config.ts,
.env.example, README.md, package.json (pg added, @upstash/redis removed)
### Diff summary:
store.ts rewritten onto a driver layer with every exported signature
preserved (store.test.ts passes unmodified). SQLite via built-in node:sqlite
at .data/app.db locally; Postgres via pg pool when DATABASE_URL/POSTGRES_URL
set; memory for tests and Vercel-without-DB. Real concurrency guards:
atomic claimRun UPDATE, UNIQUE(run_id) on decisions, UNIQUE(document_id,
number) on versions. 28 driver contract tests + 9 concurrency race tests.
### Verification (all on branch redesign-ui-db, commit 413a617):
130 tests: 127 pass, 3 postgres cases skip without DATABASE_URL; tsc clean;
next build 20 routes; seed idempotent across two runs. Live E2E walk on
SQLite: landing renders real pipeline review; four personas land on correct
homes; auditor blocked from submit (307), submissions API (403), decisions
API (403); Maya sample submit → fail w/ 3 findings → Devon reject → Sam sees
note in /audit + CSV export → SERVER RESTARTED → decision and document
survived (durability the blob store never had). npm run eval: all golden
cases pass.
### Recommendations / Next steps:
Branch ready for Codex to merge (user's call). Postgres driver is
contract-covered but unexercised against a live DB — set DATABASE_URL and
run the suite once after provisioning (operator step). Legacy .data/db.json
can be deleted.

## [AGENT: Claude] 2026-07-05 15:05 CDT
### Action: Vercel deploy-readiness audit + fixes (branch redesign-ui-db)
### Diff summary:
Fixed stale Upstash references (dashboard banner, README deploy section) to
DATABASE_URL/Postgres; added auditor to README role list; pinned engines
node>=22.5; documented maxDuration plan-tier behavior. Simulated both
deployed configurations with VERCEL=1 (memory driver): bare deploy fails
closed; configured demo deploy passes the full walk. 127 pass / 3 pg-skip,
tsc clean, build 20 routes.
### Recommendations / Next steps:
Operator: merge+push via Codex, then in Vercel set DEMO_AUTH=1, AUTH_SECRET,
APP_ACCESS_CODE (sign-in), DATABASE_URL pooled Postgres (durability),
OPENAI_API_KEY (model reviews). Run suite once with DATABASE_URL to exercise
the 3 skipped postgres tests.

## [AGENT: Claude (sonnet subagent)] 2026-07-05 15:30 CDT
### Action: Merged branch redesign-ui-db into main and pushed to origin
### Files changed:
- agents-build-log.md (this entry)
### Diff summary:
Fast-forward merge of redesign-ui-db (6d4f7b8) into main (was a01fd08).
Brought in WS4 per-entity SQLite/Postgres storage layer, 28 driver contract
tests, 9 concurrency tests, and all WS1-3 changes that were already on the
branch (auditor role, per-role homes, landing redesign). No merge commit was
needed; origin/main advanced to 6d4f7b8.
### Verification:
- npm test: 127 passed, 3 skipped (postgres-skip without DATABASE_URL) — matches expected count
- npx tsc --noEmit: clean (no output)
- npm run build: compiled successfully, 20 routes generated
### Recommendations / Next steps:
Provision DATABASE_URL (pooled Postgres) and run the suite once to exercise
the 3 skipped postgres tests. Set DEMO_AUTH=1, AUTH_SECRET, APP_ACCESS_CODE,
and OPENAI_API_KEY before Vercel deploy.

## [AGENT: Claude (sonnet subagent)] 2026-07-05 19:45 CDT
### Action: Merged landing design elevation (redesign-ui-db 1cade0d) into main and pushed to origin
### Files changed:
- agents-build-log.md (this entry)
### Diff summary:
Fast-forward merge of redesign-ui-db (1cade0d) into main (was 452e894).
Brought in the landing page full-viewport drenched hero, staged live review
panel, and mirrored closer section — the final UI elevation commit on the
branch (src/app/globals.css, src/app/login/page.tsx, src/app/page.tsx).
No merge commit needed.
### Verification:
- npm test: 127 passed, 3 skipped (postgres-skip without DATABASE_URL) — matches expected count
- npx tsc --noEmit: clean (no output)
- npm run build: compiled successfully, 20 routes; no lint/type errors
### Recommendations / Next steps:
Provision DATABASE_URL (pooled Postgres) and run the suite once to exercise
the 3 skipped postgres tests. Set DEMO_AUTH=1, AUTH_SECRET, APP_ACCESS_CODE,
and OPENAI_API_KEY before Vercel deploy.

## [AGENT: Claude (sonnet subagent)] 2026-07-05 19:51 CDT
### Action: Merged og:image card (redesign-ui-db 02013dd) into main and pushed to origin
### Files changed:
- src/app/opengraph-image.tsx (new — ImageResponse-based OG card)
- src/app/layout.tsx (twitter:card set to summary_large_image)
- agents-build-log.md (this entry)
### Diff summary:
Fast-forward merge of redesign-ui-db (02013dd) into main (was ea72396).
Adds the generated og:image endpoint via Next.js ImageResponse and updates
layout metadata so Twitter/OG scrapers use summary_large_image. No merge
commit needed (1-commit fast-forward).
### Verification:
- npm test: 127 passed, 3 skipped (postgres-skip without DATABASE_URL) — matches expected count
- npx tsc --noEmit: clean (no output)
- npm run build: compiled successfully, 20 routes including /opengraph-image; no lint/type errors; 1 non-blocking metadataBase warning (pre-existing)
### Recommendations / Next steps:
Set metadataBase in src/app/layout.tsx metadata export to resolve the
non-blocking OG URL warning before Vercel deploy. Provision DATABASE_URL
to exercise the 3 skipped postgres tests.

## [AGENT: Claude] 2026-07-06T15:00Z
### Action: GOAL-AGENTS.md executed — jurisdiction review, LLM judge, fix-it agent
### Files changed: (branch redesign-ui-db, commits 98d80a1, 7e74a06, e905146)
### Diff summary:
WS-A: criteria carry optional jurisdictions tags (US/UK/EU); rubric sliced
per submission's target markets; code partitions findings into per-market
verdicts (overall = worst) with zero extra model calls; C6/C7 demo criteria,
market chips, CSV columns, schema-v2 runs migration, 2 new golden cases.
Also fixed a first-boot bug: mutations on a fresh store now seed (all ops
share a ready-gated transact; regression test).
WS-B: judge agent post-merge with deterministic escalate-only gating —
challenges demote findings to low confidence, disagreement always lands at
needs_human_review, never fail→pass/pass→fail; demo judge is a real quote
verifier; endorsed reviews adopt the judge rationale as summary.
WS-C: opt-in fixer drafting one fix per finding (replace/insert), applied
by deterministic quote location that refuses to guess; preview + load-into-
resubmit via sessionStorage; nothing auto-submitted.
### Verification:
168 tests (165 pass + 3 pg-skip), tsc clean, build 21 routes, all 5 golden
cases pass via npm run eval. Live demo-mode E2E: sample submit for US+UK
fails with C2/C4/C1/C6 → judge endorses → 4 fixes drafted, 0 unlocated →
resubmit passes both markets, judge agreed, diff chips show resolved.
Officer blocked from fixes API (403). The WS-A subagent died on a session
limit after writing its failing test suite; implementation completed
directly against that contract.
### Recommendations / Next steps:
Model-mode paths for judge/fixer are wired but unexercised (operator: run
one real submit with OPENAI_API_KEY). Latency now 3 sequential model calls
worst case (reviewers ∥, judge, fixer opt-in) — measure before lowering
maxDuration.

## [AGENT: Claude (sonnet subagent)] 2026-07-06T15:10Z
### Action: Merged GOAL-AGENTS work (jurisdictions, judge, fixer) from redesign-ui-db into main and pushed to origin
### Files changed:
- agents-build-log.md (this entry)
- 43 files fast-forwarded from redesign-ui-db (edebd16): GOAL-AGENTS.md,
  src/agent/{fixer,judge}.ts + tests, src/agent/jurisdiction.test.ts,
  src/agent/heuristic.ts, src/agent/run.ts, src/agent/verdict.ts,
  src/lib/{patch,rubric,store}.ts + tests, src/lib/store.first-boot.test.ts,
  src/lib/db/{driver,sqlite,postgres}.ts, src/prompts/{fixer,judge,rubric}.md,
  src/schema.ts, src/app/api/runs/[id]/fixes/route.ts,
  src/components/{fix-draft-panel,result-view,rubric-editor,submit-form,decision-panel}.tsx,
  src/app/documents/[id]/page.tsx, src/app/submit/page.tsx,
  evals/golden/{004-uk-missing-capital-at-risk,005-multimarket-clean}/
### Diff summary:
Fast-forward merge of redesign-ui-db (edebd16) into main (was d0492b8).
Brings in all three GOAL-AGENTS workstreams: WS-A (jurisdiction-aware rubric
slicing, per-market verdicts, C6/C7 criteria, 2 new golden cases), WS-B
(LLM judge with escalate-only gating, real quote verifier in demo mode),
and WS-C (opt-in fix-it agent with deterministic quote location and
sessionStorage-backed resubmit preview). Also includes the first-boot
seed-on-mutation fix and its regression test.
### Verification:
- npm test: 165 passed, 3 skipped (postgres-skip without DATABASE_URL) — matches expected 168 total
- npx tsc --noEmit: clean (no output)
- npm run build: compiled successfully, 21 routes; 1 non-blocking metadataBase warning (pre-existing)
### Recommendations / Next steps:
Exercise model-mode judge/fixer with a real OPENAI_API_KEY. Provision
DATABASE_URL (pooled Postgres) to exercise the 3 skipped postgres tests.
Measure latency under 3 sequential model calls before adjusting maxDuration.

## [AGENT: Claude] 2026-07-07T00:30Z
### Action: GOAL-DEMO executed on branch demo-public — public demo gate, persona switcher, guided demo
### Files changed: GOAL-DEMO.md (spec), src/lib/demo.ts (new), src/lib/session.ts, src/lib/session.access.test.ts (new), src/agent/run.ts, src/agent/run.test.ts, src/app/login/page.tsx, src/app/api/auth/switch/route.ts (new), src/components/demo-strip.tsx (new), src/components/demo-banner.tsx (new), src/app/layout.tsx, .env.example, README.md
### Diff summary:
- WS-1: DEMO_PUBLIC=1 opt-in — accessCodeOk() skips the code (public + demo auth only;
  DEMO_AUTH=0 still wins); activeReviewer() forced to heuristic under public demo so
  visitors cannot spend the operator's API budget; login page hides the code field and
  shows a shared-demo note. publicDemoEnabled() lives in dependency-free src/lib/demo.ts.
- WS-2: POST /api/auth/switch (same-origin, requires an existing session — never mints
  one, 401 without) built on new pure helper switchTarget(); DemoStrip/DemoBanner render
  a quiet utility bar under the nav: current seat + one-click switch to the other three.
- WS-3: per-role "try this" hint in the strip; .env.example + README public-demo recipe
  (ephemeral storage recommended for public links).
- TDD: 10 new tests red-first (accessCodeOk matrix, switchTarget, forced heuristic).
- Verification: 175 passed / 3 postgres-skipped, tsc clean, build 22 routes. Live E2E
  26/26 across three production servers: (A) public demo — no-code login, strip, submit
  → heuristic despite dummy key → fail → 4-seat hop → decision → audit + CSV, switch
  without session 401; (B) APP_ACCESS_CODE without DEMO_PUBLIC still 403s (fail-closed
  regression); (C) DEMO_AUTH=0 + DEMO_PUBLIC=1 → 403.
### Recommendations / Next steps:
Merge demo-public to main when approved. Operator: on Vercel set DEMO_PUBLIC=1 (keep
DEMO_AUTH=1, AUTH_SECRET; APP_ACCESS_CODE may stay or go), leave DATABASE_URL unset for
a self-resetting public demo, redeploy, walk all four seats in a private window.

## [AGENT: Claude] 2026-07-07T00:56Z
### Action: Verified fast-forward merge of demo-public (aa07074) into main
### Files changed: merge only — no new edits beyond this log entry
### Diff summary: GOAL-DEMO shipped to main — DEMO_PUBLIC gate (no-code persona sign-in, forced heuristic reviewer), /api/auth/switch + demo strip with per-role hints, docs. Verified on main: npm test 175 passed / 3 skipped; tsc clean; build 22 routes.
### Recommendations / Next steps: Operator sets DEMO_PUBLIC=1 on Vercel (keep DEMO_AUTH=1, AUTH_SECRET; leave DATABASE_URL unset for a self-resetting public demo) and redeploys.

## [AGENT: Claude] 2026-07-07T05:45Z
### Action: GOAL-SHOWTIME executed on branch showtime — demo script, big-screen type, review theater
### Files changed: GOAL-SHOWTIME.md (spec), DEMO-SCRIPT.md (new), src/components/review-theater.ts (new), src/components/review-theater.test.ts (new), src/components/submit-form.tsx, src/components/fix-draft-panel.tsx, src/components/result-view.tsx, src/components/ui.tsx, src/components/demo-banner.tsx
### Diff summary:
- WS-3 review theater: submit → verdict wait staged as the real pipeline (Document
  submitted → Policy reviewer → Risk reviewer → Judge verifying quotes), ~2.6s pacing in
  heuristic mode, stages ride real latency in model mode, reduced-motion skips the
  choreography (pure helpers TDD'd, 5 tests). Verdict lands with animate-rise; findings
  stagger in. FixDraftPanel now renders inline on a failed submit (runId threaded through)
  and "Draft fixes" is a primary button — the climax control.
- WS-2 big-screen type: VerdictBadge text-xs→text-sm, finding quotes and summary
  text-sm→15px/leading-7, demo strip 13px with min-h-7 switch buttons (nav wordmark
  text-2xl shipped separately on main).
- WS-1 DEMO-SCRIPT.md: three-act five-minute presenter runbook with exact control labels
  (verified against the components), prep checklist (warm instance, private window, never
  share deployment URLs), cold-start recovery line, US+UK "one more thing", Q&A answers.
- Verification: suite 180 passed / 3 skipped, tsc clean, build green. Rehearsal E2E 24/24
  against a production server: every scripted beat incl. sample fail with the read-aloud
  quote, Draft fixes → 0 unlocated → resubmit PASS, fixed doc US+UK → US pass/UK fail,
  Devon reject-with-note, Priya save-draft → golden gate pass, Sam audit log + CSV.
  (Script corrected during rehearsal: gate requires "Save as draft" first — now narrated
  as "Publish is disabled until the gate passes".)
### Recommendations / Next steps:
Merge showtime to main, deploy to production, walk the script on cleared-five.vercel.app.
Presenter should rehearse out loud twice.

## [AGENT: Claude] 2026-07-07T10:34:43Z
### Action: Verified fast-forward merge of showtime (43c7b70) into main
### Files changed: merge only — no new edits beyond this log entry
### Diff summary: GOAL-SHOWTIME shipped to main — DEMO-SCRIPT.md runbook, review theater (staged pipeline reveal, inline Draft fixes as primary), big-screen typography. Verified on main: npm test 180 passed / 3 skipped; tsc clean; build green.
### Recommendations / Next steps: Deploy to production (vercel --prod) and walk DEMO-SCRIPT.md on cleared-five.vercel.app.

## [AGENT: Claude] 2026-07-07T15:23Z
### Action: Wrote ROADMAP.md (go-live plan at 100/1,000/10,000 users) and GOAL-LIVE.md (executable spec for Phase 1)
### Files changed: ROADMAP.md (new), GOAL-LIVE.md (new)
### Diff summary:
- ROADMAP.md: three phases across cost, utilization, security, user management,
  teams, clients. Phase 1 (100 users): deployment-per-client, real IdP, users
  table, rate limits, backups — ~$100-250/mo. Phase 2 (1,000): multi-tenancy in
  the driver layer, teams, SSO/MFA, SOC 2 Type I, job queue with per-org budgets.
  Phase 3 (10,000): Type II, residency/BYO-key, durable-execution pipeline, fair
  scheduling. Key finding: model spend stays trivial at mini-tier (~$2-6 per 1K
  reviews); identity, tenancy, and trust artifacts gate each phase.
- GOAL-LIVE.md: Phase-1 spec in the GOAL-* convention. WS-1 executes open
  GOAL-HARDENING items by reference (P0-1, P0-3, P1-6 promoted to blocker,
  P1-4/5); WS-2 users-as-records (entity, invite-only, admin management,
  deactivation kills sessions, id-keyed attribution); WS-3 production refuses
  demo flags without explicit override + input caps; WS-4 ops runbooks
  (restore rehearsal, client-onboarding checklist, /api/health); WS-5
  utilization metrics on the admin dashboard.
### Recommendations / Next steps: Operator reviews ROADMAP.md assumptions
(model pricing, SOC 2 quotes), provisions OAuth app + OPENAI_API_KEY + Neon
PITR, then hands GOAL-LIVE.md to a fresh agent session. Docs-only change: no
tests affected.

## [AGENT: Claude] 2026-07-07T06:20Z
### Action: Live verification found and fixed the Vercel storage gap; Neon Postgres attached; full demo arc verified on production
### Files changed: README.md, .env.example (docs correction only — no code)
### Diff summary:
- Live smoke after the showtime deploy exposed an architectural gap: on Vercel each API
  route is a separate serverless function with isolated memory, so memory-mode
  submissions 404 at /api/runs/[id]/execute — the submit → review loop could never work
  on the deployed public demo. Local E2Es (one process) had masked it.
- Fix: Neon Postgres attached via the Vercel marketplace (resource neon-bistre-plank,
  DATABASE_URL/POSTGRES_URL injected for Production + Preview as sensitive values —
  not pullable locally by design). Production redeployed.
- Verified live on cleared-five.vercel.app: sample submit → fail with findings → Draft
  fixes (0 unlocated) → resubmit → PASS; fixed doc US+UK → US pass / UK fail; Devon
  reject-with-note; Sam audit log + CSV export. Every DEMO-SCRIPT.md beat works on prod.
- README/.env.example corrected: the earlier "leave DATABASE_URL unset, ephemeral is
  the feature" guidance was wrong on Vercel and is replaced with the function-isolation
  explanation.
### Recommendations / Next steps:
The 3 postgres-gated unit tests still skip locally (sensitive connection string not
pullable); the driver is proven live end-to-end. To run them, copy the connection
string from the Neon dashboard into a local DATABASE_URL for one test run. Note:
Preview and Production currently share the one Neon database — model-mode test
submissions from the preview bench will appear in public demo data (Neon branching
can split them later if it matters).

## [AGENT: Codex] 2026-07-07T15:49Z
### Action: Branded the hero, enriched demo seed data, and made rubric criteria explorable
### Files changed:
- src/app/page.tsx
- src/lib/seed.ts
- src/lib/seed.test.ts
- src/components/ui.tsx
- src/components/result-view.tsx
- src/components/submit-form.tsx
- agents-build-log.md
### Diff summary:
WS-A prepended "Cleared." to the landing hero line without changing the hero
structure. WS-B expanded the first-load demo seed to 9 Maya-authored
documents reviewed by the heuristic pipeline, with 4 Devon decisions across
approve/reject actions and 2 non-pass runs left undecided for the queue. WS-C
made finding criterion chips toggle rule descriptions with accessible button
state, while passive chips elsewhere remain spans, and added a collapsed
"What we check" criteria browser to the submit form.
### Verification:
- Targeted red/green seed test: initially failed on 1 decision, then passed
- npm test: 181 passed, 3 skipped (184 total)
- npx tsc --noEmit: clean (no output)
- npm run build: compiled successfully, 21 routes; metadataBase warning remains pre-existing
### Recommendations / Next steps:
No commit made. Existing untracked ROADMAP.md and GOAL-LIVE.md were left
untouched. Postgres-gated tests still skip locally without DATABASE_URL.

## [AGENT: Codex] 2026-07-08T01:18Z
### Action: Enabled capped live model reviews for the public demo
### Files changed:
- src/lib/demo.ts
- src/agent/run.ts
- src/agent/run.test.ts
- src/lib/model-budget.ts
- src/lib/model-budget.test.ts
- src/app/api/submissions/route.ts
- src/app/api/submissions/route.test.ts
- src/components/submit-form.tsx
- .env.example
- README.md
- agents-build-log.md
### Diff summary:
Added `DEMO_PUBLIC_MODEL=1` as the explicit public-demo model opt-in while
keeping the default public demo on the deterministic reviewer. Added a UTC-day
public model budget helper with defensive `DEMO_MODEL_DAILY_CAP` parsing and
wired `/api/submissions` to downgrade only capped public-demo submissions to
the heuristic reviewer. Added the post-submission UI note when the page
advertised model reviewers but the stored run used the deterministic reviewer.
Documented the public spend risk, daily cap, and OpenAI-side budget cap
recommendation.
### Verification:
- Red-first targeted tests failed for the new public model path / missing cap
  helper / under-cap route behavior, then passed after implementation.
- npm test: 192 passed, 3 skipped (195 total)
- npx tsc --noEmit: clean (no output)
- npm run build: compiled successfully, 22 routes; metadataBase warning remains pre-existing
### Recommendations / Next steps:
No commit made. Existing untracked ROADMAP.md and GOAL-LIVE.md were left
untouched. Public demo live models should still be paired with an OpenAI-side
budget cap before enabling `DEMO_PUBLIC_MODEL=1` in production.

## [AGENT: Codex] 2026-07-07T15:56Z
### Action: Added admin-only demo reset for persistent demo storage
### Files changed:
- src/app/api/admin/reset/route.ts
- src/app/dashboard/page.tsx
- src/components/reset-demo-data-button.tsx
- src/lib/db/driver.ts
- src/lib/db/memory.ts
- src/lib/db/postgres.ts
- src/lib/db/sqlite.ts
- src/lib/store.ts
- src/lib/store.test.ts
- agents-build-log.md
### Diff summary:
Added `POST /api/admin/reset` with same-origin, session, admin-role, and
demo-auth guards before a destructive reset is reachable. Added a driver
transaction primitive to clear all app-owned tables for memory, SQLite, and
Postgres, then reseed through the existing seed path. Added an unobtrusive
admin dashboard reset control with inline two-step confirmation and refresh on
success. Covered the store reset path with a memory-driver test that dirties
seed data and verifies the pristine seeded document/decision counts and rubric
version 1 restoration.
### Verification:
- Targeted TDD: `npm test -- src/lib/store.test.ts` failed first, then passed
- npm test: 182 passed, 3 skipped (185 total)
- npx tsc --noEmit: clean (no output)
- npm run build: compiled successfully, 22 routes; metadataBase warning remains pre-existing
### Recommendations / Next steps:
No commit made. Existing untracked ROADMAP.md and GOAL-LIVE.md were left
untouched. Postgres-gated tests still skip locally without DATABASE_URL.

## [AGENT: Codex] 2026-07-09T03:31Z
### Action: P0-1 provider-failure hardening for model-mode reviews
### Files changed:
- src/lib/review-error.ts
- src/lib/review-error.test.ts
- src/app/api/runs/[id]/execute/route.ts
- src/app/api/runs/[id]/execute/route.test.ts
- src/app/api/rubric/gate/route.ts
- src/app/api/rubric/gate/route.test.ts
- README.md
- agents-build-log.md
### Diff summary:
Added a shared model-provider error classifier for authentication failures,
429/rate limits, timeouts, refusals, malformed structured output, nested AI
SDK retry errors, and generic provider failures. The execute route now
persists sanitized messages as run status `error`; errored runs remain
retryable through the existing claim path. The rubric golden gate returns the
same sanitized provider messages instead of a raw model exception. README now
documents retryable model-mode error states, the Phase-1 Vercel plan-tier
decision for `maxDuration = 300`, and the blocked live-latency attempt.
### Verification:
- Red-first targeted tests failed on raw provider errors / missing classifier,
  then passed after implementation.
- `npm test -- src/lib/review-error.test.ts 'src/app/api/runs/[id]/execute/route.test.ts' src/app/api/rubric/gate/route.test.ts`: 13 passed.
- `npm test`: 205 passed / 3 skipped.
- `npm run typecheck`: clean.
- `npm run build`: passed; existing metadataBase warning remains.
- `node --import tsx evals/run.ts`: all 5 heuristic golden cases passed.
- `npm run eval` is blocked in this sandbox by `tsx` pipe creation
  (`listen EPERM .../tsx-501/*.pipe`); the Node loader path above verifies the
  same eval entrypoint without the pipe.
- Model-mode eval reached `reviewer: model` with `.env` loaded but did not
  reach OpenAI: `Cannot connect to API: getaddrinfo ENOTFOUND api.openai.com`.
  No latency numbers were produced in this sandbox.
### Recommendations / Next steps:
Run `node --env-file=.env --import tsx evals/run.ts` from a network-enabled
shell to complete the live 5-case model-mode golden set and record per-case
latency in README. If preserving `npm run eval` inside this sandbox matters,
change the package script from the `tsx` CLI to the Node `--import tsx` loader
in a separate approved config edit.

## [AGENT: Claude] 2026-07-08T18:30Z
### Action: Round A completion — live model-path calibration on top of Codex's P0-1 error-state work
### Files changed: src/prompts/reviewer-policy.md, src/prompts/reviewer-risk.md, src/prompts/judge.md, src/agent/model-reviewer.ts, src/lib/rubric.ts (C2/C6 descriptions), README.md (measured latency + validated model)
### Diff summary:
- Live golden-set runs (Codex sandbox has no OpenAI DNS; run locally) exposed three real
  defects Codex could not see: (1) reviewers returned compliance confirmations as
  findings — schema gained a compliantCriteria outlet and a violations-only contract;
  (2) reviewer-policy.md hardcoded "review only C1–C3" so the model obediently ignored
  C6 in its slice — prompts now scope to "every criterion in the rubric below";
  (3) judge.md's "if uncertain, challenge" made the judge demote correct findings —
  now requires a concrete defect to challenge.
- Rubric boundary fixes: C6 demands the explicit capital-at-risk formulation (generic
  loss warnings do not satisfy it); C2 explicitly excludes past-performance/comparative
  claims (those are C3).
- Result: gpt-5.4 passes all 5 golden cases twice consecutively (~4–5s/review);
  gpt-5.4-mini documented as demo-grade (run-to-run variance). README records numbers.
- Deterministic suite unaffected: 205 passed / 3 skipped, tsc clean, build green.
### Recommendations / Next steps: Round B (P0-3 auth). Client deployments should set OPENAI_MODEL=gpt-5.4.

## [AGENT: Codex] 2026-07-09T03:54Z / 2026-07-09T04:01Z
### Action: Round B WS-1 item 2 — Auth.js Google OAuth wired with demo-auth coexistence
### Files changed:
- auth.ts
- src/app/api/auth/[...nextauth]/route.ts
- src/app/api/auth/logout/route.ts
- src/app/login/page.tsx
- src/lib/oauth.ts
- src/lib/oauth.test.ts
- src/lib/session.ts
- package.json
- package-lock.json
- README.md
- .env.example
- agents-build-log.md
### Diff summary:
Added a deterministic OAuth helper seam for P0-3: Google OAuth configured-state
detection, production `AUTH_SECRET` fail-closed assertion, `ADMIN_EMAIL` first
admin gate, stable OAuth user IDs (`oauth:google:<providerAccountId>`),
session generation (`gen`) groundwork, and login auth-state decisions. Expanded
the shared `Session` shape so demo persona cookies normalize to the same
fields OAuth sessions will use (`userId`, `email`, `authMethod`, `gen`) while
preserving existing demo-cookie behavior and zero-config persona auth.
Attempted `npm install next-auth@beta` after human GO, but the sandbox could
not resolve `registry.npmjs.org` (`getaddrinfo ENOTFOUND`), and no cached
`next-auth` package was available locally. After the operator installed
`next-auth@5.0.0-beta.31`, completed the package-backed wiring: root `auth.ts`
with Google-only provider when `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` are set,
JWT session strategy, Auth.js route handler, `ADMIN_EMAIL` sign-in gate,
Auth.js session callback emitting the unified shape, lazy Auth.js fallthrough
inside `getSession()`, Google sign-in affordance only when configured,
clear OAuth rejection/configuration messages, and logout clearing both the demo
cookie and Auth.js session. README and `.env.example` now document the Google
OAuth app setup, redirect URIs, and required env vars.
### Verification:
- Red-first targeted test initially failed on missing `src/lib/oauth.ts`.
- `npm test -- src/lib/oauth.test.ts src/lib/session.access.test.ts`: 17 passed.
- `npm test`: 214 passed / 3 skipped.
- `npm run typecheck`: clean.
- `npm run build`: passed; existing metadataBase warning remains.
- Continuation after package install:
  `npm test -- src/lib/oauth.test.ts src/lib/session.access.test.ts`: 22 passed.
- `npm test`: 219 passed / 3 skipped.
- `npm run typecheck`: clean.
- `npm run build`: passed; existing metadataBase warning remains and
  `/api/auth/[...nextauth]` is included in the route table.
### Recommendations / Next steps:
Operator still needs to create the Google OAuth Web Application client, add
the local/production callback URLs, and set `AUTH_SECRET`,
`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and `ADMIN_EMAIL` per deployment.
WS-2 remains responsible for invitation flow, user records, role changes, and
deactivation-backed session invalidation.
