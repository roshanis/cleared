# Cleared — Operations Runbook

This document covers backup posture, point-in-time restore rehearsal, and
secret rotation for a production Cleared deployment on Vercel + Neon.

---

## Backup posture

Each client deployment uses a dedicated Neon project (one project per client,
per `docs/client-onboarding.md`). Neon Postgres provides:

- **Continuous WAL-based backup** — every write is streamed to object storage.
- **Point-in-time restore (PITR)** — restore to any second within the retention
  window (7 days on the Free plan; 30 days on Launch and above).
- **Branch snapshots** — create an instant zero-copy branch from any commit
  point for safe restore rehearsal without touching production.

The app writes durable state only to Postgres (`DATABASE_URL`). The in-process
SQLite file is for local development and is not used in production.

### Enabling PITR on a Neon project

PITR is enabled automatically on all Neon plans. To confirm it is active and
to inspect the retention window:

1. Open the Neon console: <https://console.neon.tech>
2. Select the project for this client.
3. Click **Settings** in the left sidebar.
4. Click **Storage**.
5. Confirm **Point-in-time restore** shows a retention window (e.g. "7 days").
   If you are on the Free plan and need a longer window, click **Upgrade** and
   select the Launch plan (30-day retention).

---

## Point-in-time restore rehearsal

**Rehearse this procedure on a throwaway branch before you ever need it for
real.** Follow these steps:

### Step 1 — Note a restore target time

In the Neon console, note the approximate UTC time you want to restore to.
For a rehearsal, pick a time a few minutes ago.

Format: `YYYY-MM-DDTHH:MM:SSZ` (e.g. `2026-07-07T10:00:00Z`).

### Step 2 — Create a restore branch in the Neon console

1. In the Neon console, select the client project.
2. Click **Branches** in the left sidebar.
3. Click **New Branch**.
4. Set **Branch name** to something like `restore-rehearsal-YYYYMMDD`.
5. Under **Branch from**, select the `main` branch.
6. Under **Include data up to**, choose **Specific date and time** and enter
   your restore target time (UTC).
7. Click **Create Branch**.

Neon creates the branch instantly from the WAL archive — no downtime on
the production branch.

### Step 3 — Inspect the restore branch

Connect to the restore branch using its connection string (shown in the Neon
console under the branch's **Connection Details**):

```sh
psql "<restore-branch-connection-string>"
```

Confirm the data looks as expected at the restore point:

```sql
-- Check the most recent run in the restored database
SELECT id, status, created_at FROM runs ORDER BY created_at DESC LIMIT 5;

-- Check the schema version
SELECT value FROM meta WHERE key = 'schema_version';
```

### Step 4 — Promote (only if this is a real incident, not a rehearsal)

If you need to promote the restore branch to production:

1. Update the Vercel environment variable `DATABASE_URL` to the restore
   branch's connection string.
2. Redeploy the Vercel project (or trigger a serverless function restart).
3. The app will connect to the restored database on the next request.

For a rehearsal, skip Step 4 and delete the branch when done:

1. In the Neon console, click **Branches**.
2. Find the rehearsal branch, click the three-dot menu, and select **Delete**.

### Step 5 — Confirm production is unaffected

After a rehearsal, verify the production branch is unchanged:

```sh
psql "<production-connection-string>"
```

```sql
SELECT value FROM meta WHERE key = 'schema_version';
SELECT count(*) FROM runs;
```

---

## Secret rotation runbooks

### AUTH_SECRET — session signing key

> **WARNING:** Rotating `AUTH_SECRET` immediately invalidates ALL active
> sessions. Every signed-in user will be logged out and redirected to the
> sign-in page on their next request. Schedule the rotation during a low-traffic
> window and communicate it to users in advance.

**Steps:**

1. Generate a new random secret (at least 32 bytes):
   ```sh
   openssl rand -hex 32
   ```

2. In the Vercel dashboard for this deployment:
   - Go to **Settings → Environment Variables**.
   - Find `AUTH_SECRET` and click **Edit**.
   - Paste the new value and click **Save**.

3. Trigger a redeployment (click **Deployments → Redeploy** on the latest
   deployment, or push a commit).

4. Confirm all users can sign in again via the OAuth flow.

5. Shred the old secret — do not keep it anywhere.

**Effect:** All existing browser cookies signed with the old secret are invalid.
OAuth sessions resume on next sign-in. Demo persona sessions (if enabled) also
reset.

---

### AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET — OAuth credentials

Rotate when a Google Cloud project is compromised, when the OAuth client
is scheduled for key rotation by policy, or when credentials are suspected
exposed.

**Steps:**

1. Open [Google Cloud Console](https://console.cloud.google.com).
2. Navigate to **APIs & Services → Credentials**.
3. Find the OAuth 2.0 Client ID for this deployment.
4. Click the client, then click **Reset Secret** (or create a new client and
   delete the old one).
5. Copy the new **Client ID** and **Client Secret**.

6. In the Vercel dashboard:
   - Update `AUTH_GOOGLE_ID` to the new client ID.
   - Update `AUTH_GOOGLE_SECRET` to the new client secret.
   - Save both.

7. Trigger a redeployment.

8. Verify OAuth sign-in works: sign in as a test user and confirm the session
   is established.

**Effect:** Users already signed in are unaffected (their sessions are still
valid as long as `AUTH_SECRET` is unchanged). New sign-ins and token refreshes
use the new credentials.

---

### OPENAI_API_KEY — model reviewer

Rotate when the key is suspected compromised or as scheduled by your key
management policy. The app continues to function during rotation (in-flight
reviews that error out during the window will show the retryable error state;
users can resubmit once the new key is live).

**Steps:**

1. In the [OpenAI dashboard](https://platform.openai.com/api-keys):
   - Click **Create new secret key**.
   - Copy the new key immediately — it is shown only once.
   - Note the old key name.

2. In the Vercel dashboard:
   - Update `OPENAI_API_KEY` to the new key.
   - Save.

3. Trigger a redeployment.

4. Verify model mode works: submit a short document and confirm the review
   runs through the model pipeline (check the run status reaches `done`).

5. In the OpenAI dashboard, revoke the old key.

**Effect:** The 60–90s gap between saving and redeployment means some requests
may use the old key and some the new. Both should succeed unless the old key
was already revoked.

---

## Monitoring and alerting

- The `/api/health` endpoint (`GET`, no auth) returns `{ ok: true, storage,
  reviewerMode, schemaVersion, time }`. Point your uptime monitor (e.g. BetterUptime,
  UptimeRobot) at `https://<deployment-url>/api/health` with an HTTP 200 check.
- OpenAI enforces a monthly spend cap. Set a hard limit in the
  [OpenAI billing settings](https://platform.openai.com/account/limits) as a
  billing guardrail independent of the app's daily cap.
- Neon sends email alerts for storage approaching quota. Configure alerts
  under **Settings → Alerts** in the Neon console.
