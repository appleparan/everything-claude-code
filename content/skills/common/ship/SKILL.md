---
name: ship
description: End-to-end delivery workflow — plan the work, open a GitHub issue, create a worktree under .claude/, implement with TDD, make staged commits, run the project quality gate, open a PR from the worktree branch, then await merge before safe cleanup. When no forge CLI (gh/glab) is available, falls back to a local record mode using Change trailers and docs/changes/ documents. Use when the user asks to "ship" a feature/fix or wants the full deliver-to-PR flow.
---

# Ship

Take a unit of work from idea to merged PR using the project's isolated-worktree
workflow. This skill chains the full lifecycle and hands off to the `cleanup`
skill once the change is merged. When no forge is available, the same workflow
runs in **local record mode**: the issue and PR are replaced by an in-repo
record document and commit trailers.

## Prerequisites

- A clean working tree on `main` (or the repo's default branch).
- A clear description of the work to ship. If it is ambiguous, ask the user
  before proceeding.

## Delivery Mode

Determine the mode once, before starting, and keep it for the whole run:

- **Forge mode** — the remote is GitHub and `gh auth status` succeeds, or the
  remote is GitLab and `glab auth status` succeeds. Issues and PRs/MRs are the
  record. Do NOT add `Change:` trailers or `docs/changes/` files in this mode.
- **Local record mode** — no forge remote, or the forge CLI is missing or
  unauthenticated. The record lives in the repository itself:
  - Every commit in the change carries a `Change: CH-NNNN` trailer.
  - A record document `docs/changes/CH-NNNN-<slug>.md` replaces the issue and
    the PR body.

Trailer IDs — never commit hashes — are the stable reference for a commit
bundle: hashes change on rebase, while trailers survive both rebase and squash,
so the convention holds regardless of the repository's merge policy. Retrieval:

```bash
git log --oneline --grep '^Change: CH-0007'                     # one bundle
git log --format='%(trailers:key=Change,valueonly)' | sort -u   # all bundles
```

## Workflow

### 1. Plan the work

- Restate the actual problem, edge cases, risks, and affected areas.
- Decide Simple vs Complex scope:
  - 1–2 files, trivial → Simple (lightweight plan, no plan file).
  - 3+ files / cross-directory / risky → Complex.
- For Complex work, write `IMPLEMENTATION_PLAN.md` in the worktree root (after
  step 3) with staged goals, success criteria, tests, and status. It is an
  uncommitted working file — add it to `.git/info/exclude` in the worktree so
  staged commits never pick it up.
- Do NOT write code yet.

### 2. Create an issue (forge mode) or allocate a change ID (local record mode)

Forge mode:

```bash
gh issue create --title "<type>: <concise summary>" --body "<problem, approach, acceptance criteria>"
# GitLab: glab issue create --title "..." --description "..."
```

- Capture the returned issue number (`ISSUE`) for the branch and PR.

Local record mode:

- Allocate the next change ID: highest `CH-NNNN` in `docs/changes/` plus one
  (zero-padded to 4 digits; `CH-0001` if the directory does not exist yet).
- Use it as `CHANGE` (e.g. `CH-0007`) everywhere `ISSUE` would be used.

### 3. Create a branch and worktree under `.claude/`

Worktree is **always required**, even for Simple changes.

```bash
BRANCH="<type>/<short-description>"   # type ∈ feat|fix|refactor|docs|test|chore|perf|ci
WT=".claude/worktrees/${BRANCH//\//-}"
git worktree add "$WT" -b "$BRANCH"
cd "$WT"
```

- All subsequent steps run inside the worktree.
- Ensure `.claude/worktrees/` is git-ignored (it is via the repo's `.claude/`
  ignore entry); do not commit the worktree itself.

### 4. Implement with TDD

For each stage:

1. Write or update a failing test (RED).
2. Implement the minimal code to pass (GREEN).
3. Refactor (IMPROVE).
4. If no test infrastructure exists, document manual verification steps and
   outcomes instead.

### 5. Make staged commits

- Commit at the end of **every stage**, not all at once.
- Conventional format: `<type>: <description>`.
- Local record mode: append the change trailer to **every** commit:

```bash
git commit --trailer "Change: $CHANGE" -m "<type>: <description>"
```

- Never use `--no-verify`; never disable tests to make a commit pass.

### 6. Run the project quality gate

Run the repo's lint, format, type check, and test suite, e.g.:

```bash
uv run ruff format && uv run ruff check && uv run ty check && uv run pytest --cov   # Python
# or: bun run lint && bun run typecheck && bun test                                  # Node
```

- Detect the correct toolchain from the project (`pyproject.toml`,
  `package.json`, Makefile). All checks must pass before opening a PR.

### 7. Open a PR (forge mode) or finalize the record (local record mode)

**Get explicit user confirmation before creating the PR (or, in local record
mode, before merging into main).**

Forge mode:

```bash
git push -u origin "$BRANCH"
gh pr create --head "$BRANCH" --fill --body "Closes #$ISSUE

## Summary
<!-- 2-5 line TL;DR: what changed and why it matters, readable in 10s -->
## Why / approach
<!-- key decisions and trade-offs; don't restate the diff -->
## Test plan
- [ ] ..."
```

- Use `git diff main...HEAD` to draft the summary across all commits.
- Write conclusion-first (TL;DR → why → evidence) per the
  `writing-reports` rule; keep it readable in about a minute and put
  bulky detail behind a `<details>` block.
- Link the issue with `Closes #$ISSUE`.

Local record mode:

- Write `docs/changes/$CHANGE-<slug>.md` from `git diff main...HEAD` and commit
  it on the branch (with the trailer) as the final commit:

```markdown
# CH-0007: <type>: <concise summary>

**Date**: YYYY-MM-DD
**Branch**: <type>/<short-description>

## TL;DR
## Problem
## Approach & key decisions
## Test plan & results
```

- After the user confirms, merge following the repository's policy — rebase or
  fast-forward for linear-history repos, or `git merge --no-ff` where merge
  commits are welcome (bonus: `git log --first-parent main` then lists changes
  bundle-by-bundle). Put the record document's summary in the merge commit
  message when one exists.

### 8. Await merge, then safe cleanup

Forge mode:

- Report the PR URL and stop active work. Do not delete anything yet.
- Poll merge state when asked, or when the user confirms it merged:

```bash
gh pr view "$BRANCH" --json state,mergedAt
```

Local record mode:

- The user-confirmed merge in step 7 is the merge event; verify the branch is
  fully contained in `main` (`git log main..$BRANCH` prints nothing).

Then, in both modes:

- Invoke the **`cleanup`** skill to remove the worktree, delete the local
  branch, and pull `main`.
- Before removing `IMPLEMENTATION_PLAN.md`, record a summary (completed stages,
  key decisions, verification results) in the issue and PR — or in the
  `docs/changes/` document in local record mode.

## Output Contract

When invoked, report at the end:

1. Delivery mode, and the issue (number + URL) or change ID allocated
2. Branch and worktree path
3. Stages implemented and quality-gate result
4. PR created (URL), or record document path (`docs/changes/…`) — pending user
   confirmation
5. Merge/cleanup status (awaiting merge, or cleaned up)

## Safety Rules

- NEVER skip the worktree, even for trivial changes.
- NEVER create the PR — or merge into main in local record mode — without
  explicit user confirmation.
- NEVER bypass commit hooks (`--no-verify`) or disable failing tests.
- NEVER clean up before the change is confirmed merged.
- NEVER add `Change:` trailers or `docs/changes/` files in forge mode — on
  upstream contributions the PR is the record, and private conventions do not
  belong in someone else's repository.
- Stop and report after 3 failed attempts at any stage instead of continuing.
