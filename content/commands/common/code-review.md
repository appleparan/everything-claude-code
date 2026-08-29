# Code Review

Comprehensive security and quality review of uncommitted changes:

1. Launch a Codex parallel review when available (see below), then get
   changed files: git diff --name-only HEAD

2. For each changed file, check for:

**Security Issues (CRITICAL):**

- Hardcoded credentials, API keys, tokens
- SQL injection vulnerabilities
- XSS vulnerabilities  
- Missing input validation
- Insecure dependencies
- Path traversal risks

**Code Quality (HIGH):**

- Functions > 50 lines
- Files > 800 lines
- Nesting depth > 4 levels
- Missing error handling
- console.log statements
- TODO/FIXME comments
- Missing JSDoc for public APIs

**Best Practices (MEDIUM):**

- Mutation patterns (use immutable instead)
- Emoji usage in code/comments
- Missing tests for new code
- Accessibility issues (a11y)

1. Generate report with:
   - Severity: CRITICAL, HIGH, MEDIUM, LOW
   - File location and line numbers
   - Issue description
   - Suggested fix

2. Block commit if CRITICAL or HIGH issues found

Never approve code with security vulnerabilities!

## Codex Parallel Review

When the Codex CLI and the openai-codex plugin are both installed, run
a Codex review in parallel with your own checklist review and merge
the findings. Detect availability first:

```bash
command -v codex >/dev/null 2>&1 \
  && ls ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs >/dev/null 2>&1 \
  && echo "codex review available"
```

**If available** — before starting your own review, launch Codex as a
background Bash task (`run_in_background: true`) so both reviews run
concurrently:

```bash
bun "$(ls -d ~/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs | sort -V | tail -1)" review --wait
```

Then perform your own checklist review while Codex runs, collect the
Codex output when it finishes, and produce a single merged report:

- Order all findings by severity (CRITICAL first), regardless of
  which reviewer found them.
- Tag each finding with its source: `[Claude]`, `[Codex]`, or
  `[Both]` when the same issue was flagged twice (deduplicate into
  one entry).
- Apply the same blocking rules to Codex findings: CRITICAL or HIGH
  blocks the commit no matter the source.
- Report Codex findings faithfully; do not drop or soften them.

**If unavailable or Codex fails** — proceed with the Claude-only
review exactly as described above and add one line to the report:
`Codex unavailable — Claude-only review`. Never fail or delay the
review because Codex could not run. For manual, user-driven Codex
reviews use `/codex:review` or `/codex:adversarial-review` instead.
