#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "${REPO_ROOT}/scripts/lib/common.sh"
# shellcheck source=target.sh
source "${SCRIPT_DIR}/target.sh"
# shellcheck source=../../scripts/lib/prune.sh
source "${REPO_ROOT}/scripts/lib/prune.sh"
# shellcheck source=../../scripts/lib/external-skills.sh
source "${REPO_ROOT}/scripts/lib/external-skills.sh"
PRUNE_TARGET="codex"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS] <language>...

Install shared configuration into Codex (\$CODEX_HOME or ~/.codex):
  AGENTS.md          Global instructions + rules index (generated)
  instructions/      Rules files, read on demand via the index
  skills/            Skill folders (invoked via \$skill-name), plus external
                     skills tracked in content/external-skills.json
  agents/            Custom subagent roles from content/targets/codex/agents/
                     (e.g. worker/explorer model overrides)
  plugins            Codex plugins from content/targets/codex/plugins.json, added with
                     'codex plugin add' (needs codex on PATH + network; set
                     ECC_SKIP_CODEX_PLUGINS=1 to skip)
  config.toml        [agents] defaults from content/targets/codex/config.toml always
                     merged (when uv is available); [mcp_servers.*] entries
                     merged only with -m (backup created before either write)

Options:
  -f    Force overwrite existing files / MCP entries
  -n    Dry run
  -p    Prune orphaned files from previous installs (see .ecc-manifest);
        with no manifest yet, falls back to a git-history check
  -m    Merge MCP servers from content/mcp/servers.json into config.toml
        (off by default)
  -l    List available languages and exit
  -h    Show this help
EOF
}

FORCE=false
DRY_RUN=false
PRUNE=false
MERGE_MCP=false
while getopts "fnplhm" opt; do
    case $opt in
        f) FORCE=true ;;
        n) DRY_RUN=true ;;
        p) PRUNE=true ;;
        m) MERGE_MCP=true ;;
        l) discover_languages; exit 0 ;;
        h) usage; exit 0 ;;
        *) usage; exit 1 ;;
    esac
done
shift $((OPTIND - 1))

if [[ $# -eq 0 ]]; then
    echo -e "${RED}Error: At least one language must be specified${NC}"
    usage
    exit 1
fi
LANGUAGES=("$@")

AVAILABLE_LANGS=$(discover_languages)
for lang in "${LANGUAGES[@]}"; do
    if ! echo "$AVAILABLE_LANGS" | grep -qx "$lang"; then
        echo -e "${RED}Error: Unknown language '${lang}'${NC}"
        exit 1
    fi
done

if ! target_is_available; then
    echo -e "${RED}Error: Codex not detected (set CODEX_HOME, create ~/.codex, or install codex)${NC}"
    exit 1
fi

if [[ -n "${CODEX_HOME:-}" ]]; then
    DEST_LABEL="$CODEX_DIR"
else
    DEST_LABEL="~/.codex"
fi

if $DRY_RUN; then
    echo -e "${CYAN}Dry run: showing what would be installed${NC}"
fi
echo -e "Installing: ${GREEN}${LANGUAGES[*]}${NC} → ${DEST_LABEL}/"
echo ""

$DRY_RUN || mkdir -p "$CODEX_DIR/instructions" "$CODEX_DIR/skills" "$CODEX_DIR/agents"

# 1. Rules → instructions/
echo -e "${CYAN}[instructions]${NC}"
for lang in "${LANGUAGES[@]}"; do
    rules_dir="${CONTENT_ROOT}/rules/${lang}"
    [[ -d "$rules_dir" ]] || continue
    for f in "$rules_dir"/*.md; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        copy_file "$f" "${CODEX_DIR}/instructions/${name}" \
            "content/rules/${lang}/${name}" "instructions/${name}"
        manifest_add "$lang" "instructions/${name}"
    done
done
echo ""

# 2. AGENTS.md (generated: global instructions + rules index)
echo -e "${CYAN}[global]${NC}"
agents_tmp=$(mktemp)
ext_tmp=""  # per-entry clone dir of install_external_skills, covered by the trap
trap 'rm -f "$agents_tmp"; if [[ -n "$ext_tmp" ]]; then rm -rf "${ext_tmp:?}"; fi' EXIT
"${REPO_ROOT}/scripts/lib/build-agents-md.sh" "${DEST_LABEL}/instructions" codex "${LANGUAGES[@]}" > "$agents_tmp"
copy_file "$agents_tmp" "${CODEX_DIR}/AGENTS.md" \
    "content/instructions/global.md (+rules index)" "AGENTS.md"
echo ""

# 3. Skills
echo -e "${CYAN}[skills]${NC}"
for lang in "${LANGUAGES[@]}"; do
    skills_dir="${CONTENT_ROOT}/skills/${lang}"
    [[ -d "$skills_dir" ]] || continue
    for skill_dir in "$skills_dir"/*/; do
        [[ -d "$skill_dir" ]] || continue
        skill_name=$(basename "$skill_dir")
        [[ "$skill_name" == .* ]] && continue
        copy_dir "$skill_dir" "${CODEX_DIR}/skills/${skill_name}" \
            "content/skills/${lang}/${skill_name}/" "skills/${skill_name}/"
        manifest_add "$lang" "skills/${skill_name}"
    done
done
echo ""

# 3.5 External skills, cloned from the repos tracked in external-skills.json.
# Language-agnostic like plugins.json: merged on every install, and kept out
# of the per-language prune manifest. Failures (offline, bad path) warn and
# skip the entry so the rest of the install still succeeds.
install_external_skills "${CODEX_DIR}/skills" "skills" codex

# 3.6 Custom subagent roles → agents/. Language-agnostic like external
# skills: installed on every install and kept out of the per-language
# manifest, since they are not tied to any one language's content.
echo -e "${CYAN}[agents]${NC}"
agents_src_dir="${CONTENT_ROOT}/targets/codex/agents"
if [[ -d "$agents_src_dir" ]]; then
    for f in "$agents_src_dir"/*.toml; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        copy_file "$f" "${CODEX_DIR}/agents/${name}" \
            "content/targets/codex/agents/${name}" "agents/${name}"
        installed_unmanifested_add "agents/${name}"
    done
fi
echo ""

# 3.7 Plugins, added with the codex CLI from content/targets/codex/plugins.json.
# Language-agnostic like external skills. Needs codex on PATH and network;
# every failure warns and skips the entry so the rest of the install passes.
plugins_src="${CONTENT_ROOT}/targets/codex/plugins.json"
JQ_CODEX_PLUGINS='(.plugins // [])[] | [.name // "", .marketplace // "", .source // "", .replaces_skill // ""] | @tsv'
if [[ -f "$plugins_src" ]]; then
    echo -e "${CYAN}[plugins]${NC}"
    if [[ "${ECC_SKIP_CODEX_PLUGINS:-}" == "1" ]]; then
        log_info "codex plugins skipped (ECC_SKIP_CODEX_PLUGINS=1)"
    elif ! command -v jq &>/dev/null; then
        log_warn "jq not found; skipping codex plugins"
    else
        plugins_added=0
        while IFS=$'\t' read -r p_name p_market p_source p_replaces; do
            [[ -n "$p_name" ]] || continue
            p_label="${p_source} (${p_name}@${p_market})"
            # Names become a plugin selector and a skills/ path: single safe segments only.
            p_bad=false
            for p_seg in "$p_name" "$p_market" "$p_replaces"; do
                case "$p_seg" in
                    .|..|*/*|*'\'*) p_bad=true ;;
                esac
            done
            if [[ -z "$p_market" || -z "$p_source" || "$p_source" == -* ]]; then
                p_bad=true
            fi
            if $p_bad; then
                log_warn "plugins: invalid entry '${p_name}'; skipped"
                continue
            fi
            if $DRY_RUN; then
                log_dry "$p_label" "codex plugin add"
                copied=$((copied + 1))
                continue
            fi
            if ! command -v codex &>/dev/null; then
                log_warn "codex not found; run by hand: codex plugin marketplace add ${p_source} && codex plugin add ${p_name}@${p_market}"
                continue
            fi
            if ! p_err=$(codex plugin marketplace add "$p_source" </dev/null 2>&1); then
                log_warn "${p_label}: marketplace add failed ($(printf '%s\n' "$p_err" | tail -n 1)); skipped"
                continue
            fi
            if ! p_err=$(codex plugin add "${p_name}@${p_market}" </dev/null 2>&1); then
                log_warn "${p_label}: plugin add failed ($(printf '%s\n' "$p_err" | tail -n 1)); skipped"
                continue
            fi
            log_copy "$p_label" "codex plugin"
            copied=$((copied + 1))
            plugins_added=$((plugins_added + 1))
            # The plugin now ships this skill: drop the external copy installed above.
            p_skill="${CODEX_DIR}/skills/${p_replaces}"
            if [[ -n "$p_replaces" && -d "$p_skill" && ! -L "$p_skill" && -f "${p_skill}/${EXTERNAL_MARKER}" ]]; then
                rm -r "$p_skill"
                log_info "skills/${p_replaces}/ removed: the plugin now provides this skill"
            fi
        done < <(jq -r "$JQ_CODEX_PLUGINS" "$plugins_src")
        if [[ "$plugins_added" -gt 0 ]]; then
            log_info "plugin hooks need a one-time trust: run /hooks inside Codex"
        fi
    fi
    echo ""
fi

# 4. [agents] defaults → config.toml. Always merged when uv is available;
# this is independent of -m (MERGE_MCP only gates the [mcp] step below).
config_fragment="${CONTENT_ROOT}/targets/codex/config.toml"
if [[ -f "$config_fragment" ]]; then
    echo -e "${CYAN}[config]${NC}"
    if command -v uv &>/dev/null; then
        cfg_args=(--config "${CODEX_DIR}/config.toml" --fragment "$config_fragment")
        $FORCE && cfg_args+=(--force)
        $DRY_RUN && cfg_args+=(--dry-run)
        uv run --with tomlkit python3 "${SCRIPT_DIR}/merge-config.py" "${cfg_args[@]}" \
            | sed 's/^/  /'
    else
        log_warn "uv not found; skipping [agents] defaults merge into config.toml"
        log_warn "Add [agents] defaults from content/targets/codex/config.toml manually"
    fi
fi

# 5. MCP servers → config.toml (key-scoped merge, backup created). Opt-in
# only via -m: config.toml is user state and MCP servers are not installed
# by default.
echo -e "${CYAN}[mcp]${NC}"
if $MERGE_MCP; then
    if command -v uv &>/dev/null; then
        merge_args=(--config "${CODEX_DIR}/config.toml" --servers "${CONTENT_ROOT}/mcp/servers.json")
        merge_args+=(--languages "${LANGUAGES[@]}")
        $FORCE && merge_args+=(--force)
        $DRY_RUN && merge_args+=(--dry-run)
        uv run --with tomlkit python3 "${SCRIPT_DIR}/merge-mcp.py" "${merge_args[@]}" \
            | sed 's/^/  /'
    else
        log_warn "uv not found; skipping MCP merge into config.toml"
        log_warn "Add servers from content/mcp/servers.json manually"
    fi
else
    log_info "skipped (pass -m to merge content/mcp/servers.json into config.toml)"
fi

# Orphan pruning + manifest write. run_prune lists/deletes based on the old
# manifest (or falls back to git history when no manifest exists yet and -p
# was given); manifest_write always seeds/refreshes the manifest for next
# time, except on dry-run where it is a no-op.
LANGS_NL=$(printf '%s\n' "${LANGUAGES[@]}")
run_prune "$CODEX_DIR" "$LANGS_NL" "$PRUNE"
manifest_write "$CODEX_DIR" "$LANGS_NL"

echo ""
echo "────────────────────────────────"
if $DRY_RUN; then
    echo -e "Would copy: ${GREEN}${copied}${NC} items"
else
    echo -e "Copied: ${GREEN}${copied}${NC}, Skipped: ${YELLOW}${skipped}${NC}"
    echo ""
    echo -e "${CYAN}Restart Codex, then verify skill discovery with \$skill-name.${NC}"
fi
