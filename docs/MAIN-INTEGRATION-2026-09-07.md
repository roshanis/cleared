# Cleared main integration verification

Date: 2026-09-07. User approved reconciliation and local main merge.
Parents: upstream main `a9b11e6` and product upgrade `ef7f8bf`.
Integration checkout: `/Users/roshanvenugopal/Documents/github/cleared-integration.STi6CV/codex-worktree`.
Synthetic preview: `http://localhost:3211`.

## Reconciliation

- Preserved upstream stable author-ID access, v4 storage migrations, lease
  recovery, transactional model budget, deterministic seeds, real-user
  preservation during demo reset, rubric publication guards and CSV safety.
- Retained touch targets, safe areas, mobile tabs, dark/light palette, page
  titles, exact timestamps, dashboard charts, pipeline and queue severity counts.
- Integrated coverage safeguards, evidence navigation, scoped draft recovery,
  idempotency, exact-run history and search/filter/pagination workflows.
- Direct execution stays author/admin-only. Historical runs have no new-decision
  controls. The default queue stays current-only; historical inspection is separate.
- Added transactional model-budget enforcement to re-runs, after replay lookup.
  Regression first failed, then passed. Officer execute denial is covered.
- Updated active-recovery fixtures to include the upstream claim timestamp.
- Browser reproduced a stored-theme hydration mismatch. The root now explicitly
  accommodates the pre-paint theme attribute; reload produced no new error.

## Verification

- Full suite: **371 passed, 3 Postgres tests skipped, 52 test files**.
- Typecheck passed; production build passed, including Next lint/type validation.
- Offline golden evaluation: **14 passed, 1 model-only case skipped**.
- Whitespace/conflict-marker checks passed.
- Offline production-dependency audit: zero cached advisories. This is not a fresh
  online vulnerability scan. No standalone lint command is configured.
- Luna independently reviewed against upstream main. No concrete merge regression
  remained in its narrow security/role/UI pass.

Browser acceptance used the built-in browser because agent-browser was absent.
Fresh synthetic SQLite only; no copied environment files, external database,
OAuth credentials or model key. Existing application/data/preview left untouched.

- 390px phone landing/document views, light/dark themes and mobile tabs inspected.
  Document width measured 390px with no horizontal overflow.
- Author login reached Documents. Synthetic UK-only submission completed with
  guarantee and missing-language findings; exact-run workspace and pipeline loaded.
- Re-run retained UK and both reviews in one version's history.
- Officer queue showed only the current run by default, with critical/major counts.
  Include-history added the older run without changing the current-work total.
- Earlier run showed its warning and no decision controls. Current run approval
  remained disabled until review/note requirements were met.
- Auditor arrived at Audit, opened Documents, and had zero rerun/revise/approve
  controls on the review.
- 1280px desktop dark workspace inspected with no horizontal overflow.
- Stored-theme reload and subsequent routes produced no new console errors.
  Temporary viewport override and localhost theme preference were restored.

## Remaining release work, not introduced by this merge

1. Lease recovery has no worker fencing: after a 15-minute reclaim, an old worker
   can overwrite a newer result. Confirmed in upstream `a9b11e6` as well as the
   integration. Add conditional completion/failure by claim token before
   operational use with long-running or partitioned workers.
2. Map legacy name-only documents to stable users before real customer data.
   New documents and deterministic seeds already use upstream author IDs.
3. Validate live model quality, real OAuth onboarding, Postgres concurrency,
   backup/restore, deployment configuration and current dependency advisories.
   Unit tests/mock results and the offline demo do not prove these.
4. Configure metadataBase for the actual deployment domain; the build retains
   the existing localhost fallback warning. No domain was invented.
5. The canonical localhost preview works. The 127.0.0.1 alias is rejected by the
   existing request-origin guard; no security exception was added.

This integration does not certify the product for customer use. No remote push,
CI run, deployment, paid model call or migration of an existing database.
