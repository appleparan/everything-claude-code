# Writing Reports and Documents

Applies to anything written for a human reader: PR/MR descriptions,
design docs, debugging reports, `docs/changes/` records, review
summaries, end-of-task reports in chat, slides, and technical
articles.

## Principles

These hold for every document type; the sections below apply them to
reports.

1. **Audience and purpose first.** Before writing, fix who will read
   the piece and what they must decide or do with it. Write it as the
   answers to the questions that reader would ask, in the order they
   would ask them.
2. **Conclusion first, everywhere.** The answer goes in the opening
   lines of the document and in the first sentence of every section;
   background and process follow. Someone who reads only the openings
   still gets the right conclusion.
3. **Claim → reason → evidence.** Every paragraph follows that order,
   and the structure repeats from paragraph to paragraph so the reader
   never has to hunt for the point.
4. **One claim per paragraph, headings as claims.** A paragraph that
   makes two claims becomes two paragraphs. A heading is a full claim
   sentence ("Caching cuts p99 latency by half"), not a topic noun
   ("Caching").
5. **Reasons don't overlap and are ranked.** When several reasons
   support a claim, split them so each covers distinct ground, then
   order them by importance so the reader can stop early.
6. **Evidence is verifiable only.** Numbers, sources, and reproducible
   facts count; impressions and adjectives do not. When no evidence
   exists, write "no evidence" rather than inventing or implying one.
7. **End with "So what".** Close by stating the judgment the reader
   should make or the action they should take next.
8. **Technical writing addresses objections and limits.** Spend at
   least a line each on the strongest expected counterargument and on
   the conditions under which the approach does not apply.

## Language: Plain English via the `simple-english` Skill

Every document is written in plain English under the `simple-english`
skill, which is active in every session on every harness without being
named (Claude Code and Codex load it through the plugin's session hook;
pi through the `simple-english` extension; OpenCode through the
`simple-english` plugin). The skill governs wording; this rule governs
structure.

- Draft under its rules from the first line, not as a polish pass.
- Run its check mode on the finished draft and fix what it flags.
- Code, identifiers, commands, paths, quoted errors, and facts stay
  untouched, as the skill itself requires.

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
- **Slides**: one claim per slide, written as the slide title; the
  body holds only the reason and evidence for that claim. The final
  slide is the "So what".
- **Technical article**: the claim and its So what in the opening
  paragraph, then reasons in importance order with evidence under
  each, then objections and limits before the close.
