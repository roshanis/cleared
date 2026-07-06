# GOAL — Grow the agent roster: jurisdictions, a judge, and a fixer

> **How to use this file:** paste it to a coding agent working in this repo
> (or run it via `/goal`). It follows [GOAL.md](./GOAL.md) (built the app) and
> [GOAL-HARDENING.md](./GOAL-HARDENING.md) (production gaps). Read `README.md`
> and `agents-build-log.md` first.
>
> The pipeline today is two reviewer subagents (policy + risk) whose findings
> are merged and judged by deterministic code. This goal adds three agents —
> per-jurisdiction review, an LLM judge, and a fix-drafting agent — without
> breaking the architecture rule that makes verdicts auditable:
> **agents propose, code disposes.**

## Ground rules (every workstream)

- Demo mode stays first-class: every new agent gets a deterministic
  heuristic stand-in that works with zero config, or an honest UI label
  saying the step is model-only.
- The suite is the floor (127 tests + golden evals). TDD: every behavior
  lands with a test that fails without it.
- `ReviewResult` schema changes must be backward-compatible: stored runs
  from before this goal must still parse and render (new fields optional).
- Orchestration stays in code (`src/agent/run.ts`): agents return structured
  output; merge, verdict, and gating rules remain deterministic functions
  with unit tests.
- Model-mode cost: this goal adds up to 2 extra model calls per review
  (judge + fixer). Record measured latency in README. Cost/rate limits
  (GOAL-HARDENING P1-6) remain open — do not silently multiply spend beyond
  those 2 calls without flagging it.

---

## WS-A. Jurisdiction review

A document that passes US rules can fail UK or EU rules. Make the rubric and
the verdict jurisdiction-aware.

- **Data model:** `RubricCriterion` gains optional `jurisdictions?: string[]`
  (e.g. `["UK"]`); absent = global (applies everywhere). Supported set for
  v1: `US`, `UK`, `EU` (constant, easy to extend). Rubric versioning,
  draft → golden gate → publish flow all unchanged.
- **Submission:** authors pick target markets (checkbox chips, default US).
  Stored on the run (`jurisdictions: string[]`), so reruns are reproducible.
- **Pipeline:** reviewer calls stay area-based (policy/risk). Each call's
  rubric slice = global criteria + criteria for the selected jurisdictions.
  Code partitions findings by the criterion's jurisdiction tag and computes
  **one verdict per selected jurisdiction** (plus overall = worst). No
  per-jurisdiction call fan-out in v1 — slicing keeps cost flat.
- **Seed rubric:** add two demo criteria the heuristic can check:
  `C6 (UK, major)`: promotions must carry a "capital at risk" style warning
  (regex for its absence when investment content is detected);
  `C7 (EU, minor)`: unsubstantiated sustainability/green claims (regex for
  "green"/"sustainable"/"eco-friendly" without "certified"/reference).
- **UI:** result view shows a verdict chip per market ("US Pass · UK Fail");
  document page and queue show the overall verdict with per-market detail on
  the document page; audit CSV gains a `jurisdictions` and per-market verdict
  column.
- **Golden set:** add ≥2 cases: one that passes US but fails UK (missing
  capital-at-risk warning), one clean multi-market pass.

**Done when:** a submission targeting US+UK returns distinct per-market
verdicts from one review; golden set green; old runs (no jurisdictions
field) still render.

## WS-B. LLM judge — final reviewer of the review

A judge agent examines the merged findings before the verdict is final. It
guards against false positives and hallucinated quotes — but it can only make
the system *more* cautious, never less.

- **Position in pipeline:** after merge, before verdict. Input: document,
  rubric slice, merged findings, and the rule-computed draft verdict.
  Output (structured, zod): per-finding `endorse | challenge` with a reason,
  a recommended verdict, and a one-paragraph rationale.
- **Gating rules (deterministic, unit-tested — this is the auditability
  core):**
  - Judge endorses everything and agrees with the draft verdict → verdict
    stands; the judge's rationale becomes the result summary.
  - Judge challenges a finding → that finding's confidence drops to `low`
    and the UI labels it "judge flagged as possible false positive". A
    challenged fail-level finding routes the document to
    `needs_human_review` instead of `fail` (existing low-confidence rule).
  - Judge disagrees with the draft verdict in EITHER direction →
    `needs_human_review`, with both positions shown. **The judge can never
    flip fail→pass or pass→fail on its own.**
- **Demo mode:** the heuristic judge is a deterministic verifier: it checks
  every finding's quote appears verbatim in the document (the machinery
  exists in `src/lib/highlight.ts`) and challenges any that don't. Honest,
  useful, testable — and it exercises the same gating code paths.
- **Schema:** `ReviewResult.judge?: { verdictAgreed, rationale,
  challenges: [{findingIndex, reason}] }` — optional for back-compat.
- **UI:** a "Judge" line under the verdict banner (rationale, and per-finding
  challenge labels); the officer sees challenges in the decision panel.

**Done when:** gating rules have exhaustive unit tests (endorse/challenge ×
verdict agreement matrix); a fabricated-quote finding gets challenged and
demoted in demo mode; golden verdicts are unchanged by an endorsing judge.

## WS-C. Fix-it agent

Findings tell the author what's wrong; the fixer drafts the compliant
rewrite.

- **Trigger:** author-initiated ("Draft fixes" button on a failed/flagged
  result) — never automatic, so cost is opt-in and the author stays in
  charge.
- **Model mode:** one structured call: for each finding, a replacement for
  the quoted passage (or an insertion, for missing-language findings like
  C1/C6) plus a one-line note. Zod-validated.
- **Demo mode:** templated deterministic fixes for the seed criteria
  (C1/C6: append the standard disclaimer line; C2: replace the guarantee
  sentence with factual phrasing; C4: replace the account-number ask with a
  secure-portal line; C7: qualify the green claim). Testable and demoable.
- **Apply step (deterministic code):** exact/normalized quote replacement
  producing a patched document; segments that can't be located are reported
  ("couldn't locate this passage — apply manually"), never guessed. Preview
  shows old→new per finding; "Load into resubmit" prefills the submit form
  with the patched content. Nothing is ever auto-submitted.
- **Proof loop:** a test (and the demo path) shows: sample document fails →
  demo fixes applied → resubmit of patched content **passes** the same
  rubric. That's the whole product story in one test.

**Done when:** that fail→fix→pass test is green in demo mode; model-mode
fixer is wired behind the same seam; unlocatable quotes degrade honestly.

---

## Sequencing & architecture notes

Build order: **WS-A → WS-B → WS-C** (the user's priority; also the
dependency order — the judge should see jurisdiction-partitioned findings,
and the fixer benefits from judge-demoted findings being visually distinct).

Each workstream: failing tests first, suite + `tsc` + `next build` green,
build-log entry, then the next. Reuse the seams: `reviewerAreas` and prompt
files in `src/prompts/` for new agent prompts; `mergeFindings`/`decideVerdict`
for partitioning and gating; `segmentDocument` for quote location.

The judge + fixer add sequential model calls — if latency approaches the
function budget (see README's maxDuration note), that is the trigger to
revisit the eve migration (durable execution) rather than squeezing the
request harder.

## Non-goals

No per-jurisdiction reviewer fan-out (v1 slices the rubric instead); no
auto-apply or auto-resubmit of fixes; no judge authority to relax a verdict;
no new personas; no rate limiting (still P1-6); no eve migration inside this
goal.
