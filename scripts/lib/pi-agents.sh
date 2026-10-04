#!/usr/bin/env bash
# Convert a shared agent file (content/agents/<lang>/*.md) to pi's subagent
# format. Sourced by targets/pi/install.sh after scripts/lib/common.sh.
#
# Only the frontmatter `tools:` line changes: a JSON-style array of Claude
# tool names becomes a comma-separated list of pi tool names. Everything else,
# including `model:` and the body, is copied byte for byte.

# POSIX awk only (the single quote arrives via -v q, since \047 escapes inside
# regexes are not portable to BWK awk on macOS), and only inside the frontmatter block (first two --- lines).
# Unknown tools are reported on stderr as "<tool>" lines.
# shellcheck disable=SC2016
PI_AGENT_AWK='
function map(t) {
    if (t == "Read") return "read"
    if (t == "Grep") return "grep"
    if (t == "Glob") return "find"
    if (t == "Bash") return "bash"
    if (t == "Edit") return "edit"
    if (t == "Write") return "write"
    return ""
}
NR == 1 && $0 == "---" { infm = 1; print; next }
infm && $0 == "---" { infm = 0; print; next }
infm && $0 ~ /^tools:/ {
    line = $0
    sub(/^tools:[ \t]*/, "", line)
    gsub(/\[/, "", line); gsub(/\]/, "", line); gsub(/"/, "", line); gsub(q, "", line)
    gsub(/[ \t\r]/, "", line)
    n = split(line, parts, ",")
    out = ""
    for (i = 1; i <= n; i++) {
        if (parts[i] == "") continue
        m = map(parts[i])
        if (m == "") { print parts[i] > "/dev/stderr"; continue }
        out = (out == "") ? m : out ", " m
    }
    print "tools: " out
    next
}
{ print }
'

# Prints the converted agent on stdout; dropped tools go to stderr, one per line.
pi_agent_render() {
    awk -v q="'" "$PI_AGENT_AWK" "$1"
}

# True (0) iff regular file $2 is exactly what installing agent $1 writes now.
pi_agent_matches() {
    local out rc=1
    [[ -f "$2" && ! -L "$2" ]] || return 1
    out=$(mktemp)
    if pi_agent_render "$1" >"$out" 2>/dev/null && cmp -s "$out" "$2"; then rc=0; fi
    rm -f "$out"
    return "$rc"
}

# Usage: pi_convert_agent <src.md> <dest.md> <agent-name>
# Logs a WARN per dropped tool. Writes <dest.md> unless DRY_RUN is set.
# Returns 1 (WARN, nothing written) when <dest.md> is a symlink: -f must not
# write through it.
pi_convert_agent() {
    local src="$1" dest="$2" name="$3" warn_file tool
    if [[ -L "$dest" ]]; then
        log_symlink "agents/${name}.md"
        return 1
    fi
    warn_file=$(mktemp)
    if $DRY_RUN; then
        pi_agent_render "$src" >/dev/null 2>"$warn_file"
    else
        pi_agent_render "$src" >"$dest" 2>"$warn_file"
    fi
    while IFS= read -r tool; do
        [[ -n "$tool" ]] || continue
        log_warn "agents/${name}.md: tool '${tool}' has no pi equivalent; dropped"
    done <"$warn_file"
    rm -f "$warn_file"
}
