#!/usr/bin/env bash
# Convert a shared agent file (content/agents/<lang>/*.md) to OpenCode's
# agent format. Sourced by targets/opencode/{install,uninstall}.sh after
# scripts/lib/common.sh.
#
# Only the frontmatter changes; the body is copied byte for byte:
#   tools:, model:  removed. OpenCode silently drops an agent whose tools:
#                   is a list or whose model: has no provider/ prefix, and
#                   model choice belongs to the user's OpenCode config.
#   mode:           "mode: subagent" is added when the agent has none.
#   permissions:    added from the original tools: list. Without both Edit and
#                   Write the agent may not edit; without Bash it may not run
#                   shell commands. An agent with no tools: line gets none.

# POSIX awk only, and only inside the frontmatter block (first two --- lines).
# The permissions block is emitted just before the closing --- line.
# shellcheck disable=SC2016
OPENCODE_AGENT_AWK='
NR == 1 && $0 == "---" { infm = 1; print; next }
infm && $0 == "---" {
    infm = 0
    if (!hasmode) print "mode: subagent"
    if (hastools && (noedit || nobash)) {
        print "permissions:"
        if (noedit) { print "  - action: edit"; print "    resource: \"*\""; print "    effect: deny" }
        if (nobash) { print "  - action: shell"; print "    resource: \"*\""; print "    effect: deny" }
    }
    print; next
}
infm && $0 ~ /^model:/ { next }
infm && $0 ~ /^mode:/ { hasmode = 1; print; next }
infm && $0 ~ /^tools:/ {
    hastools = 1
    line = $0
    sub(/^tools:[ \t]*/, "", line)
    gsub(/\[/, "", line); gsub(/\]/, "", line); gsub(/"/, "", line); gsub(q, "", line)
    gsub(/[ \t\r]/, "", line)
    n = split(line, parts, ",")
    edit = 0; bash = 0
    for (i = 1; i <= n; i++) {
        t = tolower(parts[i])
        if (t == "edit" || t == "write") edit = 1
        if (t == "bash") bash = 1
    }
    noedit = !edit; nobash = !bash
    next
}
{ print }
'

# Prints the converted agent on stdout.
opencode_agent_render() {
    awk -v q="'" "$OPENCODE_AGENT_AWK" "$1"
}

# True (0) iff regular file $2 is exactly what installing agent $1 writes now.
opencode_agent_matches() {
    local out rc=1
    [[ -f "$2" && ! -L "$2" ]] || return 1
    out=$(mktemp)
    if opencode_agent_render "$1" >"$out" 2>/dev/null && cmp -s "$out" "$2"; then rc=0; fi
    rm -f "$out"
    return "$rc"
}

# Usage: opencode_convert_agent <src.md> <dest.md> <agent-name>
# Writes <dest.md> unless DRY_RUN is set. Returns 1 (WARN, nothing written)
# when <dest.md> is a symlink: -f must not write through it.
opencode_convert_agent() {
    local src="$1" dest="$2" name="$3"
    if [[ -L "$dest" ]]; then
        log_symlink "agents/${name}.md"
        return 1
    fi
    $DRY_RUN || opencode_agent_render "$src" >"$dest"
}
