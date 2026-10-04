#!/usr/bin/env bash
# Target registry entry, sourced by scripts/install.sh and scripts/uninstall.sh
# (in a subshell, so function names cannot clash between targets).
# Requires scripts/lib/common.sh to be sourced first (for PI_DIR).

# pi counts as present when PI_CODING_AGENT_DIR is set, ~/.pi exists, or the
# pi binary is on PATH.
target_is_available() {
    [[ -n "${PI_CODING_AGENT_DIR:-}" ]] || [[ -d "${HOME}/.pi" ]] || command -v pi &>/dev/null
}

# shellcheck disable=SC2088
target_description() {
    echo "~/.pi/agent (AGENTS.md, instructions, skills, prompts, agents, extensions)"
}

target_display_name() {
    echo "pi"
}
