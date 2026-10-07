# Everything Claude Code

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Shell](https://img.shields.io/badge/-Shell-4EAA25?logo=gnu-bash&logoColor=white)
![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/-Python-3776AB?logo=python&logoColor=white)
![Markdown](https://img.shields.io/badge/-Markdown-000000?logo=markdown&logoColor=white)

A curated collection of Claude Code configurations — agents, skills, commands,
rules, and hooks — installable per language into **Claude Code** (`~/.claude`),
**Codex CLI** (`~/.codex`), **pi** (`~/.pi/agent`), and **OpenCode**
(`~/.config/opencode`) from a single shared content tree.

This is a fork of
[affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code),
restructured around a script-based, multi-target install flow:

- **Single source of truth**: all shared content lives in a target-neutral
  `content/` tree; per-tool install logic lives in `targets/<target>/`.
- **Script install, not plugin install**: `./scripts/install.sh` copies exactly
  the languages you ask for, shows dry runs, and merges hooks safely.
- **Codex CLI support**: the same content installs into `~/.codex`
  (`AGENTS.md`, instructions, skills, MCP servers).
- **pi support**: the same content installs into `~/.pi/agent` (`AGENTS.md`,
  instructions, skills, prompts, subagents, a safety extension).
- **OpenCode support**: the same content installs into `~/.config/opencode`
  (`AGENTS.md`, instructions, skills, commands, subagents, ask-before shell
  rules).

---

## Installation

### Requirements

- `bash`, `git`
- `jq` — merging hooks from multiple languages into `settings.json`, and
  preserving non-hook keys when overwriting an existing `settings.json`
- Node.js — hook runtime scripts and the test suite
- [`uv`](https://docs.astral.sh/uv/) — only for the Codex `config.toml`
  merges ([agents] defaults and, with `-m`, MCP servers); skipped with a
  warning if missing
- Claude Code CLI v2.1.0+ (check with `claude --version`)

### Quick start

```bash
git clone https://github.com/appleparan/everything-claude-code.git
cd everything-claude-code

# Install common + python configs for every detected target
# (Codex, pi and OpenCode are skipped automatically when not detected)
./scripts/install.sh python common

# One target only
./scripts/install.sh --target claude python common
./scripts/install.sh --target codex python common
./scripts/install.sh --target pi python common
./scripts/install.sh --target opencode python common

# Preview what would be installed, without writing anything
./scripts/install.sh -n --target all python common

# List available languages and what each one ships
./scripts/install.sh -l
```

`scripts/install.sh` is a thin `--target <name>|all` dispatcher (default `all`)
over the targets discovered under `targets/*/target.sh` (today `claude`,
`codex`, `pi`, and `opencode`), which all read from the single `content/` source tree. `all` runs
`claude` first, then every other target that reports itself available.

Available languages: `common`, `infra`, `node`, `python`, `rust`, `typescript`.
`common` holds language-agnostic content; you almost always want it plus the
languages you work in.

Options (shared by install and uninstall):

| Flag | Effect |
|---|---|
| `--target claude\|codex\|pi\|opencode\|all` | Which tool to install into (default `all`) |
| `-n` | Dry run — show what would be copied without copying |
| `-f` | Force-overwrite existing files (default is skip) |
| `-p` | Prune orphaned files left by previous installs (see below) |
| `-m` | Merge MCP servers from `content/mcp/servers.json` (off by default; install only; pi and OpenCode ignore it) |
| `-l` | List available languages |
| `-h` | Show help |

Install never writes through a symlink, even with `-f`. If a destination
such as `~/.claude/CLAUDE.md` is a link into your dotfiles, install skips
it with a warning. Update the link target by hand, or remove the link and
run install again.

### Pruning orphaned files (`-p`)

Every non-dry-run install writes `.ecc-manifest` next to the installed files
(`~/.claude/.ecc-manifest`, `~/.codex/.ecc-manifest`,
`~/.pi/agent/.ecc-manifest`, `~/.config/opencode/.ecc-manifest`), recording every
destination that install manages for the languages you selected. Content
that's shared/merged (`CLAUDE.md`, `settings.json`, `AGENTS.md`,
`config.toml`) is never tracked, so it's never a prune candidate.

```bash
./scripts/install.sh -p common node        # prune + install
./scripts/install.sh -n -p common node     # preview what -p would remove
```

- With a manifest already present, `-p` deletes entries for the languages
  you're installing that no longer correspond to a file the repo ships (a
  file that just moved between languages is left alone). Without `-p`, an
  orphan is reported with an INFO hint instead of being touched.
- On the very first run after upgrading (no manifest yet), `-p` falls back
  to a git-history check: it looks for locally-present files matching paths
  this repo used to ship but no longer does, verifies each one is
  byte-identical to some historical version, and asks for `y`/`N`
  confirmation before deleting anything verified. Locally modified or
  unrecognized files are listed as not verified and left untouched.
  Requires the repo checkout running the install to be a git work tree;
  otherwise the fallback is skipped with a warning.

### What the Claude target installs

`./scripts/install.sh --target claude <language>...` copies into `~/.claude/`:

| Source | Destination | Notes |
|---|---|---|
| `content/instructions/global.md` | `~/.claude/CLAUDE.md` | Global instructions |
| `content/agents/<lang>/*.md` | `~/.claude/agents/` | Specialized subagents |
| `content/skills/<lang>/<name>/` | `~/.claude/skills/<name>/` | Skill directories with `SKILL.md` |
| `content/commands/<lang>/*.md` | `~/.claude/commands/` | Slash commands |
| `content/rules/<lang>/*.md` | `~/.claude/rules/` | Always-follow guidelines |
| `content/targets/claude/hooks/<lang>/hooks.json`, `global-hooks.json` | merged into `~/.claude/settings.json` | Global hooks |
| `content/targets/claude/hooks/<lang>/project-hooks.json` | `~/.claude/project-hooks/<lang>.json` | Templates for `init-project.sh` |
| `content/targets/claude/plugins.json` | merged into `~/.claude/settings.json` | Tracked plugins + marketplaces |
| `content/mcp/servers.json` | merged into `~/.claude.json` (`mcpServers`) | Opt-in via `-m` (off by default) |
| `scripts/<lang>/hooks/`, `scripts/<lang>/lib/` | `~/.claude/scripts/<lang>/...` | Hook runtime scripts |

Hook handling details worth knowing:

- Existing files are **skipped** unless you pass `-f`.
- Multiple languages' hooks are merged with `jq`; when overwriting an existing
  `settings.json`, only the `hooks` key is replaced — your other settings
  (permissions, model, enabled plugins, ...) are preserved.
- After install, a smoke test warns about any hook that references a script
  path that doesn't exist.
- `content/targets/claude/plugins.json` tracks Claude Code plugins: its
  `enabledPlugins` and `extraKnownMarketplaces` keys are merged additively
  into `settings.json` (your untracked plugins survive), and Claude Code
  auto-installs the listed plugins on next startup. Refresh the tracked list
  with `jq '{enabledPlugins, extraKnownMarketplaces}' ~/.claude/settings.json`.
- Plugins (like the global `CLAUDE.md`) are language-agnostic: they are
  merged on every install regardless of which languages you select, and
  uninstalling *any* language removes all tracked plugin entries.
- `content/mcp/servers.json` merges into `~/.claude.json`'s `mcpServers` key
  only when `-m` is passed — off by default, since `~/.claude.json` (unlike
  `settings.json`) holds live user state such as OAuth tokens and project
  trust. The merge is per-server: only `command`/`args`/`env` are copied,
  existing entries are skipped unless `-f`, servers are filtered by the
  `languages` you install, and a timestamped backup is written before the
  first actual change in a run. Uninstall never touches `~/.claude.json`; it
  only prints manual-removal hints for the tracked server names.

### Project-level hooks

Global hooks stay language-agnostic; language-specific hooks are initialized
per project:

```bash
cd /path/to/your/project
~/.claude/scripts/init-project.sh            # auto-detect from project files
~/.claude/scripts/init-project.sh python     # or specify explicitly
~/.claude/scripts/init-project.sh node python  # merge for mixed projects
```

Auto-detection: `pyproject.toml` → python, `package.json` → node,
`Cargo.toml` → rust. The selected templates from `~/.claude/project-hooks/`
are merged into the project's `.claude/settings.json` (`-f` to overwrite,
`-n` to preview).

> The script also lives in the repo as `scripts/init-project.sh` if you
> prefer running it from the clone.

### Codex support

`./scripts/install.sh --target codex` (or `--target all` when Codex is
detected) installs into `$CODEX_HOME` or `~/.codex`:

| content | destination |
|---|---|
| `content/instructions/global.md` + rules index | `~/.codex/AGENTS.md` (generated) |
| `content/rules/**` | `~/.codex/instructions/*.md` (flat, one file per rule) |
| `content/skills/**` | `~/.codex/skills/<name>/` (invoked via `$skill-name`, e.g. `$git-commit-msg`) |
| `content/external-skills.json` | External skills shallow-cloned from their git repos into `~/.codex/skills/<name>/`. Each entry names a repo and the in-repo path of a directory containing `SKILL.md`. Language-agnostic (installed on every install, removed by uninstalling any language); entries are skipped with a warning when `git`/`jq` are missing, the clone fails, or the path has no `SKILL.md`. Existing skill dirs are only refreshed with `-f`. |
| `content/targets/codex/agents/*.toml` | `~/.codex/agents/<role>.toml` — custom subagent roles (`worker` on gpt-5.6-terra, `explorer` on gpt-5.6-luna) that override Codex's built-in roles so subagents never inherit the parent model. Language-agnostic (installed on every install, removed by uninstalling any language); existing files are only refreshed with `-f`. |
| `content/targets/codex/plugins.json` | Codex plugins installed with the `codex` CLI (`codex plugin marketplace add <source>` then `codex plugin add <name>@<marketplace>`): today the upstream `simple-english` plugin, whose SessionStart hook keeps the skill always on. Language-agnostic; needs `codex` on `PATH` and network, otherwise WARN with the commands to run by hand; `ECC_SKIP_CODEX_PLUGINS=1` skips it. The plugin provides the skill, so an older `skills/simple-english/` copy from `external-skills.json` is removed. Codex asks you to trust the hook once: run `/hooks` in the TUI. Uninstall runs `codex plugin remove` and `codex plugin marketplace remove`. |
| `content/targets/codex/config.toml` | `[agents]` defaults (`default_subagent_model`) merged key-by-key into `~/.codex/config.toml`, with a timestamped backup; existing user keys win unless `-f`. Requires `uv`; if it's missing, the step is skipped with a warning. |
| `content/mcp/servers.json` | Opt-in via `-m` (off by default): `[mcp_servers.*]` merged into `~/.codex/config.toml`, with a timestamped backup of the existing file. Only servers tagged with a matching `languages` entry (plus untagged/common servers) are merged for the languages being installed. Requires `uv`; if it's missing, the MCP step is skipped with a warning and the entries can be added manually. |

MCP server installation is opt-in on Claude Code and Codex — pass `-m` to merge
`content/mcp/servers.json` in; without it, no MCP servers are installed.
Each entry may carry a `languages` tag, and only servers matching the
languages you install (plus untagged/common servers) are merged. For
example, `./scripts/install.sh -m --target codex node` merges
`chrome-devtools` (tagged `node`) into `~/.codex/config.toml`'s
`[mcp_servers.*]`, while `--target codex python` skips it. For Claude Code,
`-m` merges the same servers into `~/.claude.json`'s `mcpServers` key
instead. To add a server later, re-run the install with `-m` and the
language that needs it.

Codex has no slash-command concept and configures subagents through TOML
role files rather than Markdown agents, so `content/agents/` and
`content/commands/` are not installed there; Codex subagent roles come from
`content/targets/codex/agents/` instead (see the table above and the `performance`
rule for the Claude ↔ Codex tier mapping). `content/targets/claude/hooks/` targets Claude
Code's tool-event hooks, which have no Codex lifecycle equivalent, so those
are not installed either.

Codex is detected via `$CODEX_HOME`, an existing `~/.codex` directory, or a
`codex` binary on `PATH`. `--target codex` on a machine without any of those
is an error; `--target all` prints an INFO message and skips Codex.

**Manual verification after installing:** restart Codex, run `$skill-name`
(e.g. `$git-commit-msg`) to confirm skill discovery, and confirm `AGENTS.md`
is loaded (Codex reads it automatically at session start).

### pi support

`./scripts/install.sh --target pi` installs into `$PI_CODING_AGENT_DIR` or
`~/.pi/agent`:

| content | destination |
|---|---|
| `content/instructions/global.md` + pi addendum + rules index | `AGENTS.md` (generated) |
| `content/rules/**` | `instructions/*.md` |
| `content/skills/**`, `content/external-skills.json` | `skills/<name>/` (invoked via `/skill:name`) |
| `content/commands/**` | `prompts/*.md` (prompt templates) |
| `content/agents/**` | `agents/*.md`, converted to pi tool names, plus `worker` and `scout` from `content/targets/pi/agents/` |
| `content/targets/pi/extensions/ecc-safety/` | `extensions/ecc-safety/` |
| `content/targets/pi/extensions/simple-english/` | `extensions/simple-english/` — injects the installed `simple-english` skill into the system prompt before every turn, so its rules are always on (the pi counterpart of the Claude plugin's SessionStart hook) |
| `content/targets/pi/upstream-extensions.json` | `extensions/subagent/`, fetched with `git` |

Install and uninstall:

```bash
./scripts/install.sh --target pi common python   # -n, -f, -p work as above
./scripts/uninstall.sh --target pi common python
ECC_SKIP_UPSTREAM=1 ./scripts/install.sh --target pi common   # skip the fetch
```

Agent models: pi agents ship without `model:` lines, so subagents use the
model you select in pi.

Three limits to know:

- pi has no permission prompts or sandbox. The `ecc-safety` extension blocks
  or asks before destructive commands (`rm -rf`, `sudo`, `git push --force`,
  and similar) and unneeded `.md`/`.txt` writes. It is a pattern list, not a
  security boundary. Without a UI (subagents, `pi -p`) it blocks those
  commands; set `ECC_SAFETY_HEADLESS=allow` to let them run.
- The subagent extension comes from a pinned upstream commit. If it breaks
  with your pi version, bump `ref` in
  `content/targets/pi/upstream-extensions.json` and re-run with `-f`.
- Per-language hooks and MCP config are not ported to pi yet.

pi is detected via `$PI_CODING_AGENT_DIR`, an existing `~/.pi` directory, or a
`pi` binary on `PATH`.

### OpenCode support

`./scripts/install.sh --target opencode` installs into `$OPENCODE_CONFIG_DIR`,
else `$XDG_CONFIG_HOME/opencode`, else `~/.config/opencode`:

| content | destination |
|---|---|
| `content/instructions/global.md` + OpenCode addendum + rules index | `AGENTS.md` (generated) |
| `content/rules/**` | `instructions/*.md` |
| `content/skills/**`, `content/external-skills.json` | `skills/<name>/` |
| `content/commands/**` | `commands/*.md` (copied as-is, run as `/<name>`) |
| `content/agents/**` | `agents/*.md`, converted (see below) |
| `content/targets/opencode/plugins/` | `plugins/*.js` — today `simple-english.js`, which appends the installed `simple-english` skill to the system prompt on every turn (`experimental.chat.system.transform`), so its rules are always on. Uninstall removes a plugin file only when it is still byte-identical to the shipped one. |
| `content/targets/opencode/opencode.json` | `opencode.json` |

Install and uninstall:

```bash
./scripts/install.sh --target opencode common python   # -n, -f, -p work as above
./scripts/uninstall.sh --target opencode common python
```

Agent conversion: OpenCode silently drops an agent whose `tools:` is a list or
whose `model:` has no `provider/` prefix, and drops `permissions` when a
`name:` key sits beside them. The installer therefore removes the `tools:`,
`model:` and `name:` lines (the agent id is the filename; subagents use the
model from your OpenCode configuration), adds `mode: subagent`, and turns the
original tool list into permissions. An agent without Edit, MultiEdit and
Write gets an `edit` deny, one without Bash gets a `shell` deny. The body is
unchanged. An agent with a block-list or empty `tools:`, or with its own
`permissions:`, is skipped with a WARN.

Safety: OpenCode has no per-command sandbox by default. The installed
`opencode.json` makes it ask before destructive shell commands (`rm -r`,
`sudo`, forced `git push`, `git reset --hard`, `git clean -f`,
`git branch -D`, `--no-verify`, `chmod 777`, and similar). OpenCode loads
`opencode.json` first and your own `opencode.jsonc` after it, and the last
matching rule wins, so rules in your `.jsonc` override these. The pattern
`git push --force*` also matches `--force-with-lease`, which therefore asks
too, and `rm -*r*` also asks for `rm -f readme.txt`.
Your own `opencode.json` can hold providers, API keys and MCP servers, so
install writes the file only when it is absent or still a shipped version
(current or from git history). Otherwise it leaves yours alone, even with
`-f`, and warns: merge the `permissions` array from
`content/targets/opencode/opencode.json` into your config by hand. Install
never parses or merges your config. Uninstall removes `opencode.json` only
under the same condition and never touches `opencode.jsonc`.

Limits to know:

- The rules are a pattern list, not a security boundary. A `` !`cmd` `` line in
  a command template runs outside the permission check, so review commands
  you add or edit.
- Not ported: the per-language hooks, the doc-file blocker, and MCP config.
  The only plugin shipped is `simple-english.js`.

OpenCode is detected via `$OPENCODE_CONFIG_DIR`, an existing config directory,
or an `opencode` binary on `PATH`.

### Uninstall

```bash
./scripts/uninstall.sh                    # all targets (others skipped if absent)
./scripts/uninstall.sh --target claude
./scripts/uninstall.sh --target codex
./scripts/uninstall.sh --target pi common python
./scripts/uninstall.sh --target opencode common python
```

`uninstall.sh --target codex` removes the installed files but never touches
`config.toml` — it prints the manual removal steps instead, since that file
also holds user state (trust levels, model settings) that must not be
clobbered.

---

## Repository layout

```text
everything-claude-code/
|-- .claude-plugin/   # Plugin and marketplace manifests (upstream plugin flow)
|   |-- plugin.json             # Plugin metadata, component paths (./content/...)
|   |-- marketplace.json        # Marketplace catalog for /plugin marketplace add
|   |-- PLUGIN_SCHEMA_NOTES.md  # Undocumented validator constraints
|
|-- content/          # Single source of truth (target-neutral, no install logic)
|   |-- instructions/
|   |   |-- global.md        # Harness-neutral instructions (-> CLAUDE.md / AGENTS.md, plus each target's addendum)
|   |-- agents/               # Specialized subagents (Claude Code, pi, OpenCode)
|   |   |-- common/, infra/, node/, python/, rust/, typescript/
|   |-- skills/                # Workflow definitions (Claude Code, Codex, pi, OpenCode)
|   |   |-- common/, node/, python/
|   |-- commands/              # Slash commands (Claude Code; pi prompt templates; OpenCode commands)
|   |   |-- common/, infra/, node/, python/, rust/
|   |-- rules/                 # Always-follow guidelines (all targets)
|   |   |-- common/, infra/, node/, python/, rust/, typescript/
|   |-- mcp/
|   |   |-- servers.json     # MCP server catalog, tagged per language (manual copy for Claude Code, filtered merge into Codex config.toml)
|   |-- external-skills.json   # External skills cloned at install time (optional per-entry "targets")
|   |-- targets/               # Content that only one target consumes
|       |-- claude/
|       |   |-- instructions.md  # Addendum appended to CLAUDE.md
|       |   |-- plugins.json   # Tracked plugins + marketplaces merged into settings.json
|       |   |-- hooks/         # Trigger-based automations (common/, infra/, node/, python/, rust/)
|       |-- codex/
|       |   |-- instructions.md  # Addendum appended to AGENTS.md
|       |   |-- agents/        # Subagent role files -> ~/.codex/agents/ (worker=terra, explorer=luna)
|       |   |-- config.toml    # [agents] defaults merged into ~/.codex/config.toml
|       |-- pi/
|           |-- instructions.md  # Addendum appended to AGENTS.md
|           |-- agents/        # worker and scout subagents
|           |-- extensions/ecc-safety/  # Destructive-command and doc-file guard
|           |-- upstream-extensions.json  # Pinned upstream subagent extension
|       |-- opencode/
|           |-- instructions.md  # Addendum appended to AGENTS.md
|           |-- opencode.json  # Ask-before shell rules -> ~/.config/opencode/opencode.json
|
|-- targets/           # Per-target adapters - mapping/transform only, no content
|   |-- claude/
|   |   |-- target.sh         # Registry entry: target_is_available(), target_description()
|   |   |-- install.sh        # content/* -> ~/.claude/*
|   |   |-- uninstall.sh
|   |-- codex/
|       |-- target.sh
|       |-- install.sh        # content/* -> ~/.codex/* (see Codex support above)
|       |-- uninstall.sh
|       |-- merge-mcp.py        # servers.json -> config.toml [mcp_servers.*] merge
|       |-- merge-config.py     # content/targets/codex/config.toml -> config.toml [agents] merge
|   |-- pi/
|       |-- target.sh
|       |-- install.sh        # content/* -> ~/.pi/agent/* (see pi support above)
|       |-- uninstall.sh
|   |-- opencode/
|       |-- target.sh
|       |-- install.sh        # content/* -> ~/.config/opencode/* (see OpenCode support above)
|       |-- uninstall.sh
|
|-- scripts/          # Thin dispatchers + hook runtime scripts
|   |-- install.sh           # --target <name>|all (default all)
|   |-- uninstall.sh         # --target <name>|all (default all)
|   |-- init-project.sh      # Initialize project hooks
|   |-- lib/common.sh        # Shared copy/log/dry-run helpers + target registry
|   |-- lib/build-agents-md.sh   # AGENTS.md generator (global.md + target addendum + rules index)
|   |-- lib/external-skills.sh   # Installs content/external-skills.json for a target
|   |-- lib/prune.sh             # Manifest and orphan pruning
|   |-- lib/pi-agents.sh         # Converts shared agents to pi tool names
|   |-- lib/opencode-agents.sh   # Converts shared agents to OpenCode's format
|   |-- lib/upstream-extensions.sh  # Fetches pinned upstream pi extensions
|   |-- node/                # Node.js hook runtime scripts
|   |   |-- lib/, hooks/, ci/
|   |-- python/              # Python hook runtime scripts (as they land)
|
|-- docs/             # Repo structure and validation docs
|   |-- COMMAND-AGENT-MAP.md
|   |-- SECURITY-VALIDATION.md
|   |-- SKILL-PLACEMENT-POLICY.md
|
|-- tests/            # Test suite (node tests/run-all.js)
|-- examples/         # Example CLAUDE.md configurations
```

---

## Adding a target

A target is a directory under `targets/`; the dispatchers discover it with no
other registration.

1. Create `targets/<name>/target.sh`, `install.sh`, and `uninstall.sh`.
   `target.sh` defines `target_is_available` (is the tool present?) and
   `target_description` (one line for `--help`).
2. Optionally add `content/targets/<name>/` for content only this target
   consumes. An `instructions.md` there is appended to the generated
   instructions file.
3. Reuse the helpers in `scripts/lib/`: `build-agents-md.sh` (instructions
   file), `external-skills.sh` (external skills), `prune.sh` (manifest and
   `-p`), and `common.sh` (copy, log, dry-run).
4. Add tests under `tests/scripts/`. Use `targets/pi/` and
   `tests/scripts/pi-target.test.js` as a template.

---

## Key concepts

### Agents

Subagents handle delegated tasks with limited scope:

```yaml
---
name: code-reviewer
description: Reviews code for quality, security, and maintainability
tools: ["Read", "Grep", "Glob", "Bash"]
model: opus
---

You are a senior code reviewer...
```

### Skills

Skills are workflow definitions invoked by commands or agents:

```text
# TDD Workflow

1. Define interfaces first
2. Write failing tests (RED)
3. Implement minimal code (GREEN)
4. Refactor (IMPROVE)
5. Verify 80%+ coverage
```

### Hooks

Hooks fire on tool events — e.g. warn about `console.log` after an edit,
block `pip install` in favor of `uv`, auto-format files after changes.
Global hooks live in `settings.json`; language-specific hooks are installed
per project via `init-project.sh`.

### Rules

Rules are always-follow guidelines, kept modular:

```text
~/.claude/rules/
  security.md      # No hardcoded secrets
  coding-style.md  # Immutability, file limits
  testing.md       # TDD, coverage requirements
```

---

## Alternative: install as a plugin

The upstream repo distributes this content as a Claude Code plugin
(`/plugin marketplace add affaan-m/everything-claude-code`). This fork keeps
the plugin manifests (`.claude-plugin/`) intact, but the script-based install
above is the supported path here — it is explicit about what gets copied,
supports Codex, pi and OpenCode, and installs `rules`, which the plugin system cannot
distribute ([upstream limitation](https://code.claude.com/docs/en/plugins-reference)).

> **For contributors:** do NOT add a `"hooks"` field to
> `.claude-plugin/plugin.json`. Claude Code v2.1+ auto-loads
> `hooks/hooks.json` from installed plugins by convention, and declaring it
> explicitly causes a duplicate-hooks error. A regression test enforces this.

---

## Development

```bash
# Run all tests
node tests/run-all.js

# Lint JS and Markdown (same as CI)
npx eslint scripts/**/*.js tests/**/*.js
npx markdownlint "content/**/*.md"
```

Tests cover the hook runtime libraries, dispatcher `--target` handling, and
the Codex, pi and OpenCode adapter scripts.

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Guides

The original author's guides explain the philosophy behind these configs and
live in the upstream repository:

- [The Shortform Guide](https://github.com/affaan-m/everything-claude-code/blob/main/the-shortform-guide.md)
  — setup, foundations, philosophy. Read this first.
- [The Longform Guide](https://github.com/affaan-m/everything-claude-code/blob/main/the-longform-guide.md)
  — token optimization, memory persistence, evals, parallelization, subagent
  orchestration.

### Context window management

Don't enable every MCP server at once — a 200k context window can shrink to
70k with too many tools enabled. Keep under ~10 servers enabled per project
and under ~80 active tools; disable unused ones with `disabledMcpServers` in
the project config.

### Customization

These configs are a starting point, not a prescription:

1. Start with what resonates
2. Modify for your stack
3. Remove what you don't use
4. Add your own patterns

---

## Credits

Original collection by [Affaan Mustafa](https://x.com/affaanmustafa)
([affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code)).
This fork adds the multi-target (`content/` + `targets/`) restructure and the
script-based install flow.

## License

MIT — use freely, modify as needed, contribute back if you can.
