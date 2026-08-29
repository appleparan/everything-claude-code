---
description: Generate a structured postmortem/decision record — final decision with rationale, rejected alternatives and excluded hypotheses with evidence, recurrence prevention, and verification record.
---

# Infra Postmortem / Decision Record

This command produces a structured markdown document capturing an
infrastructure design decision or a debugging session's outcome,
built entirely from what actually happened in the session.

## What This Command Does

Assembles the record from the session's real work — the options that
were explored, what the human decided, what was ruled out and why,
and what was verified along the way. It does not invent entries: any
detail that wasn't actually established in the session is marked
"needs verification" rather than filled in with a plausible value.

## Output Sections

1. **Summary** — one paragraph: what was being decided or debugged,
   and the outcome.
2. **Final decision + rationale** — what the human decided (design
   choice, or root cause), and why, in the human's own reasoning.
3. **Rejected alternatives / excluded hypotheses** — every option or
   hypothesis that was ruled out, each with the evidence or reason
   for exclusion. Follow the exclusion-with-evidence rule from
   [infra-debugging.md](../../rules/infra/infra-debugging.md).
4. **Verification record** — a table of every number, quota, limit,
   price, SLA, spec, or interpretation used, marked either "verified
   against official docs/source" (with the source) or "needs
   verification". See
   [infra-verification.md](../../rules/infra/infra-verification.md).
5. **Recurrence prevention** — required for debugging postmortems:
   monitoring/alerting to add, runbook updates, any process change
   that would catch this earlier next time. Omit for pure design
   records where nothing recurred.
6. **Timeline** — optional: key events in order (when useful for
   incident postmortems; skip for design decision records where it
   adds no value).

## When to Use

- After a debugging session concludes with a confirmed root cause.
- After a design decision is finalized, to record why the chosen
  option won and what was rejected.

## Rules

- Content comes only from the session's actual work. No fabricated
  entries, no invented timeline events, no assumed rationale.
- Anything unknown or unconfirmed gets "needs verification" — never
  an invented value standing in for it.
- This command drafts the record; the human reviews and confirms it
  before it's treated as final, per
  [infra-collaboration.md](../../rules/infra/infra-collaboration.md).

## Related

- Rule: `rules/infra/infra-debugging.md`
- Rule: `rules/infra/infra-verification.md`
- Rule: `rules/infra/infra-collaboration.md`
