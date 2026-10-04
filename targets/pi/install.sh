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
# shellcheck source=../../scripts/lib/upstream-extensions.sh
source "${REPO_ROOT}/scripts/lib/upstream-extensions.sh"
# shellcheck source=../../scripts/lib/pi-agents.sh
source "${REPO_ROOT}/scripts/lib/pi-agents.sh"
PRUNE_TARGET="pi"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS] <language>...

Install shared configuration into pi (\$PI_CODING_AGENT_DIR or ~/.pi/agent):
  AGENTS.md          Global instructions + rules index (generated)
  instructions/      Rules files, read on demand via the index
  skills/            Skill folders (invoked via /skill:name), plus external
                     skills tracked in content/external-skills.json
  prompts/           Prompt templates, from the shared commands
  agents/            Subagent definitions: shared agents converted to pi's
                     tool names, plus worker/scout from
                     content/targets/pi/agents/
  extensions/        ecc-safety from content/targets/pi/extensions/, plus the
                     upstream extensions pinned in
                     content/targets/pi/upstream-extensions.json (fetched
                     with git; set ECC_SKIP_UPSTREAM=1 to skip)

Options:
  -f    Force overwrite existing files
  -n    Dry run
  -p    Prune orphaned files from previous installs (see .ecc-manifest);
        with no manifest yet, falls back to a git-history check
  -m    Accepted and ignored (pi has no MCP support here); lets
        'install.sh -m --target all' pass the flag to every target
  -l    List available languages and exit
  -h    Show this help
EOF
}

FORCE=false
DRY_RUN=false
PRUNE=false
while getopts "fnplhm" opt; do
    case $opt in
        f) FORCE=true ;;
        n) DRY_RUN=true ;;
        p) PRUNE=true ;;
        m) ;;
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
    echo -e "${CYAN}Dry run: showing what would be installed${NC}"
fi
echo -e "Installing: ${GREEN}${LANGUAGES[*]}${NC} → ${DEST_LABEL}/"
echo ""

$DRY_RUN || mkdir -p "$PI_DIR/instructions" "$PI_DIR/skills" "$PI_DIR/prompts" \
    "$PI_DIR/agents" "$PI_DIR/extensions"

# 1. Rules → instructions/
echo -e "${CYAN}[instructions]${NC}"
for lang in "${LANGUAGES[@]}"; do
    rules_dir="${CONTENT_ROOT}/rules/${lang}"
    [[ -d "$rules_dir" ]] || continue
    for f in "$rules_dir"/*.md; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        copy_file "$f" "${PI_DIR}/instructions/${name}" \
            "content/rules/${lang}/${name}" "instructions/${name}"
        manifest_add_file "$lang" "instructions/${name}" "$f" "${PI_DIR}/instructions/${name}"
    done
done
echo ""

# 2. AGENTS.md (generated: global instructions + pi addendum + rules index)
echo -e "${CYAN}[global]${NC}"
agents_tmp=$(mktemp)
ext_tmp=""  # per-entry clone dir of the external/upstream installers, covered by the trap
trap 'rm -f "$agents_tmp"; if [[ -n "$ext_tmp" ]]; then rm -rf "${ext_tmp:?}"; fi' EXIT
"${REPO_ROOT}/scripts/lib/build-agents-md.sh" "${DEST_LABEL}/instructions" pi "${LANGUAGES[@]}" > "$agents_tmp"
copy_file "$agents_tmp" "${PI_DIR}/AGENTS.md" \
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
        copy_dir "$skill_dir" "${PI_DIR}/skills/${skill_name}" \
            "content/skills/${lang}/${skill_name}/" "skills/${skill_name}/"
        manifest_add_dir "$lang" "skills/${skill_name}" "$skill_dir" "${PI_DIR}/skills/${skill_name}"
    done
done
echo ""

# 3.5 External skills (language-agnostic, kept out of the prune manifest).
install_external_skills "${PI_DIR}/skills" "skills" pi

# 4. Commands → prompts/. pi prompt templates take the same `description`
# frontmatter and $ARGUMENTS as the shared commands, so they copy as-is.
echo -e "${CYAN}[prompts]${NC}"
for lang in "${LANGUAGES[@]}"; do
    cmd_dir="${CONTENT_ROOT}/commands/${lang}"
    [[ -d "$cmd_dir" ]] || continue
    for f in "$cmd_dir"/*.md; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        copy_file "$f" "${PI_DIR}/prompts/${name}" \
            "content/commands/${lang}/${name}" "prompts/${name}"
        manifest_add_file "$lang" "prompts/${name}" "$f" "${PI_DIR}/prompts/${name}"
    done
done
echo ""

# 5. Agents → agents/ (read by the subagent extension). Shared agents get
# their tools: line converted; worker/scout are language-agnostic like codex
# roles, installed every time and kept out of the per-language manifest.
echo -e "${CYAN}[agents]${NC}"
for lang in "${LANGUAGES[@]}"; do
    agents_dir="${CONTENT_ROOT}/agents/${lang}"
    [[ -d "$agents_dir" ]] || continue
    for f in "$agents_dir"/*.md; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        dest="${PI_DIR}/agents/${name}"
        if ! $DRY_RUN && [[ -f "$dest" ]] && ! $FORCE; then
            log_skip "agents/${name}"
            skipped=$((skipped + 1))
        elif pi_convert_agent "$f" "$dest" "${name%.md}"; then
            if $DRY_RUN; then
                log_dry "content/agents/${lang}/${name}" "agents/${name}"
            else
                log_copy "content/agents/${lang}/${name}" "agents/${name}"
            fi
            copied=$((copied + 1))
        else
            skipped=$((skipped + 1))
        fi
        # Recorded as managed only if the dest is exactly what we install;
        # a skipped user file must never be pruned later.
        if $DRY_RUN || pi_agent_matches "$f" "$dest"; then
            manifest_add "$lang" "agents/${name}"
        else
            manifest_add_unowned "$lang" "agents/${name}"
        fi
    done
done
pi_agents_src="${CONTENT_ROOT}/targets/pi/agents"
if [[ -d "$pi_agents_src" ]]; then
    for f in "$pi_agents_src"/*.md; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        copy_file "$f" "${PI_DIR}/agents/${name}" \
            "content/targets/pi/agents/${name}" "agents/${name}"
        installed_unmanifested_add "agents/${name}"
    done
fi
echo ""

# 6. Extensions → extensions/<name>/: our own (ecc-safety), then upstream
# ones pinned in upstream-extensions.json. Language-agnostic, kept out of
# the prune manifest. Fetch failures warn and skip the entry.
echo -e "${CYAN}[extensions]${NC}"
ext_src_dir="${CONTENT_ROOT}/targets/pi/extensions"
if [[ -d "$ext_src_dir" ]]; then
    for ext_dir in "$ext_src_dir"/*/; do
        [[ -d "$ext_dir" ]] || continue
        ext_name=$(basename "$ext_dir")
        copy_dir "$ext_dir" "${PI_DIR}/extensions/${ext_name}" \
            "content/targets/pi/extensions/${ext_name}/" "extensions/${ext_name}/"
        installed_unmanifested_add "extensions/${ext_name}"
    done
fi
install_upstream_extensions "${PI_DIR}/extensions" "extensions"
echo ""

# Orphan pruning + manifest write (same flow as the codex target).
LANGS_NL=$(printf '%s\n' "${LANGUAGES[@]}")
run_prune "$PI_DIR" "$LANGS_NL" "$PRUNE"
manifest_write "$PI_DIR" "$LANGS_NL"

echo ""
echo "────────────────────────────────"
if $DRY_RUN; then
    echo -e "Would copy: ${GREEN}${copied}${NC} items"
else
    echo -e "Copied: ${GREEN}${copied}${NC}, Skipped: ${YELLOW}${skipped}${NC}"
    echo ""
    echo -e "${CYAN}Restart pi (or run /reload), then verify with /skill:name.${NC}"
fi
