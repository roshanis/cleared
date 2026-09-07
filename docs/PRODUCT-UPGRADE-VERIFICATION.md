# Cleared product upgrade: implementation and verification

## Integration update: 2026-09-07

Product upgrade commit `ef7f8bf` reconciled with upstream main `a9b11e6`
on `codex/integrate-product-upgrade`, following the user's merge approval.
The original implementation record below describes the pre-integration snapshot.
Current integration evidence and release boundaries:
[MAIN-INTEGRATION-2026-09-07.md](MAIN-INTEGRATION-2026-09-07.md).
Upstream now provides stable author-ID ownership for new documents and seeds;
only legacy rows retain the name fallback. The older ownership blocker below
is superseded by this narrower legacy-data requirement.

## Original implementation record

Date: 2026-09-07. Baseline: `9780140` (including the user's existing rerun work).
Implementation branch: `codex/product-upgrade`, subsequently committed as `ef7f8bf`.
Checkout: `/private/tmp/cleared-upgrade.4frmtr/codex-worktree`.
Local synthetic preview: `http://localhost:3210`.

## What changed

- Buyer-facing investment-communications presentation, role-specific homes,
  responsive queues and documents, URL-backed search/filter/sort, pagination,
  and clear next actions. No invented testimonials, accuracy figures or pricing.
- Evidence workspace with original text beside findings, keyboard-operable
  highlights, mobile panels, historical rule descriptions, and coverage detail.
  Repeated exact quotes highlight every occurrence; evidence navigation starts at
  the first matching occurrence. Fuzzy/normalized matching remains conservative.
- Rule coverage distinguishes checked, finding, not applicable, uncertain,
  unsupported and omitted. Omitted/unsupported checks cannot result in an
  unqualified pass. Historical runs without metadata show it as unavailable.
- Contradictory model output retains allegations at low confidence. Missing-
  language findings explicitly identify their quote as context, not offending text.
- Fixed the reproduced negation-masked guarantee, unrelated-source comparison,
  second sustainability claim, and email-password paraphrase misses. These are
  regression cases, not a claim of exhaustive detection.
- Every version and rerun is addressable and retained in history. Queue and audit
  links open the exact run; default queue excludes superseded work.
- Resubmission retains markets. Draft recovery is optional, tab/user/document-
  scoped, and expires eight hours after the last save. Expired records are removed
  when read; browser storage is not an encrypted vault or cross-device backup.
- Submission/rerun keys preserve saved work on retries. A replay reuses the
  original reviewer before rate/model-budget admission. An errored rerun replay
  deliberately retries execution of the same saved run, not a new run. A revision
  uses the existing immutable document title; changing the submitted title does
  not rename it. Keys must not be reused for different content/markets/targets.
- Progress shows confirmed saving/running states and elapsed time, without
  invented stage completion or artificial delay. Recovery has bounded waits.
- Findings begin unreviewed. Approving known coverage gaps requires explicit
  acknowledgment plus rationale; the server derives the actual gap IDs and adds
  the acknowledgment to the immutable audit note. This does not resolve the
  automated gaps. Requesting changes does not require claiming resolution.
- Auditor write controls are absent, and the execute API rejects auditors.

## Automated verification

| Check | Result |
| --- | --- |
| Baseline `npm test` | 314 passed, 3 Postgres tests skipped |
| Final `npm test` | 352 passed, 3 Postgres tests skipped, 50 test files |
| `npm run typecheck` | Passed |
| Offline `npm run eval`, API key removed | 14 passed, 1 model-only case skipped |
| Production `npm run build` | Passed in a separate isolated source snapshot |
| `git diff --check` | Passed |
| `npm audit --offline --omit=dev --json` | 0 cached advisories; not a fresh online security audit |

Regression work used failing tests before behavior changes. Added pipeline
coverage/contradiction checks use mocked model responses; they are not live model
accuracy measurements. SQLite replay was checked across driver instances;
concurrent submission/rerun identity was checked in the store tests. API tests
cover admission-limit replay, changed-request conflicts, auditor denial, active
rerun recovery, and zero-finding coverage-gap approvals.

The first build snapshot omitted root `auth.ts`/`instrumentation.ts`; after
including these existing source files, the complete snapshot built successfully.
Next reports the existing missing `metadataBase` warning: configure the actual
customer/public domain before release rather than inventing a production URL.
No standalone lint script is configured; Next's build/type checks were run.

## Browser acceptance actually exercised

Used the connected in-app browser because `agent-browser` was unavailable.
The preview has fresh synthetic SQLite data, no copied `.env`, no external DB,
no OAuth credentials, and no model key. Dev server binds loopback only.

- Landing inspected at desktop and 390px; no horizontal document overflow.
- Author draft saved, page reloaded, Restore selected: text and UK-only market
  selection recovered. New review found the guarantee and missing UK warning.
- Revision retained UK (not US/EU). Adding the risk warning removed that finding
  while retaining the guarantee finding.
- Two reruns yielded three separately linked reviews of version 2 and retained
  version 1: two versions, four total runs.
- Evidence button focused the matching source highlight; keyboard activation
  returned focus to the finding. Coverage panel and historical warning inspected.
- Officer queue search returned the current exact run. A note alone left decision
  buttons disabled until the finding was explicitly confirmed. Request-changes
  saved the rationale, updated the human status, and retained it in history.
- Auditor audit link opened that exact decided run. No rerun, revise, draft-fix,
  or decision controls were present. Mobile document width stayed within 390px.
- Admin dashboard and rubric navigation inspected at 390px; demo admin does not
  see the real-user management link. No rubric publication or data reset performed.
- Browser found duplicate sibling React keys during the first pass. They were
  fixed; subsequent checked journeys produced no new console errors.
- A fresh sign-in exposed a client push/refresh race after a successful auth
  POST. Login now uses a full navigation across the cookie boundary; fresh
  sign-out/sign-in was repeated successfully and landed on the author documents.

Network-loss simulation, live OAuth, CSV-download contents, print output,
screen-reader behavior, real mobile hardware and live model evaluation were not
fully exercised. Existing route/unit tests are not substitutes for those checks.
A 127.0.0.1-origin demo login was rejected by the existing same-origin guard;
the canonical localhost preview worked without relaxing that security check.

## Release boundaries and next approval

This is a substantially stronger local demo, not a certified production product.

1. **Blocking:** document ownership still compares display names in
   `src/lib/access.ts` and other legacy call sites. Two equal names are not a safe
   ownership boundary. Agree a stable-user-ID schema, legacy mapping and migration
   plan before customer data; no existing database migration was authorized here.
2. Validate the changed model schema/prompts against a customer-approved rubric
   and representative sanitized examples. Historic July model results do not
   validate this revision. The starter rubric is not comprehensive legal coverage.
3. Exercise real OAuth onboarding, user lifecycle, Postgres concurrency/restore,
   deployment configuration, current dependency advisories and access-control QA.
4. Validate the proposed first customer segment, approval policy, retention,
   privacy terms, and willingness to pay. No billing or commercial claims added.

Luna independently reviewed engine/recovery/UI changes. Its coverage-
acknowledgment finding was reproduced, fixed in UI/API/store, regression-tested,
and re-reviewed with no further concrete defect in that patch.

An additional source-only backup (no credentials, dependencies or review data)
is stored at `/Users/roshanvenugopal/Documents/github/eveagents/.codex-backups/product-upgrade-final-20260907.0Up3ra`.

No commit, push, merge or deployment. Original application checkout and existing
data were preserved. The separate worktree contains the implementation; retain
or commit it before temporary-directory cleanup. Browser preview remains running
for inspection. Next step: human diff review, then authorize integration and the
stable-ownership release work separately.
