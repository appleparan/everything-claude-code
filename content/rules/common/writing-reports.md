# Report Writing

Applies to anything written for a human reader: PR/MR descriptions,
design docs, debugging reports, `docs/changes/` records, review
summaries, and end-of-task reports in chat.

## Structure: Conclusion First

Order every report as a pyramid — each layer complete on its own, the
next layer only adding depth:

1. **TL;DR** (2–5 lines, always at the top): what changed / what was
   decided / what the root cause is, and its impact on the reader.
2. **Why**: the reasoning — approach taken, key decisions, trade-offs
   considered and rejected.
3. **Evidence**: logs, benchmark numbers, repro steps, links, raw
   output — detail the reader drills into only when they need it.

A reader who stops after the TL;DR must still walk away with the
correct conclusion. A reader who wants to verify it must find the
evidence below, not have to ask for it.

## Verbosity Discipline

A report that is too long to read will not be read — length is a
defect, not thoroughness.

- Cut anything that does not change the reader's decision or next
  action.
- Don't restate the diff or paste walls of code; state what the change
  means and link or reference the rest.
- Prefer one well-chosen example over three; prefer a sentence over a
  bullet list that says the same thing.
- No filler adjectives ("comprehensive", "robust", "significantly
  improved") and no repeating a point across sections.
- Put bulky but necessary detail (full logs, long tables) behind a
  `<details>` block or a link, never inline above the conclusions.
- Target: the whole report readable top-to-bottom in about a minute;
  a PR body's Summary section in ten seconds.

## Per Document Type

- **PR/MR description**: Summary (TL;DR) → why / approach and key
  decisions → test plan and evidence.
- **Design doc**: recommendation and decision first, then the options
  with trade-offs, then background and constraints.
- **Debugging report**: root cause and fix first, then the hypothesis
  trail (including ruled-out hypotheses and what eliminated them),
  then the raw evidence.
