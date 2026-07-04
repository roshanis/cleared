# Compliance Rubric

> Template domain: financial-services marketing communications. Replace the
> criteria below with your actual policy — keep each criterion independently
> gradeable (a reviewer must be able to justify a finding with an exact quote,
> or the demonstrable absence of required language).

## Criteria

| ID | Severity | Criterion |
|----|----------|-----------|
| C1 | major    | The document contains a risk disclaimer equivalent to "past performance is not indicative of future results" AND states that investments may lose value. A C1 finding means the disclaimer is missing or materially weakened. |
| C2 | critical | The document makes no guarantee of investment performance or returns. Triggers include "guaranteed", "risk-free", "can't lose", or promising a specific future return rate. |
| C3 | major    | The document makes no comparative claim naming a competitor unless the claim cites substantiation (a dated study or published benchmark). |
| C4 | critical | The document does not request or expose sensitive personal data (SSN, full account numbers, passwords) through an unsecured channel such as email reply. |
| C5 | minor    | Any statement about fees or costs refers the reader to the full fee schedule (or Form ADV). C5 applies only when fees are mentioned. |

## Verdict rules

- `fail` — at least one critical or major finding.
- `needs_human_review` — only minor findings, or a reviewer flagged genuine uncertainty.
- `pass` — no findings.

## Severity definitions

- **critical** — regulatory exposure; must never ship.
- **major** — clear policy violation; must be fixed before shipping.
- **minor** — completeness or style issue; fix or escalate.
