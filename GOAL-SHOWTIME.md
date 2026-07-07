# GOAL — Showtime: make the Cleared demo land like a keynote

> **How to use this file:** paste it to a coding agent working in this repo
> (or run it via `/goal`). It follows [GOAL.md](./GOAL.md),
> [GOAL-HARDENING.md](./GOAL-HARDENING.md), [GOAL-AGENTS.md](./GOAL-AGENTS.md),
> and [GOAL-DEMO.md](./GOAL-DEMO.md). Read `README.md` and
> `agents-build-log.md` first.
>
> The product works and the link is public
> (`https://cleared-five.vercel.app`, four personas, one-click seat
> switching). What's missing is the *performance*. A great product demo —
> the kind Jobs gave — is not a feature tour: it's one storyline, told
> through the product doing its job live, with a rehearsed climax and no
> fumbling. This goal produces three things: **a script the presenter can
> rehearse, a screen the back row can read, and a reveal moment worth the
> pause.**

## Ground rules (every workstream)

- **Nothing fake.** Progress shown on screen must map to real stages of the
  real pipeline (two reviewers → judge → verdict). Choreographed pacing that
  lets the audience read what is happening is fine; inventing work that
  didn't happen is not.
- The public demo stays deterministic (heuristic mode) — the demo must
  produce the same verdicts, quotes, and fixes every single run. Rehearsal
  depends on it.
- Design register holds: no gradient text, no glassmorphism, no
  uppercase-tracked eyebrows, no identical card grids. `prefers-reduced-motion`
  is respected everywhere new motion is added.
- TDD where behavior changes; suite is the floor (175 tests + golden evals);
  `tsc --noEmit` + `next build` before every commit.
- Codex works in this repo in parallel: read `agents-build-log.md` before
  each workstream, append after.

---

## WS-1. The script — `DEMO-SCRIPT.md`

A presenter-facing runbook at the repo root. Not marketing copy — exact
clicks with the sentence to say at each one. Five minutes, three acts:

- **Act I — the problem (45s).** Open the landing page. "Every marketing
  email at a financial firm waits days for compliance review." Scroll to
  the live sample review: "This is not a screenshot — the product reviewed
  this document as the page loaded."
- **Act II — the reveal (2 min, the climax).** Sign in as Maya (one click,
  no password — narrate that). Submit the sample document. The review comes
  back a **fail with exact quotes** — read one aloud. Then the arc that
  lands the whole product: **Draft fixes → watch the rewrite → resubmit →
  pass.** "The agent found it, the agent fixed it, and a human approved
  every character."
- **Act III — the system (2 min).** Switch seats live from the demo strip,
  no sign-out: Devon decides the flagged review (note required — "every
  override is on the record"), Priya runs the rubric's golden gate ("you
  cannot publish a rubric that breaks the known cases"), Sam exports the
  audit CSV ("everything you just watched is already an audit trail").
- **One more thing (30s).** Resubmit the sample for US + UK: passes US,
  fails UK on the missing capital-at-risk warning. "Same document, two
  markets, two verdicts."

Include a **prep checklist**: hit the production URL 5 minutes early to
warm the instance; use a fresh private window; use `cleared-five.vercel.app`
(never a `cleared-xxxxx-…` deployment URL — those are SSO-walled); browser
zoom for the room; and the recovery line if a cold start reseeds mid-demo
("the demo resets itself — watch, I'll do it again from scratch").

## WS-2. Big-screen typography — readable from the back row

- The nav wordmark bump (`text-lg` → `text-2xl`) ships alongside this goal.
- Audit the three screens the audience stares at longest — landing hero,
  result view (verdict + findings), and the queue — at 1280×720 projector
  resolution. Findings quotes and verdict badges must read from the back of
  a conference room; raise sizes where they don't, keeping the type scale
  coherent and mobile/laptop layouts unbroken.
- The demo strip is the presenter's steering wheel: make the current-seat
  name and switch buttons comfortably clickable while standing up.

## WS-3. Review theater — the pause before the reveal

The submit → verdict moment is currently instant in heuristic mode, which
reads as *nothing happened*. Give the audience the two seconds it takes to
understand what they're about to see:

- Locate the post-submit execute experience and stage the wait as the real
  pipeline steps: "Policy reviewer reading…" → "Risk reviewer reading…" →
  "Judge verifying quotes…" → verdict. In model mode the stages ride the
  actual call latency; in heuristic mode pace the sequence to ~2.5s total
  so each stage is readable. Same stages, same order, honestly labeled.
- The verdict then lands with the existing `animate-rise` entrance;
  findings stagger in after it. Reduced-motion users get the result
  immediately with no choreography.
- **The climax must be unmissable:** on a failed run, the "Draft fixes"
  button is the single most important control on the page — give it primary
  prominence, and make the draft → "Load into resubmit" → pass loop
  zero-fumble (no scrolling hunts, no ambiguous button labels).

---

## Verification

Per workstream: suite + `tsc --noEmit` + `next build`; build-log entry.

Final rehearsal (the verification IS a rehearsal): walk `DEMO-SCRIPT.md`
start to finish against a production build — every click in the script
exists, every quoted sentence matches what the screen shows, the fail →
fix → pass arc completes without leaving the happy path, the US/UK closer
produces the split verdict, and the whole walk fits in five minutes.
Then repeat the walk once on the live `cleared-five.vercel.app` deploy.

**Needs from operator after merge:** deploy, then rehearse the script out
loud twice before the meeting. The demo resets itself between cold starts —
that's a feature; the script says so.
