# ROADMAP — Cleared from demo to 10,000 users

> Three go-live milestones: **100 users** (first paying clients), **1,000
> users** (multi-tenant product), **10,000 users** (enterprise platform).
> Each phase lists gates across six lenses — cost, utilization, security,
> user management, teams, clients — and a "definition of live" checklist.
> Baseline is the app as it exists today (see README.md and
> GOAL-HARDENING.md).

## Where we are today

- Next.js 15 on Vercel; Postgres (Neon) / SQLite / in-memory via a driver
  seam (`src/lib/db/`). Tables: rubrics, documents, versions, runs,
  decisions. **No users, orgs, or teams tables** — identity is four
  hardcoded demo personas signed with an HMAC cookie.
- Review pipeline: two model reviewer subagents (`gpt-5.4-mini` via the
  Vercel AI SDK) merged and scored deterministically in `src/agent/`;
  free heuristic fallback in demo mode. Golden-set eval gate on rubric
  publish.
- Roles (`author`/`officer`/`admin`/`auditor`) and `requireRole()` are
  real and carry over to any identity provider unchanged.
- Known gaps (GOAL-HARDENING.md): auth is decorative, no rate limiting,
  long-running review routes depend on `maxDuration = 300`, model path
  failure modes need exercising.

**Cost model used throughout** (verify with `npm run eval` in model mode):
one review ≈ 2 model calls ≈ ~8K tokens in + ~2K out ≈ 10K tokens. At
mini-tier pricing (assumed ~$0.20–0.60 blended per 1M tokens — confirm
current rates), **1,000 reviews ≈ $2–6**. Model spend is not the scary
cost at any phase below; audits, pen tests, and SSO licensing are.

---

## Phase 1 — Live with 100 users (1–3 design-partner clients)

Target shape: one deployment per client (simplest tenant isolation —
defer multi-tenancy), ~30–40 weekly-active authors, ~200 reviews/day.

### Security (blocks go-live)
- [ ] Replace persona auth with a real identity provider (Auth.js with an
      OIDC provider, or Clerk/WorkOS). Keep the four-role model; every
      `requireRole()` call site is already correct.
- [ ] Finish GOAL-HARDENING P0s: exercise the real model path end-to-end;
      restructure long reviews to background execution + status polling so
      a review survives function timeouts; every provider failure surfaces
      as an honest `error` state.
- [ ] Rate limiting + input size caps on submit/execute routes (none exist
      today). Per-user and per-IP.
- [ ] Secrets hygiene: `AUTH_SECRET`/`OPENAI_API_KEY` only in Vercel env,
      documented rotation; `DEMO_PUBLIC`/`DEMO_AUTH` must be **unset** on
      client deployments — add a startup assertion that refuses to boot a
      production deploy in demo-auth mode.
- [ ] Postgres backups verified: Neon point-in-time recovery enabled, one
      restore actually rehearsed.
- [ ] Run `/security-review` on the branch; fix OWASP-class findings.

### User management
- [ ] `users` table (id, email, name, role, org, status) + invitation flow
      (admin invites by email, no self-signup). Sessions reference user id,
      not persona slug.
- [ ] Admin screen: list users, change role, deactivate. Deactivation must
      kill live sessions.
- [ ] Every run/decision already records an actor — switch that to real
      user ids so the audit trail is trustworthy from day one.

### Teams & clients
- Deferred by design: one client = one Vercel project + one Neon database.
  Isolation is physical, onboarding is an env-var checklist (write it
  down as `docs/client-onboarding.md`). Acceptable up to ~5 clients.

### Cost (~$100–250/mo total, per-client marginal cost ≈ $25–50/mo)
| Item | Est. |
|---|---|
| Vercel Pro (team) | $20/seat/mo |
| Neon Postgres (Launch, per client) | ~$5–25/mo |
| Model spend (~4–5K reviews/mo) | ~$10–30/mo |
| Sentry/monitoring free tiers | ~$0 |

### Utilization
- [ ] Instrument the metrics that prove the product works: reviews per
      author per week, time-to-first-verdict, time-to-officer-decision,
      % of runs routed to human, model error rate. `src/lib/metrics`
      exists — extend it, and check it weekly with design partners.
- [ ] Record real model latency (p50/p95) in README as GOAL-HARDENING asks.

### Definition of live (Phase 1)
Real IdP; no demo flags in prod; rate limits on; backups rehearsed;
model-mode golden set green; 3 clients onboarded via the checklist;
audit export shows real user identities.

---

## Phase 2 — 1,000 users (~10–30 clients, one codebase, one fleet)

Deployment-per-client stops scaling around 5–10 clients. This phase is
the multi-tenancy rebuild plus the trust artifacts regulated buyers
demand.

### Teams & clients (the core work)
- [ ] Multi-tenancy: `orgs` table; `org_id` on every entity; tenant
      scoping enforced **in the driver layer** (`src/lib/db/`) so a query
      without an org scope fails loudly — not ad hoc in routes. Migration
      script folds existing single-tenant databases into one cluster.
- [ ] Per-org rubrics and golden sets (the publish gate becomes per-org).
- [ ] `teams` within an org: team membership, queue partitioned by team,
      officers see their team's queue by default. Documents belong to a
      team; decisions roll up org-wide for auditors.
- [ ] Self-serve org onboarding for admins: create org → invite users →
      pick starter rubric. Kill the manual checklist.

### Security & compliance
- [ ] SSO (SAML/OIDC) + enforced MFA — compliance teams at regulated firms
      will make this a purchasing condition; some Phase-1 clients may force
      it earlier. WorkOS or Auth.js enterprise providers.
- [ ] Start SOC 2 Type I (Vanta/Drata ~$10–25K/yr + audit ~$15–30K).
      Buyers will ask before the 10th client does.
- [ ] Append-only audit log (no UPDATE/DELETE grants on decisions/runs),
      per-org data export and deletion (DPA/DSR obligations).
- [ ] Annual pen test (~$10–25K); dependency scanning + secret scanning
      in CI.
- [ ] Per-org rate limits and model-spend budgets (a runaway client can't
      exhaust the shared API quota).

### User management
- [ ] SCIM or directory-sync for the biggest clients (WorkOS covers this).
- [ ] Org-admin role separated from platform-admin (Priya's "admin" today
      conflates both).

### Cost (~$500–1,500/mo infra; compliance is the real line item)
| Item | Est. |
|---|---|
| Vercel Pro + compute | $100–300/mo |
| Neon Scale + pooling | $70–150/mo |
| Model spend (~40–50K reviews/mo) | $100–300/mo |
| Sentry + logs + uptime | $50–150/mo |
| WorkOS/Clerk SSO tier | $125–500/mo |
| SOC 2 tooling + audit + pen test | ~$35–75K/yr (amortized ~$3–6K/mo) |

At even $30/seat/mo pricing, 1,000 seats ≈ $30K MRR — infra is <5% of
revenue; compliance spend is the margin story. Meter per-org usage now so
Phase-3 pricing can include volume tiers.

### Utilization
- [ ] Background job queue for reviews (Inngest/QStash/Vercel Queues) —
      no review executes inside a request handler anymore. Retries,
      dead-letter, per-org concurrency caps.
- [ ] Dashboards: reviews/day per org, queue depth, decision SLA, token
      spend per org, model error/refusal rate. Alerting on p95 latency
      and error budget.
- [ ] Define and track activation (org is "live" = N reviews + M officer
      decisions in week 1) — drives onboarding fixes.

### Definition of live (Phase 2)
One production fleet serving all orgs with driver-level tenant scoping;
SSO available; SOC 2 Type I report in hand; reviews run via queue with
per-org budgets; org self-serve onboarding replaces the checklist.

---

## Phase 3 — 10,000 users (~100–300 clients, enterprise platform)

### Security & compliance
- [ ] SOC 2 Type II complete; DPAs standard; evaluate ISO 27001 if EU
      enterprise demand appears.
- [ ] Data residency option (EU project + EU Neon region) for clients that
      require it.
- [ ] Audit log streaming to client SIEMs; per-client retention policies.
- [ ] Model isolation options for the strictest clients: BYO API key, or
      routing to a private endpoint (e.g. Azure-hosted models) per org.
- [ ] Incident response process, status page, 99.9% SLA in contracts,
      on-call rotation.

### Teams & clients
- [ ] Custom roles/permissions beyond the four built-ins (map onto the
      existing `requireRole()` seam as permission checks).
- [ ] Rubric inheritance: platform starter rubrics → org rubrics → team
      overrides, all still versioned and golden-set gated.
- [ ] Client-facing usage/billing dashboards; volume-tier pricing backed
      by the Phase-2 metering.

### Utilization & architecture
- [ ] Move the review pipeline to dedicated workers with durable
      execution (the eve migration noted in README, or Temporal/Inngest) —
      the seam is `src/agent/run.ts` plus two API routes, as designed.
- [ ] Postgres: read replicas for dashboards/audit queries; partition or
      index-by-org the hot tables (runs, decisions); connection pooling is
      mandatory at this fan-out.
- [ ] Admission control: per-org concurrency + fair scheduling so one
      client's batch submit can't starve the queue.
- [ ] Consider a heuristic pre-pass to skip model calls on trivial
      resubmissions (diff-unchanged versions) — cuts spend without
      touching verdict auditability.

### User management
- [ ] SCIM everywhere; automated deprovisioning verified in audit trail.
- [ ] Platform-admin tooling: org lifecycle (suspend/export/delete),
      support impersonation with consent + audit entry.

### Cost (~$4–12K/mo infra; still <5% of revenue at this seat count)
| Item | Est. |
|---|---|
| Compute (Vercel Enterprise or hybrid workers) | $1–4K/mo |
| Postgres (Neon Business / replicas) | $700–2K/mo |
| Model spend (~400–500K reviews/mo) | $1–3K/mo |
| Observability + queue + SSO | $500–1.5K/mo |
| Compliance program (Type II, pen tests, DPO/counsel) | $8–15K/mo amortized |

### Definition of live (Phase 3)
Type II report; SLA-backed contracts; durable-execution pipeline; per-org
isolation options (keys/residency); fair-share scheduling proven under a
load test at 10× expected peak.

---

## Sequencing summary

| | 100 users | 1,000 users | 10,000 users |
|---|---|---|---|
| **Tenancy** | Deployment per client | Shared fleet, org_id everywhere | + residency, BYO-key isolation |
| **Auth** | Real IdP, invites | SSO + MFA, SCIM starts | SCIM everywhere, custom roles |
| **Pipeline** | Background exec + polling | Job queue, per-org budgets | Durable workers, fair scheduling |
| **Trust** | Backups + security review | SOC 2 Type I, pen test | SOC 2 Type II, SLA, SIEM export |
| **Infra cost** | ~$100–250/mo | ~$0.5–1.5K/mo | ~$4–12K/mo |
| **Real cost driver** | Engineering time | Compliance program | Compliance + support headcount |

The recurring theme: model spend stays cheap (mini-tier reviews are
fractions of a cent); what actually gates each phase is **identity, tenant
isolation, and trust artifacts** — start each one a phase before you need
it, because SOC 2 and SSO have quarters-long lead times.
