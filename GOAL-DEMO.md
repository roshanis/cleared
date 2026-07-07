# GOAL — Open the demo: one link, four seats, zero instructions

> **How to use this file:** paste it to a coding agent working in this repo
> (or run it via `/goal`). It follows [GOAL.md](./GOAL.md),
> [GOAL-HARDENING.md](./GOAL-HARDENING.md), and
> [GOAL-AGENTS.md](./GOAL-AGENTS.md). Read `README.md` and
> `agents-build-log.md` first.
>
> The product works, but the shared link doesn't demo itself. In production,
> `accessCodeOk()` fail-closes without `APP_ACCESS_CODE`
> (`src/lib/session.ts:119`) — so a visitor who clicks the LinkedIn link sees
> the landing page and then hits a locked door. Even someone with the code
> can only inhabit one persona at a time: seeing all four seats means four
> sign-out/sign-in round trips. And once inside, nothing tells a first-time
> visitor what to try. This goal makes the deployed link a self-guiding demo:
> **click the link, pick a seat, switch seats freely, and be told the one
> thing worth trying in each.**

## Ground rules (every workstream)

- **The fail-closed default is sacred.** Without the new explicit opt-in
  (`DEMO_PUBLIC=1`), production behavior is byte-for-byte unchanged:
  `APP_ACCESS_CODE` required, wrong/missing code → 403. Every change here is
  additive behind the flag.
- **A public demo must not be able to spend the operator's money.** When
  `DEMO_PUBLIC=1`, reviews run the deterministic heuristic pipeline even if
  `OPENAI_API_KEY` is set — strangers must not be able to burn tokens. The
  judge and fixer follow automatically (they key off `run.reviewer`).
- **No session from nothing.** Persona switching requires an existing valid
  session cookie; the switch endpoint never mints a session for an
  unauthenticated caller, and stays same-origin guarded like every other
  mutation.
- TDD, suite is the floor (168 tests + golden evals). No `ReviewResult` or
  storage schema changes anywhere in this goal.
- Codex works in this repo in parallel: read `agents-build-log.md` before
  each workstream, append an entry after each.

---

## WS-1. Public demo gate — the link works without a code

New env var `DEMO_PUBLIC=1`, an explicit operator opt-in layered on top of
demo auth.

- **`src/lib/demo.ts` (new, dependency-free):** `publicDemoEnabled()` →
  `process.env.DEMO_PUBLIC === "1"`. It must live in its own module with no
  imports so `src/agent/run.ts` (also used by the evals CLI under `tsx`) can
  import it without dragging in `next/headers`.
- **`accessCodeOk()` (`src/lib/session.ts`):** returns `true` when
  `publicDemoEnabled() && demoAuthEnabled()` — the access code is skipped
  entirely. All other paths unchanged. `DEMO_AUTH=0` still wins:
  `DEMO_PUBLIC=1` cannot resurrect a disabled demo.
- **`activeReviewer()` (`src/agent/run.ts:29`):** returns `"heuristic"` when
  `publicDemoEnabled()`, regardless of `OPENAI_API_KEY`. This is the single
  choke point — the submissions route already calls it, and downstream
  judge/fixer selection follows `run.reviewer`.
- **Login page:** hide the access-code field when public demo is on
  (`needsAccessCode = Boolean(APP_ACCESS_CODE) && !publicDemoEnabled()`), and
  show one honest line: shared public demo, data may reset at any time.

**Tests (write first):** `src/lib/session.access.test.ts` — the
`accessCodeOk` matrix via `vi.stubEnv` (production without code → false;
production + code, right/wrong → true/false; production + `DEMO_PUBLIC=1` +
`DEMO_AUTH=1` → true with no code; `DEMO_AUTH=0` + `DEMO_PUBLIC=1` → false).
`src/agent/run.test.ts` — `activeReviewer()` is `"heuristic"` under
`DEMO_PUBLIC=1` even with a key set; `"model"` with a key and no flag.

## WS-2. Persona switcher — see all four seats in one click

- **`POST /api/auth/switch` (new route):** body `{ personaId }`. Guards, in
  order: `requireSameOrigin`, valid existing session (else 401), demo auth
  enabled (else 403), known persona (else 400). On success: set the new
  persona's cookie (same flags as login) and return
  `{ ok: true, home: homeByRole[persona.role] }` so the client lands on the
  right seat.
- **`src/components/demo-banner.tsx` (new client component) + server wrapper
  rendered from `src/app/layout.tsx` below `<Nav />`:** a slim strip shown
  only when demo auth is enabled AND a session exists. Contents:
  - "Viewing as **Maya Chen** · author" (current seat, always oriented),
  - the other three personas as one-click switch buttons (initials + name;
    calls `/api/auth/switch`, then `router.push(home)` + `router.refresh()`),
  - the per-role hint from WS-3.
  Respect the design register: no gradient text, no uppercase-tracked
  eyebrows; this is a quiet utility bar, not a marketing banner.
- **Pure-helper test (write first):** extract `switchTarget(personaId)` in
  `session.ts` returning `{ token, home }` or `null` (unknown persona / demo
  disabled) so the behavior is unit-testable without mocking `cookies()`;
  the route stays thin glue over it.

## WS-3. Guided demo — tell each seat the one thing to try

- **Per-role hint (rendered in the demo banner):**
  - author: "Submit the sample document — watch it fail with exact quotes,
    then draft fixes and resubmit until it passes." (link → `/submit`)
  - officer: "Open the queue and decide a flagged review — every override
    needs a note." (link → `/queue`)
  - admin: "Edit the rubric, run the golden gate, publish a new version."
    (link → `/rubric`)
  - auditor: "Read the decision trail and export the audit CSV."
    (link → `/audit`)
- **No seed changes needed:** `seedInto` already reviews all five golden
  cases (including the UK jurisdiction fail and the multimarket pass) and
  pre-loads one officer decision — every seat has content on first load.
  Verify this in the E2E, don't rebuild it.
- **Landing/login flow:** persona cards already deep-link `/login?as=<id>`;
  with the code wall gone under `DEMO_PUBLIC=1` this becomes true one-click
  entry. No landing changes required — confirm, don't redesign.
- **Docs:** `.env.example` gains `DEMO_PUBLIC` with a comment stating the
  trade (public writes, forced heuristic reviewer). README gains a "Public
  demo" recipe: `DEMO_AUTH=1` + `AUTH_SECRET` + `DEMO_PUBLIC=1`;
  `APP_ACCESS_CODE` optional (ignored while public); **no `DATABASE_URL`**
  on Vercel = ephemeral memory store that reseeds itself — for a public demo
  that's the feature, not the bug (strangers' data self-destructs); a
  shared Postgres behind a public demo is explicitly not recommended.

---

## Verification

Per workstream: new tests red first, then green; full suite + `tsc --noEmit`
+ `next build`; build-log entry.

Final end-to-end (production build, simulating the Vercel public demo:
`NODE_ENV=production`, `DEMO_AUTH=1`, `AUTH_SECRET` set, `DEMO_PUBLIC=1`,
`VERCEL=1`, `OPENAI_API_KEY` set to a dummy value):

- `POST /api/auth/login` with a persona and **no access code** → 200, cookie
  set; landing "Try the demo" → login shows no code field.
- Signed in as Maya: demo banner shows the author hint; submit the sample
  document → run completes on the **heuristic** reviewer (assert
  `run.reviewer === "heuristic"` despite the dummy key) → fails with quotes.
- One-click switch Maya → Devon → Priya → Sam via the banner: each lands on
  the right home (`/queue`, `/dashboard`... per `homeByRole`), nav links
  change, no sign-out in between. Auditor still 403s on submit/decide/rubric.
- Full loop across seats: Maya submits → Devon decides → Sam sees it in
  `/audit` and exports CSV.
- **Regression (fail-closed):** same build with `DEMO_PUBLIC` unset and
  `APP_ACCESS_CODE=secret` — login without code → 403, with code → 200.
  And with `DEMO_AUTH=0 DEMO_PUBLIC=1` — login → 403.

**Needs from operator after merge:** on Vercel set `DEMO_PUBLIC=1` (keep
`DEMO_AUTH=1`, `AUTH_SECRET`; `APP_ACCESS_CODE` may stay or go), redeploy,
then click the public link in a private window and walk all four seats.

---

## Execution status — 2026-07-07, awaiting review

Executed in full on branch `demo-public` (spec `1626bc6`, implementation
`3c2ad83`); not yet merged to main or pushed.

- **WS-1** done: `DEMO_PUBLIC=1` gate in `src/lib/demo.ts` +
  `accessCodeOk()`; heuristic reviewer forced in `activeReviewer()`; login
  page hides the code field with a shared-demo note. 10 new tests, red
  first.
- **WS-2** done: `POST /api/auth/switch` over the pure `switchTarget()`
  helper; `DemoStrip`/`DemoBanner` utility bar under the nav.
- **WS-3** done: per-role hints in the strip; `.env.example` + README
  public-demo recipe. Seed verified rich enough as-is — not rebuilt.
- **Verification:** suite 175 passed / 3 postgres-skipped, `tsc` clean,
  22-route build. Live E2E 26/26 across three production servers: public
  walk (no-code login → submit → heuristic despite a dummy key → fail →
  four-seat hop → decision → audit + CSV; switch without a session → 401),
  access-code fail-closed regression, and `DEMO_AUTH=0` + `DEMO_PUBLIC=1`
  stays locked.

**Open for the operator:** review + merge `demo-public`, then set
`DEMO_PUBLIC=1` on Vercel and redeploy.
