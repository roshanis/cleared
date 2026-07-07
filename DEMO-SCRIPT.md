# Cleared — the five-minute demo

> Presenter runbook. Every **Click** is a real control on the screen; every
> **Say** is one sentence. Rehearse out loud twice — the demo is
> deterministic, so it will do exactly this every time.

## Prep (5 minutes before, not during)

- [ ] Open `https://cleared-five.vercel.app` once to warm the instance,
      then close the tab. Never share or present a
      `cleared-xxxxxxxxx-…vercel.app` URL — those are login-walled.
- [ ] Fresh **private/incognito window** for the demo itself (no stale
      session cookie).
- [ ] Browser zoom 125–150% for a conference room; hide bookmarks bar.
- [ ] If the room asks "is this live?" — it is; that's Act I's point.

**Recovery move:** the demo database intentionally resets itself on fresh
server instances. If your submitted document vanishes mid-demo, say
*"The demo resets itself — watch how fast we get back"* and resubmit
(ten seconds). It plays as a feature, because it is one.

---

## Act I — the problem (45 seconds)

**Click:** open `cleared-five.vercel.app`.

**Say:** "Every customer-facing email at a financial firm waits days for
compliance review. Cleared makes that feedback instant — without taking
the decision away from compliance."

**Click:** scroll to the section titled **"This is not a screenshot."**

**Say:** "This review was produced by the real pipeline as the page
loaded — those highlighted quotes are the agent citing its evidence."

## Act II — the reveal (2 minutes — this is the demo)

**Click:** **Try the demo** → on the sign-in page, click **Maya Chen**.

**Say:** "Four personas, one click each — you'll meet the other three in a
minute." (Point at the strip under the nav: *Viewing as Maya Chen ·
author*.)

**Click:** the strip's hint **"Submit the sample document…"** → on the
submit page, **Try a sample document** → **Submit for review**.

*(The stages play: Document submitted → Policy reviewer reading → Risk
reviewer reading → Judge verifying quotes. Let them read it. ~3 seconds.)*

**Say (as the verdict lands):** "**Fail** — and look at *why*: exact
quotes." Read one aloud: *"guaranteed returns with zero risk."* "No score,
no vibes — evidence."

**Click:** **Draft fixes** (the teal button right under the findings).

**Say:** "The fix-it agent rewrites each violation — the old sentence
struck out, the compliant one underneath. Nothing is submitted; the author
stays in control."

**Click:** **Load into resubmit** → (note the badge: *Fix draft loaded —
review before submitting*) → **Submit for review**.

**Say (as it lands):** "**Pass.** The agent found it, the agent fixed it,
and a human approved every character. That's the whole product in ninety
seconds."

## Act III — the system (2 minutes)

**Click:** in the strip, **Switch seat → Devon** (compliance officer,
lands on the queue).

**Say:** "Authors get speed; compliance keeps authority. Here's Devon's
queue — the AI never approves anything on its own."

**Click:** **Review** on the top queue item → accept or dismiss each
finding → **Reject document**, type a note (e.g. *"Agree with all
findings — returned to the author."*).

**Say:** "It won't let him decide without a note — every override is on
the record."

**Click:** **Switch seat → Priya** (compliance lead) → nav **Rubric** →
**Save as draft** → **Run golden gate**.

**Say:** "The rules live here, versioned. And look at the **Publish draft**
button — it is literally disabled until the golden gate passes. She cannot
ship a rubric that breaks the known test cases."

**Click:** **Switch seat → Sam** (auditor, lands on the audit log) →
point at Devon's decision at the top → **Export audit CSV**.

**Say:** "Everything you just watched — verdicts, quotes, Devon's note,
rubric versions — is already an audit trail. One click, it's a CSV."

## One more thing (30 seconds)

**Click:** **Switch seat → Maya** → open the fixed document's resubmit
form (nav **Submit**, or *My documents* → the sample → resubmit path with
the passing text) → under **Target markets**, click **UK** so both US and
UK are selected → **Submit for review**.

**Say (as the chips land):** "Same document. **US · Pass. UK · Fail** —
the UK requires a capital-at-risk warning this email doesn't have. One
pipeline, per-market verdicts. And yes —" (point at **Draft fixes**) "— it
can fix that one too."

---

## If someone asks…

- **"Is it using GPT live?"** — "This demo runs the deterministic pipeline
  so it's perfectly repeatable; the same code runs model reviewers in
  production — same rubric, same judge, same audit trail."
- **"What stops the AI from approving something bad?"** — "It can't
  approve anything. Verdicts route to Devon; the judge agent challenges
  weak findings; disagreements go to a human. Agents propose, code
  disposes."
- **"Can I try it?"** — send them the link. Four seats, no password:
  that's the demo.
