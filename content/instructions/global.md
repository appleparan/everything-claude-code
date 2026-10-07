# Development Guidelines

## Language

- **Code, commits, PR/MR**: English
- **Conversation with user**: Korean

## Delegation

For coding tasks, hand implementation and exploration to subagents and
keep planning and review for yourself. Which model a subagent runs on
is set by the harness and its configuration, not by this file: the
"Harness" section below says how to spawn one and whether it can use a
cheaper model.

Tier mapping, for harnesses that name models explicitly, lives in the
`performance` rule (Model Catalog).

## Before Writing Code

Read the affected area first and match the project's existing
conventions, patterns, and idioms. If a local `CLAUDE.md` or style
guide exists, follow it. Verify assumptions against the code instead
of guessing.

## Git Workflow

- All work happens on a branch (`<type>/<short-description>`; types:
  feat, fix, refactor, docs, test, chore, perf, ci) in a git worktree
  under `.claude/worktrees/` — never edit the main checkout directly.
  Parallel sessions without isolation cause conflicts.
- Pull/rebase `origin/main` before starting doc or code work.
- Commit at the end of every meaningful stage, not all at once at the
  end.
- **Get explicit user confirmation before creating a PR/MR** (GitHub:
  `gh`, GitLab: `glab`). When no forge is available, the same rule
  applies to merging the branch into main.

## Planning

Plan before implementing: understand the actual problem, the affected
code, and the risks; prefer the simplest approach that works. For
non-trivial work, write the plan to `IMPLEMENTATION_PLAN.md` in the
worktree root and keep its status current. It is a working document
for agents to follow during the session — never commit it (add it to
`.git/info/exclude` if needed); the durable record of the work lives
in the issue/PR or the change's `docs/changes/` document. The `ship`
skill covers the full plan → issue → worktree → TDD → PR flow,
including the local record fallback when `gh`/`glab` are unavailable.

## Design Decisions

For architecture and design choices, present at least two options
with trade-offs and cost rationale, give a recommendation, and let
the user make the final call. Never state unverified external facts
(prices, quotas, SLAs, version-specific behavior) as certain — mark
them "needs verification" and back service specs and limits with
official documentation links.

## Writing (Documents, Slides, Technical Articles)

Applies to everything written for a human reader: PR/MR descriptions,
design docs, debugging reports, change records, slides, and technical
articles. Full guidance lives in the `writing-reports` rule.

- **Plain English, always.** Once installed, the `simple-english`
  skill is active in every session on every harness without being
  named (Codex: after a one-time `/hooks` trust). Its rules
  (short sentences, active voice, simple tenses, one word one meaning,
  condition before command, terms defined at first use) govern every
  document and reply; the points below govern structure.
- **Audience and purpose first.** Fix who will read it and what they
  must decide before writing a line; the piece answers the questions
  that reader would ask.
- **Conclusion first.** The answer goes in the opening lines of the
  document (a 2–5 line TL;DR for reports) and in the first sentence of
  every section. Background and process come after. A reader who stops
  after the opening must still leave with the correct conclusion.
- **Claim → reason → evidence.** Every paragraph follows that order and
  the structure repeats throughout. One claim per paragraph. Headings
  are claim sentences, not topic nouns.
- **Reasons don't overlap and are ranked.** When there are several,
  split them so each covers distinct ground, then order them by
  importance.
- **Evidence is verifiable only.** Numbers, sources, and reproducible
  facts. If none exists, write "no evidence" instead of inventing one.
- **End with "So what".** State the judgment the reader should make or
  the action they should take next.
- **Technical writing addresses objections and limits.** Spend at least
  a line each on the expected counterargument and on where the approach
  does not apply.
- **Length is a defect.** A piece too long to read will not be read: cut
  anything that doesn't change the reader's decision, avoid filler
  adjectives, and put bulky detail behind a `<details>` block or a link.

## Quality Gate

Use the project's own lint/format/type-check/test commands and run
them against the whole project, not single files. Write or update
tests for changed behavior when test infrastructure exists; otherwise
document manual verification steps and outcomes. Run long test
commands with explicit single-run flags (e.g. `vitest run`), never in
watch mode.

## Debugging

Base bug fixes on empirical evidence (logs, repro) before proposing a
root cause. State the hypothesis and test it before implementing the
fix.

- Present causes only as hypothesis + verification method, never as
  conclusions.
- Quote findings from logs/config verbatim with line numbers.
- Prefer read-only verification commands (describe, logs, get); ask
  before running anything that changes state.
- To revisit a hypothesis the user has ruled out, present new
  evidence first.
- Record ruled-out hypotheses with the evidence that eliminated them
  (e.g. "suspected DNS, but resolve times were normal — ruled out").
  The elimination trail shows systematic narrowing and matters as much
  as the answer itself.
- Once the root cause is found, include recurrence prevention — even
  one line (monitoring, alerting, config change). Debugging ends when
  the issue can't happen again, not when it's fixed.

## Safety

- Never include destructive commands (`rm -rf`,
  `git worktree remove --force`) in subagent prompts or automated
  steps; confirm with the user before any cleanup or deletion.
- Never bypass commit hooks (`--no-verify`), disable tests instead of
  fixing them, or commit code that doesn't compile.

## When Stuck

After 3 failed attempts, stop and report: what you tried and why it
failed, plus 2–3 alternative approaches. Ask for direction before
continuing.
