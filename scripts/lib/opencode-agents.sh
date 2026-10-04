#!/usr/bin/env bash
# Convert a shared agent file (content/agents/<lang>/*.md) to OpenCode's
# agent format. Sourced by targets/opencode/{install,uninstall}.sh after
# scripts/lib/common.sh.
#
# Only the frontmatter changes; the body is copied byte for byte:
#   name:           removed. OpenCode silently drops an agent's permissions
#                   when the frontmatter also has a name: key; the agent id
#                   comes from the filename anyway.
#   tools:, model:  removed. OpenCode silently drops an agent whose tools:
#                   is a list or whose model: has no provider/ prefix, and
#                   model choice belongs to the user's OpenCode config.
#   mode:           "mode: subagent" is added when the agent has none.
#   permissions:    added from the original tools: list. Without Edit,
#                   MultiEdit and Write the agent may not edit; without Bash
#                   (Bash(...) counts) it may not run shell commands. An
#                   agent with no tools: line gets none.
# CRLF files keep their line endings. An agent whose tools: is a block list
# or yields no tool, or that already has permissions:, is not converted.

# POSIX awk only, and only inside the frontmatter block (first two --- lines).
# The permissions block is emitted just before the closing --- line.
# shellcheck disable=SC2016
OPENCODE_AGENT_AWK='
function out(s) { printf "%s%s\n", s, cr }
{ cr = ""; if (sub(/\r$/, "")) cr = "\r" }
NR == 1 && $0 == "---" { infm = 1; out($0); next }
infm && $0 == "---" {
    infm = 0
    if (!hasmode) out("mode: subagent")
    if (hastools && (noedit || nobash)) {
        out("permissions:")
        if (noedit) { out("  - action: edit"); out("    resource: \"*\""); out("    effect: deny") }
        if (nobash) { out("  - action: shell"); out("    resource: \"*\""); out("    effect: deny") }
    }
    out($0); next
}
infm && $0 ~ /^(model|name):/ { next }
infm && $0 ~ /^mode:/ { hasmode = 1; out($0); next }
infm && $0 ~ /^tools:/ {
    hastools = 1
    line = $0
    sub(/^tools:[ \t]*/, "", line)
    gsub(/\([^)]*\)/, "", line)
    gsub(/\[/, "", line); gsub(/\]/, "", line); gsub(/"/, "", line); gsub(q, "", line)
    gsub(/[ \t]/, "", line)
    n = split(line, parts, ",")
    edit = 0; bash = 0
    for (i = 1; i <= n; i++) {
        t = tolower(parts[i])
        if (t == "edit" || t == "multiedit" || t == "write") edit = 1
        if (t == "bash") bash = 1
    }
    noedit = !edit; nobash = !bash
    next
}
{ out($0) }
'

# Prints a reason (one line) when the agent cannot be converted, else nothing.
# shellcheck disable=SC2016
OPENCODE_AGENT_CHECK_AWK='
{ sub(/\r$/, "") }
NR == 1 && $0 == "---" { infm = 1; next }
infm && $0 == "---" { exit }
infm && $0 ~ /^permissions:/ { print "it already has a permissions: key"; exit }
infm && $0 ~ /^tools:/ {
    line = $0
    sub(/^tools:[ \t]*/, "", line)
    gsub(/\([^)]*\)/, "", line)
    gsub(/\[/, "", line); gsub(/\]/, "", line); gsub(/"/, "", line); gsub(q, "", line)
    gsub(/[ \t,]/, "", line)
    if (line == "") { print "its tools: is a block list or empty"; exit }
}
'

# Prints the name: value of the agent, if any.
OPENCODE_AGENT_NAME_AWK='
{ sub(/\r$/, "") }
NR == 1 && $0 == "---" { infm = 1; next }
infm && $0 == "---" { exit }
infm && $0 ~ /^name:/ {
    v = $0; sub(/^name:[ \t]*/, "", v); gsub(/"/, "", v); gsub(q, "", v); sub(/[ \t]+$/, "", v); print v; exit
}
'

# Reason the agent cannot be converted (empty when it can).
opencode_agent_check() {
    awk -v q="'" "$OPENCODE_AGENT_CHECK_AWK" "$1"
}

# Prints the converted agent on stdout; returns 1 (nothing printed) when the
# agent cannot be converted.
opencode_agent_render() {
    [[ -z "$(opencode_agent_check "$1")" ]] || return 1
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

# Agents whose name: differs from the filename stem, "stem (name: x)" per
# entry, space separated. The installer prints one WARN from it after the loop.
OPENCODE_NAME_MISMATCHES=""

# Usage: opencode_convert_agent <src.md> <dest.md> <agent-name>
# Writes <dest.md> unless DRY_RUN is set. Returns 1 (WARN, nothing written)
# when <dest.md> is a symlink (-f must not write through it) or the agent
# cannot be converted.
opencode_convert_agent() {
    local src="$1" dest="$2" name="$3" reason fm_name
    if [[ -L "$dest" ]]; then
        log_symlink "agents/${name}.md"
        return 1
    fi
    reason=$(opencode_agent_check "$src")
    if [[ -n "$reason" ]]; then
        log_warn "agents/${name}.md: ${reason}; not installed"
        return 1
    fi
    fm_name=$(awk -v q="'" "$OPENCODE_AGENT_NAME_AWK" "$src")
    if [[ -n "$fm_name" && "$fm_name" != "$name" ]]; then
        OPENCODE_NAME_MISMATCHES="${OPENCODE_NAME_MISMATCHES}${OPENCODE_NAME_MISMATCHES:+, }${name} (name: ${fm_name})"
    fi
    $DRY_RUN || opencode_agent_render "$src" >"$dest"
}
