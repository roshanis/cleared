# GOAL — Build "Cleared": a compliance review web app, ready to deploy

> **How to use this file:** paste it as the first message to a coding agent
> (Claude Code, Codex, Cursor) working in this repo, or run it via `/goal`.
> It is the complete spec — the agent should not need follow-up questions
> except for genuinely blocking decisions. "Cleared" is a working name;
> keep branding easy to swap.

## 1. The product

Cleared is a web app where teams get customer-facing documents (emails,
marketing pages, letters) reviewed for compliance before they ship. An AI
agent — an orchestrator with two reviewer subagents, already built in this
repo — reviews each document against a rubric and returns a structured
verdict with exact quotes and fixes. Humans stay in the loop: anything the
agent fails or is unsure about lands in a review queue for a compliance
officer, and every decision is recorded for audit.

## 2. Build on what is already here — do not rewrite it

The agent core in this repo is the source of truth. Wire the app around it:

| Asset | Role |
|---|---|
| `src/agent.config.ts` | Agent definition: model, orchestrator + 2 reviewer subagents, prompts |
| `src/schema.ts` | The `ReviewResult` zod schema — share it between agent and UI; never define a parallel type |
| `src/prompts/*.md` | The prompts and rubric. The rubric is a template — the app must let admins replace it (see 4c) |
| `evals/grade.ts` + `evals/golden/` | Grading harness + golden set — the regression gate for any prompt/rubric change |
| `agents-build-log.md` | Append an entry after each work session |

Runtime: this is an eve project (Vercel's agent framework). Use eve's durable
execution for review runs and its human-approval primitives for the review
queue where they fit. Verify eve's current API against its docs — the wiring
notes in README.md were written before docs access and flag exactly what to
check.

## 3. Who uses it

Design every screen for one of these four people. If a screen serves nobody
below, cut it.

**Maya — content author (marketing).** Submits a document, needs a verdict in
minutes, not days. Success: she can paste or upload a doc, watch review
progress live, and get findings she can act on without asking anyone —
each one shows the exact quote, why it fails, and the suggested fix. She
resubmits and sees the delta from last time.

**Devon — compliance officer.** Owns the queue. Success: one screen lists
everything that is `fail` or `needs_human_review`, oldest-first, with the
agent's findings pre-loaded next to the document. He can approve, reject, or
override any finding — always with a required note — and his decision, not
the agent's, is final. He never re-reads a document the agent already
annotated; quotes are highlighted inline.

**Priya — compliance lead (admin).** Owns the rubric. Success: she can edit
criteria, severities, and verdict rules in the UI without touching code.
Every rubric change is versioned, and before it goes live the app runs the
golden set against it and shows her the diff in outcomes — she publishes only
if regressions are intentional. She also sees a dashboard: volume, pass rate,
most-violated criteria, median time-to-decision.

**Sam — auditor (read-only, occasional).** Success: for any document, Sam can
see the complete history — every version submitted, the rubric version it was
judged against, the agent's findings, and the human decisions with notes and
timestamps — and export it (CSV at minimum).

## 4. What to build

**a. Submit & results (Maya).** Paste text or upload (.md/.txt at minimum);
live progress while the agent runs (reviews take up to a minute — never a
blank spinner); results page showing the document with finding quotes
highlighted inline, a findings panel keyed to the highlights (criterion,
severity, explanation, fix), and the verdict. Resubmission links versions.

**b. Review queue (Devon).** Queue with filters (verdict, criterion, age);
side-by-side document + findings; per-finding accept/dismiss and overall
approve/reject with mandatory note; decisions write to the audit trail.

**c. Rubric management (Priya).** CRUD for criteria (ID, severity,
description) and verdict rules; every save is a new rubric version; a
"publish" step that first runs the golden set through the grading harness
against the candidate rubric and shows pass/fail deltas per case; published
version is what the agent uses from then on.

**d. Dashboard & audit (Priya, Sam).** Metrics cards + a simple trend chart;
per-document immutable history view; CSV export.

**e. Auth & roles.** Three roles: author, officer, admin (admin ⊇ officer).
Use a simple Vercel-friendly auth solution — no enterprise SSO. Auditors are
admins with an export button, not a fourth role.

**f. Persistence.** Documents, versions, review runs, findings, human
decisions, rubric versions. Pick a Vercel-native store; document the choice
and env vars in README.

**g. Seed data / demo mode.** First deploy must look alive: seed the three
golden documents as past submissions with their expected outcomes so every
screen has content. Make seeding a script, not a hack.

## 5. Design direction

Professional trust tool, not a startup landing page. Concrete spec — follow
it rather than inventing a different aesthetic:

- **Feel:** calm, dense-but-readable, confident. Think internal tool at a
  well-run bank, with taste.
- **Color:** near-white warm background `#FAFAF8`, ink `#1C1C1A`, one accent
  for interactive elements: deep teal `#0F5257`. Verdicts are semantic and
  used sparingly: pass `#15803D`, needs-review `#B45309`, fail `#B91C1C`
  (tinted backgrounds for badges, full color for text/icons).
- **Type:** Geist for UI, Geist Mono for quotes/IDs/JSON, and a serif
  (Source Serif 4) for document body text so submitted content reads like a
  document, not app chrome. No Inter, no Roboto, no purple gradients.
- **Components:** verdict badges, severity dots, highlighted quote spans in
  the document view, findings cards, a real empty state for every list, and
  skeletons for loading. Tables over cards for queues.
- **Quality bar:** keyboard-navigable, visible focus states, WCAG AA
  contrast, responsive down to tablet (mobile: readable, not optimized).

## 6. Technical constraints

- TypeScript throughout; Next.js App Router for the UI; deploys to Vercel
  with `vercel deploy` — agent and app in this one project.
- The agent's output must parse with `reviewResultSchema` before anything is
  stored or shown; a parse failure is an error state the user sees honestly.
- Models stay as configured (`anthropic/claude-opus-4-8`) unless golden-set
  results justify a change.
- Tests first (this repo's workflow is TDD): extend the vitest suite as you
  build; `npm test` and the golden evals are the gates for every change to
  prompts, rubric handling, or grading.
- No secrets in client code. `.env.example` stays current with every
  variable the deploy needs.

## 7. Definition of done — all boxes, verified on the deployed URL

- [ ] `vercel deploy` from a clean clone succeeds using only documented env vars
- [ ] `npm test` green; golden evals pass end-to-end through the deployed agent
- [ ] Maya: submit → live progress → highlighted findings → resubmit shows version diff
- [ ] Devon: queue → override a finding with a note → decision appears in audit history
- [ ] Priya: edit rubric → publish gate shows golden-set deltas → new version takes effect
- [ ] Sam: open any seeded document's full history and export CSV
- [ ] Every list has an empty state; every async action has loading and error states
- [ ] Seed script populates demo data; first-visit experience looks finished
- [ ] README updated: architecture, env vars, seed, deploy, and role/login instructions

## 8. Non-goals — do not build these

Billing/plans; enterprise SSO/SCIM; multi-org tenancy; in-app document
editing (findings recommend fixes, authors edit at the source); PDF/DOCX
parsing (stub the upload types, note as future work); email notifications;
model fine-tuning; mobile-first design.

## 9. Working agreements

Work autonomously; make reasonable calls on minor decisions and note them.
Stop and ask only for: destructive actions, spending decisions, or a conflict
with this spec. Report progress with evidence (test output, screenshots,
deployed URLs) — never claim a checkbox without having verified it. Commit in
small, described steps; append a session entry to `agents-build-log.md`.
