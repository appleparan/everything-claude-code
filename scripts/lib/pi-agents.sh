#!/usr/bin/env bash
# Convert a shared agent file (content/agents/<lang>/*.md) to pi's subagent
# format. Sourced by targets/pi/install.sh after scripts/lib/common.sh.
#
# Two frontmatter lines change; the body is copied byte for byte:
#   tools:  a JSON-style array of Claude tool names becomes a comma-separated
#           list of pi tool names (pi names pass through unchanged).
#   model:  removed by default, so the subagent inherits the parent's model.
#           With a profile (pi_load_profile) a tier (opus|sonnet|haiku) is
#           replaced by the profile's exact model ID. A tier missing from the
#           profile, or a value that is not a tier, is removed and reported.
# Why: pi fuzzy-matches `--model <pattern>` across every provider it considers
# available, so a bare tier like "opus" can route to an unintended, expensive
# provider.

# POSIX awk only (the single quote arrives via -v q, since \047 escapes inside
# regexes are not portable to BWK awk on macOS), and only inside the frontmatter block (first two --- lines).
# Unknown tools are reported on stderr as "<tool>" lines, and models that were
# removed under a profile as "MODEL:<value>" lines.
# shellcheck disable=SC2016
PI_AGENT_AWK='
function map(t) {
    if (t == "Read") return "read"
    if (t == "Grep") return "grep"
    if (t == "Glob") return "find"
    if (t == "Bash") return "bash"
    if (t == "Edit") return "edit"
    if (t == "Write") return "write"
    if (t == "read" || t == "grep" || t == "find" || t == "bash" || t == "edit" || t == "write" || t == "ls") return t
    return ""
}
NR == 1 && $0 == "---" { infm = 1; print; next }
infm && $0 == "---" { infm = 0; print; next }
infm && $0 ~ /^model:/ {
    val = $0
    sub(/^model:[ \t]*/, "", val)
    gsub(/[ \t\r]/, "", val); gsub(/"/, "", val); gsub(q, "", val)
    if (have_profile == "1") {
        id = (val == "opus") ? mo : (val == "sonnet") ? ms : (val == "haiku") ? mh : ""
        if (id != "") { print "model: " id; next }
        print "MODEL:" val > "/dev/stderr"
    }
    next
}
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
    awk -v q="'" -v have_profile="$PI_PROFILE_SET" -v mo="$PI_MODEL_OPUS" \
        -v ms="$PI_MODEL_SONNET" -v mh="$PI_MODEL_HAIKU" "$PI_AGENT_AWK" "$1"
}

# Active profile state, set by pi_load_profile. Empty = strip models.
PI_PROFILE_SET=0
PI_MODEL_OPUS=""
PI_MODEL_SONNET=""
PI_MODEL_HAIKU=""
PI_MODELS_JSON="${CONTENT_ROOT:-}/targets/pi/models.json"

# Print the available profile names, one per line.
pi_profile_names() {
    jq -r '.profiles | keys[]' "$PI_MODELS_JSON" 2>/dev/null
}

# Usage: pi_load_profile <name>
# Loads the tier -> model ID map of profile <name> from models.json into the
# PI_MODEL_* globals. Returns 1 with an error (listing the available profiles)
# when jq or the file is missing or the profile is unknown. Call before any write.
pi_load_profile() {
    local name="$1" names filter
    if ! command -v jq &>/dev/null; then
        echo -e "${RED}Error: -P needs jq to read models.json${NC}" >&2
        return 1
    fi
    if [[ ! -f "$PI_MODELS_JSON" ]]; then
        echo -e "${RED}Error: ${PI_MODELS_JSON} not found${NC}" >&2
        return 1
    fi
    filter='.profiles[$p] // empty | [.opus // "", .sonnet // "", .haiku // ""] | .[]'
    if ! jq -e --arg p "$name" '.profiles[$p]' "$PI_MODELS_JSON" >/dev/null 2>&1; then
        names=$(pi_profile_names | tr '\n' ' ')
        echo -e "${RED}Error: Unknown profile '${name}' (available: ${names})${NC}" >&2
        return 1
    fi
    {
        IFS= read -r PI_MODEL_OPUS
        IFS= read -r PI_MODEL_SONNET
        IFS= read -r PI_MODEL_HAIKU
    } < <(jq -r --arg p "$name" "$filter" "$PI_MODELS_JSON")
    PI_PROFILE_SET=1
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
        case "$tool" in
            MODEL:*) log_warn "agents/${name}.md: model '${tool#MODEL:}' is not a profile tier; removed" ;;
            *) log_warn "agents/${name}.md: tool '${tool}' has no pi equivalent; dropped" ;;
        esac
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
