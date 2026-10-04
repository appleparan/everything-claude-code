# Performance Optimization

## Model Selection

Use model aliases (`haiku`, `sonnet`, `opus`, `fable`) in agent
frontmatter and configs where possible, not pinned version strings —
aliases track the current generation automatically.

- **haiku**: lightweight, high-frequency work — worker agents in
  multi-agent systems, quick classification and triage
- **sonnet**: default for main development work — strong coding at
  balanced cost and latency
- **opus**: deep reasoning — architectural decisions, complex
  debugging, research and analysis
- **fable**: highest-capability tier for the most demanding reasoning —
  but not strictly better than opus everywhere: for coding and agentic
  work the newer Opus generation often matches or beats it at half the
  cost. Prefer `opus` as the default; reach for `fable` when your own
  evals show it wins

## Model Catalog

Current generations, for when an explicit model must be named.
Pricing is $ per MTok (input / output).

### Claude (Claude Code, Anthropic API)

| Model | Alias | Tier | Pricing | Notes |
|-------|-------|------|---------|-------|
| Claude Fable 5 | `fable` | Frontier | $10 / $50 | Highest-capability tier; thinking always on. Not strictly ahead of Opus 5 on coding/agentic — compare on your workload |
| Claude Opus 5 | `opus` | Flagship | $5 / $25 | Recommended default for coding and long-horizon agentic work; drop-in upgrade from Opus 4.8 |
| Claude Opus 4.8 | — | Previous flagship | $5 / $25 | Recommended fallback for Opus 5 / Fable 5 refusals |
| Claude Sonnet 5 | `sonnet` | Balanced | $3 / $15 | Near-Opus coding quality at Sonnet cost |
| Claude Sonnet 4.6 | — | Previous balanced | $3 / $15 | |
| Claude Haiku 4.5 | `haiku` | Fast/cheap | $1 / $5 | Worker agents, triage |

### OpenAI (Codex)

The global CLAUDE.md is also installed as `~/.codex/AGENTS.md`, so
Codex sessions share these guidelines. Codex model IDs go in
`~/.codex/config.toml` (`model = "gpt-6-astra"`) or via
`codex -m <id>`. GPT-5.6 tiers GA since 2026-07-09; GPT-6 Astra is the
frontier tier above them.

| Model | ID | Tier | Pricing | Notes |
|-------|----|------|---------|-------|
| GPT-6 Astra | `gpt-6-astra` | Frontier | $10 / $50 (needs verification) | Codex counterpart of Fable: planning, review, hard problems. Subagents must not inherit it for routine work |
| GPT-5.6 Sol | `gpt-5.6-sol` | Flagship | $5 / $30 | Complex, ambiguous, high-value work; supports max reasoning effort and ultra mode (subagents) |
| GPT-5.6 Terra | `gpt-5.6-terra` | Balanced | $2.50 / $15 | Everyday workhorse for coding and tool use; default `worker` subagent |
| GPT-5.6 Luna | `gpt-5.6-luna` | Fast/cheap | $1 / $6 | Clear, repeatable tasks; default `explorer` subagent |

Astra pricing is from press coverage of the launch post
(<https://openai.com/index/gpt-6-astra/>); confirm on the OpenAI
pricing page before quoting it.

### Tier Mapping (Claude ↔ Codex)

Delegation is defined by role; the models below are how the Claude Code
and Codex targets pin each role. Harnesses where the user picks the
model in their own configuration (pi) ship agents without a model, so
subagents inherit the parent's model and this table does not apply.

| Role | Claude Code | Codex |
|------|-------------|-------|
| Parent: planning, review | `fable` / `opus` | `gpt-6-astra` |
| Deep reasoning subagent | `opus` | `gpt-5.6-sol` |
| Implementation subagent | `sonnet` | `gpt-5.6-terra` (`worker`) |
| Exploration / triage | `haiku` | `gpt-5.6-luna` (`explorer`) |

Codex enforcement lives in config, not prose: `targets/codex/install.sh`
installs `~/.codex/agents/{worker,explorer}.toml` (role files that pin
their `model`) and merges `[agents] default_subagent_model` into
`~/.codex/config.toml`. Without these, a spawned subagent inherits the
parent model. Resolution order is explicit spawn value, then the
`[agents]` default, then the parent (see
<https://learn.chatgpt.com/docs/agent-configuration/subagents>).

## Thinking Depth

Current models use adaptive thinking: the model decides when and how
deeply to think. Do not use manual thinking-trigger keywords
(`ultrathink`, "think harder") — control depth with the effort setting
instead, and use Plan Mode for structured multi-step work.

## Context Window Management

Avoid the last 20% of the context window for large-scale refactoring,
multi-file feature work, and complex debugging. Single-file edits,
documentation updates, and simple fixes are less context-sensitive.

Compact at natural phase boundaries (after exploration, before
implementation) rather than waiting for auto-compaction.

## Build Troubleshooting

If a build fails, use the **build-error-resolver** agent: analyze the
errors, fix incrementally, and verify after each fix.
