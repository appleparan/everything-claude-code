#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "${REPO_ROOT}/scripts/lib/common.sh"
# shellcheck source=target.sh
source "${SCRIPT_DIR}/target.sh"
# shellcheck source=../../scripts/lib/external-skills.sh
source "${REPO_ROOT}/scripts/lib/external-skills.sh"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS] <language>...

Uninstall shared configuration from Codex (\$CODEX_HOME or ~/.codex):
  AGENTS.md          Global instructions + rules index (generated)
  instructions/      Rules files, read on demand via the index
  skills/            Skill folders (invoked via \$skill-name), plus external
                     skills tracked in content/external-skills.json
  agents/            Custom subagent roles from content/targets/codex/agents/
  plugins            Codex plugins from content/targets/codex/plugins.json, removed with
                     'codex plugin remove' (set ECC_SKIP_CODEX_PLUGINS=1 to skip).
                     Only plugins listed in .ecc-codex-plugins (written by
                     install.sh) are removed; the marketplace is removed only
                     when install.sh added it too.
  config.toml        Left untouched (user state); manual-removal hints printed

Options:
  -n    Dry run (show what would be removed without removing)
  -l    List available languages and exit
  -h    Show this help
EOF
}

DRY_RUN=false
while getopts "nlh" opt; do
    case $opt in
        n) DRY_RUN=true ;;
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
    echo -e "${CYAN}Dry run: showing what would be removed${NC}"
fi
echo -e "Uninstalling: ${RED}${LANGUAGES[*]}${NC} from ${DEST_LABEL}/"
echo ""

echo -e "${CYAN}[instructions]${NC}"
for lang in "${LANGUAGES[@]}"; do
    rules_dir="${CONTENT_ROOT}/rules/${lang}"
    [[ -d "$rules_dir" ]] || continue
    for f in "$rules_dir"/*.md; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        remove_file "${CODEX_DIR}/instructions/${name}" "instructions/${name}"
    done
done
cleanup_empty_dir "${CODEX_DIR}/instructions" "instructions/"
echo ""

echo -e "${CYAN}[global]${NC}"
remove_file "${CODEX_DIR}/AGENTS.md" "AGENTS.md"
echo ""

echo -e "${CYAN}[skills]${NC}"
for lang in "${LANGUAGES[@]}"; do
    skills_dir="${CONTENT_ROOT}/skills/${lang}"
    [[ -d "$skills_dir" ]] || continue
    for skill_dir in "$skills_dir"/*/; do
        [[ -d "$skill_dir" ]] || continue
        skill_name=$(basename "$skill_dir")
        [[ "$skill_name" == .* ]] && continue
        remove_dir "${CODEX_DIR}/skills/${skill_name}" "skills/${skill_name}/"
    done
done
# Tracked external skills (content/external-skills.json) are
# language-agnostic: uninstalling any language removes all tracked entries,
# mirroring the plugins.json semantics on the Claude side.
ext_src="${CONTENT_ROOT}/external-skills.json"
if [[ -f "$ext_src" ]]; then
    if command -v jq &>/dev/null; then
        while IFS= read -r ext_name; do
            [[ -n "$ext_name" ]] || continue
            # Twin of the install-side guard: never delete outside skills/.
            case "$ext_name" in
                .|..|*/*|*'\'*)
                    log_warn "skills: invalid name '${ext_name}'; skipped"
                    continue ;;
            esac
            remove_dir "${CODEX_DIR}/skills/${ext_name}" "skills/${ext_name}/"
        done < <(external_skill_names codex)
    else
        log_info "jq not found; remove external skills from external-skills.json manually"
    fi
fi
cleanup_empty_dir "${CODEX_DIR}/skills" "skills/"
echo ""

echo -e "${CYAN}[agents]${NC}"
agents_src_dir="${CONTENT_ROOT}/targets/codex/agents"
if [[ -d "$agents_src_dir" ]]; then
    for f in "$agents_src_dir"/*.toml; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        remove_file "${CODEX_DIR}/agents/${name}" "agents/${name}"
    done
fi
cleanup_empty_dir "${CODEX_DIR}/agents" "agents/"
echo ""

echo -e "${CYAN}[plugins]${NC}"
plugins_src="${CONTENT_ROOT}/targets/codex/plugins.json"
JQ_CODEX_PLUGINS='(.plugins // [])[] | [.name // "", .marketplace // "", .replaces_skill // ""] | map(tostring) | join("\u001f")'
plugins_state="${CODEX_DIR}/.ecc-codex-plugins"
if [[ -f "$plugins_src" ]]; then
    if [[ "${ECC_SKIP_CODEX_PLUGINS:-}" == "1" ]]; then
        log_info "codex plugins skipped (ECC_SKIP_CODEX_PLUGINS=1)"
    elif ! command -v jq &>/dev/null; then
        log_info "jq not found; run codex plugin remove for the entries in plugins.json manually"
    else
        # Selectors whose state lines were processed; dropped from the state file at the end.
        done_sels=""
        while IFS=$'\x1f' read -r p_name p_market p_replaces; do
            [[ -n "$p_name" ]] || continue
            p_label="codex plugin ${p_name}@${p_market}"
            p_bad=false
            for p_seg in "$p_name" "$p_market"; do
                case "$p_seg" in
                    ''|.|..|*/*|*'\'*) p_bad=true ;;
                esac
            done
            case "$p_replaces" in
                .|..|*/*|*'\'*) p_bad=true ;;
            esac
            if $p_bad; then
                log_warn "plugins: invalid entry '${p_name}'; skipped"
                continue
            fi
            # Stale copy an older install left in skills/ (real dir with the marker only).
            if [[ -n "$p_replaces" ]]; then
                p_skill="${CODEX_DIR}/skills/${p_replaces}"
                if [[ -d "$p_skill" && ! -L "$p_skill" && -f "${p_skill}/${EXTERNAL_MARKER}" ]]; then
                    remove_dir "$p_skill" "skills/${p_replaces}/"
                fi
            fi
            p_sel="${p_name}@${p_market}"
            p_flag=""
            if [[ -f "$plugins_state" && ! -L "$plugins_state" ]]; then
                p_flag=$(awk -F'\t' -v s="$p_sel" '$1 == s { print $2; exit }' "$plugins_state")
            fi
            if [[ -z "$p_flag" ]]; then
                log_keep "$p_label"
                continue
            fi
            if $DRY_RUN; then
                log_dry_rm "$p_label"
                removed=$((removed + 1))
                continue
            fi
            if ! command -v codex &>/dev/null; then
                log_warn "codex not found; run by hand: codex plugin remove ${p_sel}$([[ "$p_flag" == "1" ]] && printf ' && codex plugin marketplace remove %s' "$p_market")"
                continue
            fi
            if ! codex plugin remove "$p_sel" </dev/null >/dev/null 2>&1; then
                log_warn "${p_label}: remove failed or not installed"
                not_found=$((not_found + 1))
                continue
            fi
            if [[ "$p_flag" == "1" ]]; then
                if ! codex plugin marketplace remove "$p_market" </dev/null >/dev/null 2>&1; then
                    log_warn "marketplace ${p_market}: remove failed; run: codex plugin marketplace remove ${p_market}"
                fi
            fi
            log_rm "$p_label"
            removed=$((removed + 1))
            done_sels="${done_sels}${p_sel}"$'\n'
        done < <(jq -r "$JQ_CODEX_PLUGINS" "$plugins_src")
        # Drop processed lines; delete the state file when nothing is left.
        if [[ -n "$done_sels" && -f "$plugins_state" && ! -L "$plugins_state" ]] && ! $DRY_RUN; then
            p_tmp=$(mktemp "${CODEX_DIR}/.ecc-codex-plugins.XXXXXX")
            if printf '%s' "$done_sels" | awk -F'\t' 'NR == FNR { if ($0 != "") d[$0] = 1; next } !($1 in d)' - "$plugins_state" > "$p_tmp"; then
                if [[ -s "$p_tmp" ]]; then
                    mv "$p_tmp" "$plugins_state"
                else
                    rm -f "$p_tmp" "$plugins_state"
                fi
            else
                rm -f "$p_tmp"
                log_warn "could not update ${plugins_state}"
            fi
        fi
    fi
fi
echo ""

echo -e "${CYAN}[config]${NC}"
log_info "config.toml is user state and is left untouched."
if command -v jq &>/dev/null; then
    while IFS= read -r name; do
        log_info "remove [mcp_servers.${name}] from ${DEST_LABEL}/config.toml manually if unwanted"
    done < <(jq -r '.mcpServers | keys[]' "${CONTENT_ROOT}/mcp/servers.json")
fi
log_info "remove [agents] default_subagent_model (installed from content/targets/codex/config.toml) from ${DEST_LABEL}/config.toml manually if unwanted"

echo ""
echo "────────────────────────────────"
if $DRY_RUN; then
    echo -e "Would remove: ${RED}${removed}${NC} items"
else
    echo -e "Removed: ${RED}${removed}${NC}, Not found: ${YELLOW}${not_found}${NC}"
fi
