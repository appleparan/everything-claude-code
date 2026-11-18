#!/usr/bin/env bash
# Convert a shared agent file (content/agents/<lang>/*.md) to pi's subagent
# format, or to omp's (oh-my-pi) with the omp_* wrappers below. Sourced by
# targets/{pi,omp}/install.sh after scripts/lib/common.sh.
#
# Two frontmatter lines change; the body is copied byte for byte:
#   tools:  a JSON-style array of Claude tool names becomes a comma-separated
#           list of pi tool names (pi names pass through unchanged).
#   model:  always removed, so the subagent inherits the model chosen in pi.
#           Model choice belongs to the user's pi configuration.
# The awk variable "harness" (pi, the default, or omp) picks the tool map:
# pi maps Glob to find and passes ls through; omp maps Glob to glob, passes
# glob and find through, and drops ls (omp has no ls tool).

# POSIX awk only (the single quote arrives via -v q, since \047 escapes inside
# regexes are not portable to BWK awk on macOS), and only inside the frontmatter block (first two --- lines).
# Unknown tools are reported on stderr as "<tool>" lines.
# shellcheck disable=SC2016
PI_AGENT_AWK='
function out(s) { printf "%s%s\n", s, cr }
function map(t) {
    if (t == "Glob") return (harness == "omp") ? "glob" : "find"
    if (t == "Read") return "read"
    if (t == "Grep") return "grep"
    if (t == "Bash") return "bash"
    if (t == "Edit") return "edit"
    if (t == "Write") return "write"
    if (harness == "omp") return (t == "glob" || t == "find" || t == "read" || t == "grep" || t == "bash" || t == "edit" || t == "write") ? t : ""
    if (t == "read" || t == "grep" || t == "find" || t == "bash" || t == "edit" || t == "write" || t == "ls") return t
    return ""
}
{ cr = ""; if (sub(/\r$/, "")) cr = "\r" }
NR == 1 && $0 == "---" { infm = 1; out($0); next }
infm && $0 == "---" { infm = 0; out($0); next }
infm && $0 ~ /^model:/ { next }
infm && $0 ~ /^tools:/ {
    line = $0
    sub(/^tools:[ \t]*/, "", line)
    gsub(/\[/, "", line); gsub(/\]/, "", line); gsub(/"/, "", line); gsub(q, "", line)
    gsub(/[ \t\r]/, "", line)
    n = split(line, parts, ",")
    tl = ""
    for (i = 1; i <= n; i++) {
        if (parts[i] == "") continue
        m = map(parts[i])
        if (m == "") { print parts[i] > "/dev/stderr"; continue }
        tl = (tl == "") ? m : tl ", " m
    }
    out("tools: " tl)
    next
}
{ out($0) }
'

# Prints the converted agent on stdout; dropped tools go to stderr, one per
# line. Optional $2 is the harness (pi or omp, default pi).
pi_agent_render() {
    awk -v q="'" -v harness="${2:-pi}" "$PI_AGENT_AWK" "$1"
}

# True (0) iff regular file $2 is exactly what installing agent $1 writes now.
# Optional $3 is the harness (default pi).
pi_agent_matches() {
    local out rc=1
    [[ -f "$2" && ! -L "$2" ]] || return 1
    out=$(mktemp)
    if pi_agent_render "$1" "${3:-pi}" >"$out" 2>/dev/null && cmp -s "$out" "$2"; then rc=0; fi
    rm -f "$out"
    return "$rc"
}

# Usage: pi_convert_agent <src.md> <dest.md> <agent-name> [harness]
# Logs a WARN per dropped tool. Writes <dest.md> unless DRY_RUN is set.
# Returns 1 (WARN, nothing written) when <dest.md> is a symlink: -f must not
# write through it.
pi_convert_agent() {
    local src="$1" dest="$2" name="$3" harness="${4:-pi}" warn_file tool
    if [[ -L "$dest" ]]; then
        log_symlink "agents/${name}.md"
        return 1
    fi
    warn_file=$(mktemp)
    if $DRY_RUN; then
        pi_agent_render "$src" "$harness" >/dev/null 2>"$warn_file"
    else
        pi_agent_render "$src" "$harness" >"$dest" 2>"$warn_file"
    fi
    while IFS= read -r tool; do
        [[ -n "$tool" ]] || continue
        log_warn "agents/${name}.md: tool '${tool}' has no ${harness} equivalent; dropped"
    done <"$warn_file"
    rm -f "$warn_file"
}

# Usage: pi_install_agent <src.md> <dest.md> <name> <label_src>
# Installs a rendered agent with copy_file semantics (skip existing without -f,
# never write through a symlink, honor dry run). Used for worker/scout.
pi_install_agent() {
    local src="$1" dest="$2" name="$3" label_src="$4" tmp
    tmp=$(mktemp)
    pi_convert_agent "$src" "$tmp" "$name"
    copy_file "$tmp" "$dest" "$label_src" "agents/${name}.md"
    rm -f "$tmp"
}

# omp wrappers: same conversion with omp's tool names.
omp_convert_agent() { pi_convert_agent "$1" "$2" "$3" omp; }
omp_agent_matches() { pi_agent_matches "$1" "$2" omp; }

# Agent names that omp bundles. A shared agent with one of these names would
# override the bundled agent, so the omp target skips it.
OMP_BUNDLED_AGENTS="scout reviewer security-reviewer seance task sonic"

# True (0) iff <name> is an omp bundled agent name.
omp_is_bundled_agent() {
    local b
    for b in $OMP_BUNDLED_AGENTS; do
        [[ "$b" == "$1" ]] && return 0
    done
    return 1
}
