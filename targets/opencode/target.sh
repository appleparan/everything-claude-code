#!/usr/bin/env bash
# Target registry entry, sourced by scripts/install.sh and scripts/uninstall.sh
# (in a subshell, so function names cannot clash between targets).
# Requires scripts/lib/common.sh to be sourced first (for OPENCODE_DIR).

# OpenCode counts as present when OPENCODE_CONFIG_DIR is set, its config
# directory exists, or the opencode binary is on PATH.
target_is_available() {
    [[ -n "${OPENCODE_CONFIG_DIR:-}" ]] || [[ -d "$OPENCODE_DIR" ]] || command -v opencode &>/dev/null
}

# shellcheck disable=SC2088
target_description() {
    echo "~/.config/opencode (AGENTS.md, instructions, skills, commands, agents, opencode.json)"
}

# Label for the config dir in messages and the AGENTS.md rules index: the
# short form unless the location was overridden through the environment.
opencode_dest_label() {
    if [[ -n "${OPENCODE_CONFIG_DIR:-}" || -n "${XDG_CONFIG_HOME:-}" ]]; then
        echo "$OPENCODE_DIR"
    else
        # shellcheck disable=SC2088
        echo "~/.config/opencode"
    fi
}
