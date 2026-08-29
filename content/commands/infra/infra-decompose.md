---
description: Validate the user's own problem decomposition or hypothesis list for gaps, ordering problems, and missing completion criteria — never replaces it with a new decomposition.
---

# Infra Decompose Check

This command validates a decomposition or hypothesis list the user has
already written. It never produces a replacement decomposition.

## What This Command Does

Takes the user's own input as-is:

- a **design decomposition** (pieces of an infrastructure change, each
  with a completion criterion), or
- a **debugging hypothesis list** (candidate root causes, ideally
  already ordered).

Then checks it for:

1. **Missing pieces**
   - Would the task collapse if any one piece were removed? If yes,
     that piece is load-bearing and its absence (or an unstated
     dependency on it) is a gap.
   - For design tasks: are availability, security, cost, and
     scalability each covered somewhere in the decomposition?
   - For debugging tasks: are all layers covered — recent changes,
     resources, network, dependent services, application?
2. **Ordering issues**
   - Hypotheses: are they ordered cheapest-to-verify first?
   - Design pieces: are they ordered by dependency (a piece that
     depends on another comes after it)?
3. **Missing completion criteria**
   - Does each design piece have a one-line "done when" criterion?
   - Does each hypothesis have a stated check method (a read-only
     command or log location)?

## When to Use

- Before starting implementation on a multi-piece infrastructure
  change, to catch gaps while they're still cheap to fix.
- Before starting a debugging session, to catch missing layers or a
  bad verification order before time is spent on expensive checks.

## Output

A numbered list of gaps and ordering issues **only**, each with a
one-line reason. No other commentary, no proposed fix, no rewritten
decomposition.

```text
1. Missing: no piece addresses rollback — if the new node pool fails
   health checks, there's no stated path back.
2. Ordering: hypothesis "app bug" is checked before "recent deploy",
   but the deploy check is cheaper (a `git log` vs. reading app code).
3. Missing completion criterion: piece "configure autoscaling" has no
   stated "done when" condition.
```

## Explicit Rules

- Do not produce your own decomposition or hypothesis list, and do
  not silently substitute one for a piece you think is missing —
  name the gap and stop.
- If the input is missing entirely (the user asks to run this
  command with nothing to check), ask the user to write their
  decomposition or hypothesis list first.
- Follow the role boundary in
  [infra-collaboration.md](../../rules/infra/infra-collaboration.md).

## Related

- Rule: `rules/infra/infra-collaboration.md`
- Rule: `rules/infra/infra-debugging.md`
- Agent: `agents/infra/infra-red-team.md`
