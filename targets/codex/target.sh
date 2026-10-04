#!/usr/bin/env bash
# Target registry entry, sourced by scripts/install.sh and scripts/uninstall.sh
# (in a subshell, so function names cannot clash between targets).
# Requires scripts/lib/common.sh to be sourced first (for CODEX_DIR).

# Codex counts as present when CODEX_HOME is set, ~/.codex exists, or the
# codex binary is on PATH.
target_is_available() {
    [[ -n "${CODEX_HOME:-}" ]] || [[ -d "$CODEX_DIR" ]] || command -v codex &>/dev/null
}

# shellcheck disable=SC2088
target_description() {
    echo "~/.codex (AGENTS.md, instructions, skills, MCP)"
}

target_display_name() {
    echo "Codex"
}
