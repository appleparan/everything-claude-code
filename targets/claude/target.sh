#!/usr/bin/env bash
# Target registry entry, sourced by scripts/install.sh and scripts/uninstall.sh
# (in a subshell, so function names cannot clash between targets).
# Requires scripts/lib/common.sh to be sourced first.

# Claude is the primary target: always installed.
target_is_available() {
    return 0
}

# shellcheck disable=SC2088
target_description() {
    echo "~/.claude (default components)"
}
