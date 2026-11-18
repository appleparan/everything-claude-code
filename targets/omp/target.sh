#!/usr/bin/env bash
# Target registry entry, sourced by scripts/install.sh and scripts/uninstall.sh
# (in a subshell, so function names cannot clash between targets).
# Requires scripts/lib/common.sh to be sourced first (for OMP_DIR).

# omp (oh-my-pi) counts as present when ECC_OMP_DIR is set, ~/.omp exists, or
# the omp binary is on PATH.
target_is_available() {
    [[ -n "${ECC_OMP_DIR:-}" ]] || [[ -d "${HOME}/.omp" ]] || command -v omp &>/dev/null
}

# shellcheck disable=SC2088
target_description() {
    echo "~/.omp/agent (AGENTS.md, rules, skills, commands, agents, extensions)"
}

target_display_name() {
    echo "omp"
}
