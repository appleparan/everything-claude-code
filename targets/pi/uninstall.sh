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

Anything not listed by this repo's content (your own files) is left alone.

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
        remove_file "${PI_DIR}/instructions/${name}" "instructions/${name}"
    done
done
cleanup_empty_dir "${PI_DIR}/instructions" "instructions/"
echo ""

echo -e "${CYAN}[global]${NC}"
remove_file "${PI_DIR}/AGENTS.md" "AGENTS.md"
echo ""

echo -e "${CYAN}[skills]${NC}"
for lang in "${LANGUAGES[@]}"; do
    skills_dir="${CONTENT_ROOT}/skills/${lang}"
    [[ -d "$skills_dir" ]] || continue
    for skill_dir in "$skills_dir"/*/; do
        [[ -d "$skill_dir" ]] || continue
        skill_name=$(basename "$skill_dir")
        [[ "$skill_name" == .* ]] && continue
        remove_dir "${PI_DIR}/skills/${skill_name}" "skills/${skill_name}/"
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
            remove_dir "${PI_DIR}/skills/${ext_name}" "skills/${ext_name}/"
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
        remove_file "${PI_DIR}/prompts/${name}" "prompts/${name}"
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
        remove_file "${PI_DIR}/agents/${name}" "agents/${name}"
    done
done
pi_agents_src="${CONTENT_ROOT}/targets/pi/agents"
if [[ -d "$pi_agents_src" ]]; then
    for f in "$pi_agents_src"/*.md; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        remove_file "${PI_DIR}/agents/${name}" "agents/${name}"
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
        remove_dir "${PI_DIR}/extensions/${ext_name}" "extensions/${ext_name}/"
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
            remove_dir "${PI_DIR}/extensions/${ext_name}" "extensions/${ext_name}/"
        done < <(upstream_extension_names)
    else
        log_info "jq not found; remove upstream extensions from upstream-extensions.json manually"
    fi
fi
cleanup_empty_dir "${PI_DIR}/extensions" "extensions/"
echo ""

echo ""
echo "────────────────────────────────"
if $DRY_RUN; then
    echo -e "Would remove: ${RED}${removed}${NC} items"
else
    echo -e "Removed: ${RED}${removed}${NC}, Not found: ${YELLOW}${not_found}${NC}"
fi
