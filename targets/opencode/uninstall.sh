#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "${REPO_ROOT}/scripts/lib/common.sh"
# shellcheck source=target.sh
source "${SCRIPT_DIR}/target.sh"
# shellcheck source=../../scripts/lib/external-skills.sh
source "${REPO_ROOT}/scripts/lib/external-skills.sh"
# shellcheck source=../../scripts/lib/prune.sh
source "${REPO_ROOT}/scripts/lib/prune.sh"
# shellcheck source=../../scripts/lib/opencode-agents.sh
source "${REPO_ROOT}/scripts/lib/opencode-agents.sh"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS] <language>...

Uninstall shared configuration from OpenCode (\$OPENCODE_CONFIG_DIR, else
\$XDG_CONFIG_HOME/opencode, else ~/.config/opencode):
  AGENTS.md          Global instructions + rules index (generated)
  instructions/      Rules files, read on demand via the index
  skills/            Skill folders, plus external skills tracked in
                     content/external-skills.json
  commands/          Slash commands installed from the shared commands
  agents/            Shared agents converted for OpenCode
  opencode.json      Ask-before rules for destructive shell commands

Only what install wrote is removed. Entries listed in .ecc-manifest are ours
even if edited; everything else (AGENTS.md, opencode.json, files install
skipped) must still be identical to the shipped version. External skills need
the .ecc-external marker. Symlinks and your own files are kept (logged as
SKIP). opencode.jsonc is never touched.

Options:
  -n    Dry run (show what would be removed without removing)
  -l    List available languages and exit
  -h    Show this help
EOF
}

# True (0) iff relpath $1 is a real (non-symlink) dest listed in the manifest.
owned_in_manifest() {
    [[ ! -L "${OPENCODE_DIR}/${1%/}" ]] && manifest_lists "$OPENCODE_DIR" "${1%/}"
}

# Remove file $2 if the manifest owns it or it is byte-identical to $1;
# otherwise keep it. $3 is the label (also the relpath). A missing dest
# reports MISS like remove_file.
remove_file_if_same() {
    local src="$1" target="$2" label="$3"
    if [[ ! -e "$target" && ! -L "$target" ]] || owned_in_manifest "$label" || dest_same_file "$src" "$target"; then
        remove_file "$target" "$label"
    else
        log_keep "$label"
    fi
}

# Remove directory $2 only if it has exactly the files of $1.
remove_dir_if_same() {
    local src="$1" target="$2" label="$3"
    if [[ ! -e "$target" && ! -L "$target" ]] || owned_in_manifest "$label" || dest_same_dir "$src" "$target"; then
        remove_dir "$target" "$label"
    else
        log_keep "$label"
    fi
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
    echo -e "${RED}Error: OpenCode not detected (set OPENCODE_CONFIG_DIR, create ~/.config/opencode, or install opencode)${NC}"
    exit 1
fi

DEST_LABEL="$(opencode_dest_label)"

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
        remove_file_if_same "$f" "${OPENCODE_DIR}/instructions/${name}" "instructions/${name}"
    done
done
cleanup_empty_dir "${OPENCODE_DIR}/instructions" "instructions/"
echo ""

echo -e "${CYAN}[global]${NC}"
# AGENTS.md is generated; a user-authored one lacks the harness heading.
if [[ -L "${OPENCODE_DIR}/AGENTS.md" ]] \
    || { [[ -f "${OPENCODE_DIR}/AGENTS.md" ]] && ! grep -Fxq -- '## Harness: OpenCode' "${OPENCODE_DIR}/AGENTS.md"; }; then
    log_keep "AGENTS.md"
else
    remove_file "${OPENCODE_DIR}/AGENTS.md" "AGENTS.md"
fi
# opencode.json: ours only when it is still the shipped file. A user-owned
# one (skipped at install) stays, and opencode.jsonc is never looked at.
remove_file_if_same "${CONTENT_ROOT}/targets/opencode/opencode.json" \
    "${OPENCODE_DIR}/opencode.json" "opencode.json"
echo ""

echo -e "${CYAN}[skills]${NC}"
for lang in "${LANGUAGES[@]}"; do
    skills_dir="${CONTENT_ROOT}/skills/${lang}"
    [[ -d "$skills_dir" ]] || continue
    for skill_dir in "$skills_dir"/*/; do
        [[ -d "$skill_dir" ]] || continue
        skill_name=$(basename "$skill_dir")
        [[ "$skill_name" == .* ]] && continue
        remove_dir_if_same "$skill_dir" "${OPENCODE_DIR}/skills/${skill_name}" "skills/${skill_name}/"
    done
done
# Tracked external skills are language-agnostic: uninstalling any language
# removes all entries that apply to opencode.
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
            # Ours only when install left its marker (a same-named user skill has none).
            ext_dest="${OPENCODE_DIR}/skills/${ext_name}"
            if [[ ! -e "$ext_dest" && ! -L "$ext_dest" ]] \
                || { [[ ! -L "$ext_dest" && -f "${ext_dest}/${EXTERNAL_MARKER}" ]]; }; then
                remove_dir "$ext_dest" "skills/${ext_name}/"
            else
                log_keep "skills/${ext_name}/"
            fi
        done < <(external_skill_names opencode)
    else
        log_info "jq not found; remove external skills from external-skills.json manually"
    fi
fi
cleanup_empty_dir "${OPENCODE_DIR}/skills" "skills/"
echo ""

echo -e "${CYAN}[commands]${NC}"
for lang in "${LANGUAGES[@]}"; do
    cmd_dir="${CONTENT_ROOT}/commands/${lang}"
    [[ -d "$cmd_dir" ]] || continue
    for f in "$cmd_dir"/*.md; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        remove_file_if_same "$f" "${OPENCODE_DIR}/commands/${name}" "commands/${name}"
    done
done
cleanup_empty_dir "${OPENCODE_DIR}/commands" "commands/"
echo ""

echo -e "${CYAN}[agents]${NC}"
for lang in "${LANGUAGES[@]}"; do
    agents_dir="${CONTENT_ROOT}/agents/${lang}"
    [[ -d "$agents_dir" ]] || continue
    for f in "$agents_dir"/*.md; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        # Compare with what install would write now (converted frontmatter).
        dest="${OPENCODE_DIR}/agents/${name}"
        if [[ ! -e "$dest" && ! -L "$dest" ]] || owned_in_manifest "agents/${name}" \
            || opencode_agent_matches "$f" "$dest"; then
            remove_file "$dest" "agents/${name}"
        else
            log_keep "agents/${name}"
        fi
    done
done
cleanup_empty_dir "${OPENCODE_DIR}/agents" "agents/"
echo ""

$DRY_RUN || manifest_prune_missing "$OPENCODE_DIR"

echo ""
echo "────────────────────────────────"
if $DRY_RUN; then
    echo -e "Would remove: ${RED}${removed}${NC} items"
else
    echo -e "Removed: ${RED}${removed}${NC}, Not found: ${YELLOW}${not_found}${NC}"
fi
