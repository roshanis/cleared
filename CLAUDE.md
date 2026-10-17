# Cleared — notes for Claude

Compliance review for investment communications. A document is submitted,
reviewed against a versioned rubric, and either cleared or routed to a human
whose decision lands on a permanent audit record.

## Commands

| | |
| --- | --- |
| `npm test` | Vitest — **not Jest**. Unit tests live beside their source as `*.test.ts`. |
| `npm run typecheck` | `tsc --noEmit`. Covers `src/`, `e2e/` and `evals/`. |
| `npm run e2e` | Playwright. Builds and starts the app itself on port 3123. |
| `npm run build` | Must pass before claiming anything works. |
| `npm run eval` | Golden-set evals from the CLI. |
| `npm run seed` | Reseed demo data. |

## The rule that matters most

**Verdicts are computed in code, never by a model.** Reviewers and the judge
return findings; `src/agent/merge.ts` and `src/agent/verdict.ts` decide
severity and outcome from the rubric. A model that returns a severity does not
get to set one. Keep it that way — it is why verdicts are auditable.

## Architecture

- `src/agent/` — the pipeline. Two reviewer subagents in parallel, then a
  judge, then deterministic merge and verdict. `run.ts` is the orchestrator.
- `src/agent/provider.ts` — resolves the model backend from the environment.
  *(Reintroduce if absent: it was lost with an unpushed commit.)*
- `src/lib/store.ts` + `src/lib/db/` — three drivers: `sqlite`, `postgres`,
  `memory`.
- `src/components/ui.tsx` — the shared control vocabulary. Buttons, inputs and
  badges come from here; do not hand-roll a variant.
- `src/prompts/*.md` — reviewer, judge and fixer prompts.

## Things that have caught people out

- **Demo personas are `maya` (author), `devon` (officer), `priya` (admin),
  `sam` (auditor).** No other id exists; authenticating as one that doesn't
  silently renders the signed-out page.
- **`/users` redirects for demo personas.** `canManageUsers` requires
  `authMethod === "oauth"`, so user administration is unreachable on a demo
  seat. Its metadata still renders, so a 200 with no page content is the
  gate working, not a bug.
- **A `redirect()` after metadata has flushed returns 200, not 307,** and the
  client finishes the navigation. Read the URL *after* it settles —
  `page.waitForURL(...)`, not `waitForLoadState("networkidle")`.
- **`html { scroll-behavior: smooth }` races Playwright clicks.** Use
  `window.scrollTo({ behavior: "instant" })` in tests.
- **E2E must target `localhost`, not `127.0.0.1`.** `requireSameOrigin()`
  compares `Origin` against `req.url`, whose host under `next start` is always
  `localhost`, so loopback-by-IP is rejected as cross-origin.
- **`font: inherit` applies to form controls** (`globals.css`), so a field
  takes its size from its wrapping label. There is a 16px floor under
  `pointer: coarse` because Safari zooms the page on a smaller focused field.
- **Sandboxes need `PLAYWRIGHT_CHROMIUM_PATH`** when the preinstalled Chromium
  build does not match the pinned `@playwright/test`.

## Conventions

- Comments explain *why*, not what. Match the density of the file you are in.
- iOS is a first-class target. Touch targets are 44px (`.touch-target`,
  `.touch-band`); safe areas come from `.gutter` and `.safe-bottom`; use `dvh`,
  never `vh`.
- Every table wider than the viewport goes through `TableCard`, which makes
  the scroll region keyboard-reachable only while it actually overflows.
- Never nest an `<a>` inside an `<a>`. The card lists use a stretched title
  link with interactive children lifted above it; nesting them broke hydration
  once already.
- Dates rendered on both server and client must be UTC, not locale-formatted.

## Working agreements

- **Push early.** The container is ephemeral and has been reclaimed mid-task;
  an unpushed commit was lost that way. Commit and push each coherent piece
  rather than batching one large verified change at the end.
- Do not open a pull request unless asked.
- Verify by running it. This repo rewards it: the browser suite has caught
  regressions that typecheck and unit tests both passed.
