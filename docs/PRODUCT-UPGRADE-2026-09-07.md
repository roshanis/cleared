# Cleared: a focused product upgrade

Historical planning record: source review and reproductions below describe the
pre-upgrade baseline `9780140` on `goal-live`. The human subsequently supplied GO;
implementation is on `codex/product-upgrade`. See
[the verification report](PRODUCT-UPGRADE-VERIFICATION.md) for current results
and remaining release requirements.

## Product decision

Start with investment-marketing teams reviewing customer communications. This is
a proposed first customer segment, inferred from the actual seed rubric: returns,
investment disclaimers, competitor comparisons, fees, sensitive data, and selected
UK/EU criteria. It is not evidence of customer demand or legal coverage.

The promise: **Move investment communications from draft to documented decision,
with evidence your compliance team can inspect.**

Do not market the current seven-rule starter as a universal compliance product.
The first paid pilot needs a customer-approved rubric and evaluation set. Success
is a faster, recoverable review workflow whose gaps remain visible.

## Findings that determine the build order

| Priority | Evidence | Customer consequence | Required behavior |
| --- | --- | --- | --- |
| P0 | `model-reviewer.ts:52-79` drops findings when the same criterion appears in `compliantCriteria`, then discards the compliance list. A local contradictory-output reproduction returns `[]`. | A contradiction can erase a real allegation before the judge sees it. Omitted checks cannot be distinguished from completed checks. | Preserve contradictions as uncertainty. Account for every assigned criterion. A missing assessment must not count as a passed check. |
| P0 | `heuristic.ts` examines the first guarantee match; an initial negation masks a later guarantee. Full heuristic pipeline reproduction below returns `pass`. | A seeded/demo evaluation can provide false reassurance on an obvious risk. | Evaluate relevant occurrences independently, with negation scoped to the claim. Add both positive and negative regression cases. |
| P0 | `heuristic.ts` accepts citation words anywhere for C3 and examines only the first green claim for C7. Both reproduced as `pass`. | Unrelated text can hide unsupported claims. | Associate supporting evidence with the specific claim; do not let an earlier supported claim excuse a later unsupported claim. |
| P0 | A custom-only C8 rubric passes through `runReview(..., "heuristic")` with no findings. | An unsupported rule looks like successful coverage. | Persist and show unsupported criteria; incomplete review routes to human attention. Do not synthesize a violation for a check that never ran. |
| P0 | `reviewQueue()` includes all undecided non-passing runs; queue links identify only the document; detail selects the latest run per version. | Selecting an old queue item can show another run. Old re-runs and decisions are hidden in the document history. | Give every run an addressable view; queue links identify the run. Display all runs under each version and retain original decisions. Distinguish superseded work from current action. |
| P0 | Document access checks compare `document.author` with `session.name` in `access.ts` and page/API call sites. | Two authors with the same display name can satisfy the ownership comparison. | Treat stable author identity as a release blocker. A user-ID ownership change and legacy mapping need a separately explicit migration plan before applying to existing customer data. |
| P1 | `SubmitForm` defaults markets to US; the resubmit page passes only ID, title, and content. | Revising a UK/EU document silently changes the review scope. | Preserve selected markets and make any scope change explicit. |
| P1 | Submit retries always POST a submission before executing; drafts live in component state. | A transient failure or refresh can cause duplicate work or a lost draft. | Keep a recoverable run reference, retry that run, and handle ambiguous submission responses with idempotency. Draft recovery must be identity-scoped, disclosed, expiring, and resilient to unavailable storage. |
| P1 | `review-theater.ts` advances stages every 650 ms and delays result presentation for 2.6 seconds. | Status text claims activity the server has not reported. | Show confirmed queued/running/done/error states and elapsed time. Describe pipeline stages separately until actual stage events exist. |
| P1 | Document detail gates decisions using `role !== "author"`; resubmit uses `role !== "officer"`. The APIs correctly reject auditors. | Auditors see write actions that fail or redirect. | Use the same capability functions for controls and endpoints. |
| P1 | `copy.ts` describes any passing result as cleared with no human review needed. | Automated review and accountable approval collapse into one misleading state. | Separate “No issues found in checked rules” from “Approved by [officer].” Preserve existing policy unless explicitly changing approval requirements. |

## Local reproductions

The following ran through the full deterministic pipeline using the existing
rubric and an explicit `heuristic` reviewer. No model API calls were made.
For the first three inputs, append:

> Past performance is not indicative of future results. Investments may lose value.

| Input | Markets | Missing finding | Actual result |
| --- | --- | --- | --- |
| No investment is risk-free. Our product guarantees a 20% return. | US | C2 | `pass`, zero findings, judge agreement |
| According to our newsletter, markets are busy. Our fund beats Vanguard. | US | C3 | `pass`, zero findings, judge agreement |
| Our first green fund is certified. Our other fund is sustainable. | EU | C7 | `pass`, zero findings, judge agreement |

A separate custom rubric with only C8, “Require an internal approval reference,”
and input “Approval reference absent.” also returned `pass` and judge agreement.
The expected behavior is an unsupported-check state and human routing, not an
invented C8 violation.

The current 34 focused tests passed across heuristic, model-output reconciliation,
judge, and document status tests. These results establish test gaps, not general
model accuracy. Paid-model behavior has not been measured in this review.

Independent Luna review corroborated the coverage, contradiction, and absence-
evidence findings. It also identified narrow C4 sensitive-data phrase matching as
a candidate for a paraphrase evaluation matrix; this additional issue has not yet
been independently reproduced through the full pipeline by Codex.

## The product experience to build

### 1. Role home: a working inbox

Authors land on drafts and documents needing their attention. Officers land on
current decisions waiting for review. Leads see coverage gaps and operational
exceptions as well as volume. Auditors see searchable history with no write
controls. Avoid a single dashboard that gives every role the same priorities.

Queue rows show document, exact version/run, markets, highest severity, age,
owner, and next action. Search/filter/sort state belongs in the URL. Superseded
runs remain available in history and must not masquerade as the current request.

### 2. Intake: scope before submission

Use one focused editor with title, document text, selected markets, applicable
rubric version, and a concise scope explanation. Show a character limit and useful
validation before submission. Preserve edits after all recoverable failures.

For resubmission, carry forward the previous markets and show what changed.
Recovery should reopen the existing review rather than silently producing a
second copy. A stale or unavailable run should offer a specific recovery action.

### 3. Review workspace: evidence and action together

Desktop structure:

```text
Document title / v3 / run 2      UK + EU / rubric v4      Review history
Automated result: Needs review       Human decision: Awaiting officer

Document text                  Findings | Coverage | Changes
Highlighted claim              Selected finding
                               Rule, severity, evidence type
                               Explanation and proposed fix
                               Confirm / Dismiss / Needs investigation

Decision rationale             Request changes / Approve with rationale
```

This is a proposed layout, not a screenshot or implemented feature. On narrow
screens, use accessible Document / Review panels and preserve the selected finding
when switching. Finding selection must focus or scroll to its source. Repeated
quotes need separate occurrence identifiers rather than ambiguous anchors.

Coverage must distinguish assessed-without-issues, finding, not applicable,
uncertain, unsupported, and omitted. The engine, not UI inference from an empty
finding list, supplies these states. Historical runs lacking coverage metadata
show “Coverage detail unavailable for this run.”

Missing-language findings need an explicit evidence type. Quoting the first line
is context for an absence check, not proof that the quoted sentence violates a
rule. “Source provided” must not be represented as “Source verified” unless a
verification process actually occurred.

Decision controls should begin with findings unreviewed, make outstanding work
visible, and retain the rationale if recording fails. Whether explicit disposition
of every finding should be mandatory is a policy choice to settle in the build
plan; do not silently change the customer's approval policy.

### 4. History that explains what happened

Show every document version and every review run, with its rubric, markets,
reviewer mode, result, actor, and decision. Open a historical run directly from
the queue or audit view. Re-running must not conceal the previously approved or
rejected result. Compare findings by evidence and rule, not only criterion IDs.

### 5. A buyer-facing demonstration

Lead with the review workspace and the problem it solves. Offer a clearly labeled
synthetic sample that demonstrates finding, fixing, deciding, and inspecting
history. Keep demo identity controls separate from customer OAuth onboarding.
Use “Inspect a sample review” and “Open your workspace” where appropriate.
Do not add fake testimonials, accuracy claims, customer counts, prices, or
unsupported certifications.

## Implementation sequence and exact boundaries

1. **Trust foundation:** `src/schema.ts`, `src/agent/{run,model-reviewer,heuristic,judge,verdict}.ts`,
   `src/lib/rubric.ts`, prompts, and evaluations. Define coverage data and legacy
   behavior; add failing omission, contradiction, and masking cases before changes.
2. **Review workspace:** result/decision components, document detail, queue links,
   and store query helpers. Address exact runs and complete history; correct role
   affordances; introduce coverage and evidence navigation.
3. **Author workflow:** submit/resubmit pages and components, request handlers,
   execution helpers, progress, and recovery tests. Preserve scope and drafts;
   handle retries and interrupted responses deliberately.
4. **Product presentation:** shared UI/navigation/styles, queue/documents/dashboard,
   landing copy, and README. Apply one coherent system after the workflow behavior
   is reliable. Keep controls legible and reachable at 390px and 1440px.
5. **Independent review and acceptance:** Luna reviews changes; Codex reproduces
   findings and fixes agreed defects. Human approval remains required for merge.

Stable ownership is a parallel release requirement; this review does not authorize
running a database migration or editing deployment secrets. An isolated checkout
must start from the current local HEAD so the unpushed re-run work is included.
Use synthetic disposable storage for browser QA; do not boot against local .env
database credentials or reseed an existing database.

## Acceptance evidence

- The four missed-check reproductions no longer produce an unqualified pass.
- Reviewer contradictions and omitted criteria survive into the audit result.
- Scope changes never occur silently on resubmit.
- Queue item selection resolves to the exact requested run and version.
- Three runs of one version remain individually inspectable after a decision.
- An auditor sees no decision, resubmit, or rubric-edit controls.
- Retry after an execution failure does not create another document/version.
- Network interruption and reload recover state with a clear next action.
- Status labels use confirmed server state; finished reviews display immediately.
- Complete author/officer/admin/auditor journeys work with keyboard and narrow viewports.
- Existing tests, new regression tests, typecheck, and production build pass.
- Report browser checks, offline evaluations, and paid-model evaluations separately.

## Paid-pilot exit, beyond this code change

Validate the proposed segment with prospective buyers. Agree a customer-specific
rubric, ownership and approval policy, representative sanitized evaluation set,
and acceptance thresholds before claiming readiness for a paid pilot. Walk real
OAuth onboarding and restore rehearsal. Measure time to a documented decision,
missed findings, dismissals, and recovery failures; do not substitute a green
build or polished screenshot for those outcomes.
