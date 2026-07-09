# Cleared — Client Deployment Checklist

This checklist is the Phase-1 tenancy model. Each client gets their own
isolated Vercel project and Neon database. Walk it end-to-end for every new
client; client #3 onboarding should be boring.

---

## Prerequisites (collect before starting)

- [ ] Client's preferred admin email address (will become the first admin user).
- [ ] Google Cloud OAuth credentials for this deployment (see OAuth setup below).
- [ ] OpenAI API key scoped to this client's usage (recommended: one key per client).
- [ ] Vercel account with access to deploy from this repo.
- [ ] Neon account (Free or Launch plan — Launch recommended for 30-day PITR).

---

## 1. Create the Vercel project

1. Go to <https://vercel.com/new>.
2. Import the `eveagents` Git repository.
3. Set the **Framework Preset** to **Next.js**.
4. Leave **Root Directory** as the repo root.
5. Click **Deploy** — the first deploy will fail until env vars are set; that
   is expected. You will redeploy after completing the env var steps below.

Note the deployment URL (e.g. `https://client-name.vercel.app`).

---

## 2. Provision a Neon database

1. Go to <https://console.neon.tech> and click **New Project**.
2. Set the project name to something like `cleared-<client-name>`.
3. Choose the region closest to Vercel's deployment region.
4. Click **Create Project**.
5. Copy the **Connection string** (it looks like
   `postgres://user:password@host/dbname`).

### Enable PITR

PITR is enabled by default. Confirm the retention window:

1. In the Neon console, click **Settings → Storage**.
2. Confirm **Point-in-time restore** shows the expected retention window.
3. If the client requires 30-day retention, upgrade to the Launch plan.

See `docs/operations.md` for the full restore rehearsal procedure. Rehearse
once before the client's first day of use.

---

## 3. Set up Google OAuth credentials

1. Open [Google Cloud Console](https://console.cloud.google.com).
2. Create or select a project for this client.
3. Configure the **OAuth consent screen** (Internal or External, depending on
   the client's domain setup).
4. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**.
5. Choose **Web application**.
6. Under **Authorized redirect URIs**, add:
   - `https://<deployment-url>/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (for operator testing)
7. Click **Create**. Copy the **Client ID** and **Client Secret**.

---

## 4. Configure environment variables in Vercel

In the Vercel project settings, go to **Settings → Environment Variables**.
Add the following. All variables apply to **Production**, **Preview**, and
**Development** unless noted.

### Required variables

| Variable | Value | Notes |
|---|---|---|
| `AUTH_SECRET` | Random 32-byte hex string (`openssl rand -hex 32`) | Session signing key. Rotating this logs everyone out — see `docs/operations.md`. |
| `AUTH_GOOGLE_ID` | OAuth Client ID from Step 3 | Google OAuth client identifier. |
| `AUTH_GOOGLE_SECRET` | OAuth Client Secret from Step 3 | Google OAuth client secret. |
| `ADMIN_EMAIL` | Client's first admin email address | Bootstrap only. Used on the very first sign-in to create the admin user record. |
| `DATABASE_URL` | Neon connection string from Step 2 | Postgres connection string. The app bootstraps the schema automatically on first boot. |
| `OPENAI_API_KEY` | OpenAI API key | Required for model-mode reviews. Leave unset to run in heuristic demo mode only. |

### Recommended variables

| Variable | Recommended value | Notes |
|---|---|---|
| `OPENAI_MODEL` | `gpt-5.4` | Validated model for client deployments (see README). The default `gpt-5.4-mini` is demo-grade only and shows run-to-run variance. |
| `RATE_LIMIT_SUBMISSIONS` | `10` | Maximum document submissions per user per rate-limit window. |
| `RATE_LIMIT_WINDOW_MINUTES` | `10` | Rate-limit window in minutes. |
| `GLOBAL_MODEL_DAILY_CAP` | `200` | Maximum model-reviewer runs per UTC day across the whole deployment. Adjust to the client's expected volume. |
| `MAX_DOCUMENT_CHARS` | `50000` | Maximum document size in characters. Submissions over this limit are rejected with a clear error. |

### Variables that must NOT be set for client deployments

Do not set the following variables on client deployments. They enable the
public demo mode and would allow unauthenticated persona sign-in or bypass
production safety checks:

- `DEMO_AUTH` — must be unset (or `0`)
- `DEMO_PUBLIC` — must be unset (or `0`)
- `ALLOW_DEMO_DEPLOY` — must be unset
- `APP_ACCESS_CODE` — must be unset (only used with persona demo)

The production startup check (`instrumentation.ts`) will refuse to serve if
`DEMO_AUTH=1` or `DEMO_PUBLIC=1` is set without `ALLOW_DEMO_DEPLOY=1`.

---

## 5. Redeploy

After saving all env vars, trigger a new deployment:

1. In the Vercel dashboard, go to **Deployments**.
2. Click the three-dot menu on the latest deployment.
3. Click **Redeploy**.

The deployment will bootstrap the Postgres schema and seed the initial rubric
on first access automatically.

---

## 6. Bootstrap the first admin

1. Open the deployment URL in a browser.
2. Click **Sign in** and sign in with the Google account that matches
   `ADMIN_EMAIL`.
3. The app detects this is the first sign-in for that email and creates an
   active admin user record automatically.
4. You are now on the admin dashboard.

This happens exactly once. After the first sign-in, `ADMIN_EMAIL` has no
further effect and additional users must be invited from `/users`.

---

## 7. Smoke checklist

Walk through this end-to-end as a real user (not in demo mode) to confirm
the deployment is functional before handing it to the client.

### 7a. Health check

```sh
curl -s https://<deployment-url>/api/health | python3 -m json.tool
```

Expected response:

```json
{
  "ok": true,
  "storage": "postgres",
  "reviewerMode": "model",
  "schemaVersion": 3,
  "time": "<current UTC ISO timestamp>"
}
```

Confirm:
- [ ] `ok` is `true`
- [ ] `storage` is `"postgres"` (not `"memory"` — if memory, `DATABASE_URL` is not wired)
- [ ] `reviewerMode` is `"model"` (not `"heuristic"` — if heuristic, `OPENAI_API_KEY` is missing)
- [ ] `schemaVersion` is `3`

### 7b. Invite a user

1. Sign in as the admin (Step 6).
2. Go to `/users`.
3. Invite a test email with the **author** role.
4. Sign in as that email via Google OAuth.
5. Confirm the user can access the document submission page.
6. Confirm the user cannot access `/users` or `/dashboard` (author role only).

### 7c. Submit → verdict → officer decision → audit export

Perform the following as the roles indicated:

**As an author (the invited test user):**

1. Go to **Submit** and paste a short document (any text, 100–500 chars).
2. Select a jurisdiction and click **Submit for review**.
3. Wait for the review to complete (10–30 seconds for model mode).
4. Confirm the run reaches `done` status with a verdict displayed.

**As an officer (invite a second test user with the officer role):**

5. Go to **Queue**.
6. Find the pending document.
7. Accept or dismiss findings, add a mandatory decision note, and click
   **Approve** or **Reject**.
8. Confirm the decision is saved and the document moves out of the queue.

**As an admin:**

9. Go to **Dashboard**.
10. Confirm the review count and metrics reflect the activity.
11. Go to `/api/export` and download the audit CSV.
12. Open the CSV and confirm it contains the submission, run, and decision rows.

---

## 8. Hand off to client

Once the smoke checklist is complete:

1. Share the deployment URL with the client.
2. Invite the client's actual admin and officer emails from `/users`.
3. Deactivate or remove the test accounts used in Step 7b/7c.
4. Document the `ADMIN_EMAIL` and Neon project name in the client's ops record.
5. Schedule the first restore rehearsal per `docs/operations.md`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Health endpoint returns `"storage": "memory"` | `DATABASE_URL` not set or malformed | Verify the Neon connection string in Vercel env vars and redeploy |
| Health endpoint returns `"reviewerMode": "heuristic"` | `OPENAI_API_KEY` not set | Add the key in Vercel env vars and redeploy |
| Sign-in redirects to login with "not invited" | Email not in the user records | Invite the email from `/users`, or set `ADMIN_EMAIL` and redeploy if it is the first admin |
| Production startup fails with demo-mode error | `DEMO_AUTH` or `DEMO_PUBLIC` is set | Remove those env vars (they must not be set for client deployments) |
| Reviews fail with error status | OpenAI API key invalid or rate-limited | Check the OpenAI dashboard for key validity and usage; rotate if needed (`docs/operations.md`) |
| Schema version is not 3 | Database was created from an older schema | The migration runs automatically on first boot; check Vercel function logs for errors |
