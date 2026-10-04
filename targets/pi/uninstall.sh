#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "${REPO_ROOT}/scripts/lib/common.sh"
# shellcheck source=target.sh
source "${SCRIPT_DIR}/target.sh"
# shellcheck source=../../scripts/lib/external-skills.sh
source "${REPO_ROOT}/scripts/lib/external-skills.sh"
# shellcheck source=../../scripts/lib/upstream-extensions.sh
source "${REPO_ROOT}/scripts/lib/upstream-extensions.sh"
# shellcheck source=../../scripts/lib/prune.sh
source "${REPO_ROOT}/scripts/lib/prune.sh"
# shellcheck source=../../scripts/lib/pi-agents.sh
source "${REPO_ROOT}/scripts/lib/pi-agents.sh"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS] <language>...

Uninstall shared configuration from pi (\$PI_CODING_AGENT_DIR or ~/.pi/agent):
  AGENTS.md          Global instructions + rules index (generated)
  instructions/      Rules files, read on demand via the index
  skills/            Skill folders, plus external skills tracked in
                     content/external-skills.json
  prompts/           Prompt templates installed from the shared commands
  agents/            Shared agents, plus worker/scout
  extensions/        ecc-safety and the upstream extensions pinned in
                     content/targets/pi/upstream-extensions.json

Only what install wrote is removed. Entries listed in .ecc-manifest are ours
even if edited; everything else (AGENTS.md, worker/scout, ecc-safety, files
install skipped) must still be identical to the shipped version. Upstream
extensions need the .ecc-upstream marker, external skills .ecc-external.
Symlinks and your own files are kept (logged as SKIP).

Options:
  -P <profile>
        The profile the install used, so identity checks render agents the
        same way (files owned by the manifest are removed either way)
  -n    Dry run (show what would be removed without removing)
  -l    List available languages and exit
  -h    Show this help
EOF
}

# True (0) iff relpath $1 is a real (non-symlink) dest listed in the manifest.
owned_in_manifest() {
    [[ ! -L "${PI_DIR}/${1%/}" ]] && manifest_lists "$PI_DIR" "${1%/}"
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

# Remove dir $3 only if its index.ts is byte-identical to $1.
remove_dir_if_ours() {
    local src_index="$1" target="$2" label="$3"
    if [[ ! -e "$target" && ! -L "$target" ]] \
        || { [[ ! -L "$target" ]] && dest_same_file "$src_index" "${target}/index.ts"; }; then
        remove_dir "$target" "$label"
    else
        log_keep "$label"
    fi
}

DRY_RUN=false
PROFILE=""
while getopts "nlhP:" opt; do
    case $opt in
        n) DRY_RUN=true ;;
        P) PROFILE="$OPTARG" ;;
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

if [[ -n "$PROFILE" ]]; then
    pi_load_profile "$PROFILE" || exit 1
fi

if ! target_is_available; then
    echo -e "${RED}Error: pi not detected (set PI_CODING_AGENT_DIR, create ~/.pi, or install pi)${NC}"
    exit 1
fi

if [[ -n "${PI_CODING_AGENT_DIR:-}" ]]; then
    DEST_LABEL="$PI_DIR"
else
    DEST_LABEL="~/.pi/agent"
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
        remove_file_if_same "$f" "${PI_DIR}/instructions/${name}" "instructions/${name}"
    done
done
cleanup_empty_dir "${PI_DIR}/instructions" "instructions/"
echo ""

echo -e "${CYAN}[global]${NC}"
# AGENTS.md is generated; a user-authored one lacks the harness heading.
if [[ -L "${PI_DIR}/AGENTS.md" ]] \
    || { [[ -f "${PI_DIR}/AGENTS.md" ]] && ! grep -Fxq -- '## Harness: pi' "${PI_DIR}/AGENTS.md"; }; then
    log_keep "AGENTS.md"
else
    remove_file "${PI_DIR}/AGENTS.md" "AGENTS.md"
fi
echo ""

echo -e "${CYAN}[skills]${NC}"
for lang in "${LANGUAGES[@]}"; do
    skills_dir="${CONTENT_ROOT}/skills/${lang}"
    [[ -d "$skills_dir" ]] || continue
    for skill_dir in "$skills_dir"/*/; do
        [[ -d "$skill_dir" ]] || continue
        skill_name=$(basename "$skill_dir")
        [[ "$skill_name" == .* ]] && continue
        remove_dir_if_same "$skill_dir" "${PI_DIR}/skills/${skill_name}" "skills/${skill_name}/"
    done
done
# Tracked external skills are language-agnostic: uninstalling any language
# removes all entries that apply to pi.
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
            ext_dest="${PI_DIR}/skills/${ext_name}"
            if [[ ! -e "$ext_dest" && ! -L "$ext_dest" ]] \
                || { [[ ! -L "$ext_dest" && -f "${ext_dest}/${EXTERNAL_MARKER}" ]]; }; then
                remove_dir "$ext_dest" "skills/${ext_name}/"
            else
                log_keep "skills/${ext_name}/"
            fi
        done < <(external_skill_names pi)
    else
        log_info "jq not found; remove external skills from external-skills.json manually"
    fi
fi
cleanup_empty_dir "${PI_DIR}/skills" "skills/"
echo ""

echo -e "${CYAN}[prompts]${NC}"
for lang in "${LANGUAGES[@]}"; do
    cmd_dir="${CONTENT_ROOT}/commands/${lang}"
    [[ -d "$cmd_dir" ]] || continue
    for f in "$cmd_dir"/*.md; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        remove_file_if_same "$f" "${PI_DIR}/prompts/${name}" "prompts/${name}"
    done
done
cleanup_empty_dir "${PI_DIR}/prompts" "prompts/"
echo ""

echo -e "${CYAN}[agents]${NC}"
for lang in "${LANGUAGES[@]}"; do
    agents_dir="${CONTENT_ROOT}/agents/${lang}"
    [[ -d "$agents_dir" ]] || continue
    for f in "$agents_dir"/*.md; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        # Compare with what install would write now (tools: line converted).
        dest="${PI_DIR}/agents/${name}"
        if [[ ! -e "$dest" && ! -L "$dest" ]] || owned_in_manifest "agents/${name}" \
            || pi_agent_matches "$f" "$dest"; then
            remove_file "$dest" "agents/${name}"
        else
            log_keep "agents/${name}"
        fi
    done
done
pi_agents_src="${CONTENT_ROOT}/targets/pi/agents"
if [[ -d "$pi_agents_src" ]]; then
    for f in "$pi_agents_src"/*.md; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        dest="${PI_DIR}/agents/${name}"
        if [[ ! -e "$dest" && ! -L "$dest" ]] || owned_in_manifest "agents/${name}" \
            || pi_agent_matches "$f" "$dest"; then
            remove_file "$dest" "agents/${name}"
        else
            log_keep "agents/${name}"
        fi
    done
fi
cleanup_empty_dir "${PI_DIR}/agents" "agents/"
echo ""

echo -e "${CYAN}[extensions]${NC}"
ext_src_dir="${CONTENT_ROOT}/targets/pi/extensions"
if [[ -d "$ext_src_dir" ]]; then
    for ext_dir in "$ext_src_dir"/*/; do
        [[ -d "$ext_dir" ]] || continue
        ext_name=$(basename "$ext_dir")
        # Our own extension: only when its entry point is still ours.
        if [[ -f "${ext_dir}index.ts" ]]; then
            remove_dir_if_ours "${ext_dir}index.ts" "${PI_DIR}/extensions/${ext_name}" "extensions/${ext_name}/"
        else
            remove_dir "${PI_DIR}/extensions/${ext_name}" "extensions/${ext_name}/"
        fi
    done
fi
if [[ -f "$UPSTREAM_EXTENSIONS_JSON" ]]; then
    if command -v jq &>/dev/null; then
        while IFS= read -r ext_name; do
            [[ -n "$ext_name" ]] || continue
            if ! upstream_safe_name "$ext_name"; then
                log_warn "extensions: invalid name '${ext_name}'; skipped"
                continue
            fi
            # Upstream dirs are ours only when install left its marker.
            if [[ ! -e "${PI_DIR}/extensions/${ext_name}" ]] \
                || [[ -f "${PI_DIR}/extensions/${ext_name}/${UPSTREAM_MARKER}" \
                    && ! -L "${PI_DIR}/extensions/${ext_name}" ]]; then
                remove_dir "${PI_DIR}/extensions/${ext_name}" "extensions/${ext_name}/"
            else
                log_keep "extensions/${ext_name}/"
            fi
        done < <(upstream_extension_names)
    else
        log_info "jq not found; remove upstream extensions from upstream-extensions.json manually"
    fi
fi
cleanup_empty_dir "${PI_DIR}/extensions" "extensions/"
echo ""

$DRY_RUN || manifest_prune_missing "$PI_DIR"

echo ""
echo "────────────────────────────────"
if $DRY_RUN; then
    echo -e "Would remove: ${RED}${removed}${NC} items"
else
    echo -e "Removed: ${RED}${removed}${NC}, Not found: ${YELLOW}${not_found}${NC}"
fi
