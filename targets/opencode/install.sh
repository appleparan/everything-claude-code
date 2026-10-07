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
# shellcheck source=../../scripts/lib/opencode-agents.sh
source "${REPO_ROOT}/scripts/lib/opencode-agents.sh"
PRUNE_TARGET="opencode"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS] <language>...

Install shared configuration into OpenCode (\$OPENCODE_CONFIG_DIR, else
\$XDG_CONFIG_HOME/opencode, else ~/.config/opencode):
  AGENTS.md          Global instructions + rules index (generated)
  instructions/      Rules files, read on demand via the index
  skills/            Skill folders, plus external skills tracked in
                     content/external-skills.json
  commands/          Slash commands, copied as-is from the shared commands
  agents/            Subagent definitions: shared agents converted to
                     OpenCode's format (no tools/model lines, mode: subagent,
                     read-only agents get permission denies)
  plugins/           Plugins from content/targets/opencode/plugins (the
                     simple-english plugin adds the skill to every turn)
  opencode.json      Ask-before rules for destructive shell commands

Options:
  -f    Force overwrite existing files
  -n    Dry run
  -p    Prune orphaned files from previous installs (see .ecc-manifest);
        with no manifest yet, falls back to a git-history check
  -m    Accepted and ignored (no MCP support for OpenCode here); lets
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
    echo -e "${RED}Error: OpenCode not detected (set OPENCODE_CONFIG_DIR, create ~/.config/opencode, or install opencode)${NC}"
    exit 1
fi

DEST_LABEL="$(opencode_dest_label)"

if $DRY_RUN; then
    echo -e "${CYAN}Dry run: showing what would be installed${NC}"
fi
echo -e "Installing: ${GREEN}${LANGUAGES[*]}${NC} → ${DEST_LABEL}/"
echo ""

$DRY_RUN || mkdir -p "$OPENCODE_DIR/instructions" "$OPENCODE_DIR/skills" \
    "$OPENCODE_DIR/commands" "$OPENCODE_DIR/agents" "$OPENCODE_DIR/plugins"

# 1. Rules → instructions/
echo -e "${CYAN}[instructions]${NC}"
for lang in "${LANGUAGES[@]}"; do
    rules_dir="${CONTENT_ROOT}/rules/${lang}"
    [[ -d "$rules_dir" ]] || continue
    for f in "$rules_dir"/*.md; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        copy_file "$f" "${OPENCODE_DIR}/instructions/${name}" \
            "content/rules/${lang}/${name}" "instructions/${name}"
        manifest_add_file "$lang" "instructions/${name}" "$f" "${OPENCODE_DIR}/instructions/${name}"
    done
done
echo ""

# 2. AGENTS.md (generated: global instructions + OpenCode addendum + rules index)
echo -e "${CYAN}[global]${NC}"
agents_tmp=$(mktemp)
ext_tmp=""  # per-entry clone dir of the external installer, covered by the trap
trap 'rm -f "$agents_tmp"; if [[ -n "$ext_tmp" ]]; then rm -rf "${ext_tmp:?}"; fi' EXIT
"${REPO_ROOT}/scripts/lib/build-agents-md.sh" "${DEST_LABEL}/instructions" opencode "${LANGUAGES[@]}" > "$agents_tmp"
copy_file "$agents_tmp" "${OPENCODE_DIR}/AGENTS.md" \
    "content/instructions/global.md (+rules index)" "AGENTS.md"

# opencode.json holds ask-before rules for destructive shell commands (rm -r,
# sudo, force pushes, git reset --hard, --no-verify, ...). OpenCode loads
# opencode.json and then opencode.jsonc from the same directory and
# concatenates their permissions, last match wins, so rules in the user's own
# opencode.jsonc load later and override these. A pattern such as
# `git push --force*` also matches --force-with-lease, which then asks too;
# that is acceptable. A user's opencode.json can hold providers, API keys and
# MCP servers, so it is never overwritten (not even with -f), never parsed or
# merged: we write the file only when it is absent, still the shipped file, or
# an earlier shipped version; otherwise WARN and leave it to the user.
oc_json_src="${CONTENT_ROOT}/targets/opencode/opencode.json"
oc_json_dest="${OPENCODE_DIR}/opencode.json"
if [[ -L "$oc_json_dest" ]]; then
    log_symlink "opencode.json"
    skipped=$((skipped + 1))
elif [[ ! -e "$oc_json_dest" ]] || opencode_json_is_ours "$oc_json_dest"; then
    # An earlier shipped version is upgraded even without -f.
    saved_force=$FORCE
    dest_same_file "$oc_json_src" "$oc_json_dest" || FORCE=true
    copy_file "$oc_json_src" "$oc_json_dest" \
        "content/targets/opencode/opencode.json" "opencode.json"
    FORCE=$saved_force
else
    if command -v git &>/dev/null && git -C "$REPO_ROOT" rev-parse &>/dev/null; then
        log_warn "opencode.json exists and differs from the shipped version; left untouched. Merge the permissions array from content/targets/opencode/opencode.json into your own config by hand"
    else
        log_warn "opencode.json differs from the shipped version (older shipped versions cannot be recognized without git); left untouched. Merge the permissions array from content/targets/opencode/opencode.json into your own config by hand"
    fi
    skipped=$((skipped + 1))
fi
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
        copy_dir "$skill_dir" "${OPENCODE_DIR}/skills/${skill_name}" \
            "content/skills/${lang}/${skill_name}/" "skills/${skill_name}/"
        manifest_add_dir "$lang" "skills/${skill_name}" "$skill_dir" "${OPENCODE_DIR}/skills/${skill_name}"
    done
done
echo ""

# 3.5 External skills (language-agnostic, kept out of the prune manifest).
install_external_skills "${OPENCODE_DIR}/skills" "skills" opencode

# 3.6 Plugins → plugins/ (OpenCode loads *.js from here). Language-agnostic,
# kept out of the prune manifest.
echo -e "${CYAN}[plugins]${NC}"
plugins_src_dir="${CONTENT_ROOT}/targets/opencode/plugins"
if [[ -d "$plugins_src_dir" ]]; then
    for f in "$plugins_src_dir"/*; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        copy_file "$f" "${OPENCODE_DIR}/plugins/${name}" \
            "content/targets/opencode/plugins/${name}" "plugins/${name}"
        installed_unmanifested_add "plugins/${name}"
    done
fi
echo ""

# 4. Commands → commands/. OpenCode command files take the same `description`
# frontmatter and $ARGUMENTS as the shared commands, so they copy as-is.
echo -e "${CYAN}[commands]${NC}"
for lang in "${LANGUAGES[@]}"; do
    cmd_dir="${CONTENT_ROOT}/commands/${lang}"
    [[ -d "$cmd_dir" ]] || continue
    for f in "$cmd_dir"/*.md; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        copy_file "$f" "${OPENCODE_DIR}/commands/${name}" \
            "content/commands/${lang}/${name}" "commands/${name}"
        manifest_add_file "$lang" "commands/${name}" "$f" "${OPENCODE_DIR}/commands/${name}"
    done
done
echo ""

# 5. Agents → agents/ (converted: see scripts/lib/opencode-agents.sh).
echo -e "${CYAN}[agents]${NC}"
log_info "agent model: and tools: lines removed; subagents use the model from your OpenCode configuration"
for lang in "${LANGUAGES[@]}"; do
    agents_dir="${CONTENT_ROOT}/agents/${lang}"
    [[ -d "$agents_dir" ]] || continue
    for f in "$agents_dir"/*.md; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        dest="${OPENCODE_DIR}/agents/${name}"
        if ! $DRY_RUN && [[ -f "$dest" ]] && ! $FORCE; then
            log_skip "agents/${name}"
            skipped=$((skipped + 1))
        elif opencode_convert_agent "$f" "$dest" "${name%.md}"; then
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
        same=0
        opencode_agent_matches "$f" "$dest" || same=1
        manifest_add_checked "$lang" "agents/${name}" "$same" "$dest"
    done
done
if [[ -n "$OPENCODE_NAME_MISMATCHES" ]]; then
    log_warn "agent id comes from the filename, not name: ${OPENCODE_NAME_MISMATCHES}"
fi
echo ""

# Orphan pruning + manifest write (same flow as the pi target).
LANGS_NL=$(printf '%s\n' "${LANGUAGES[@]}")
run_prune "$OPENCODE_DIR" "$LANGS_NL" "$PRUNE"
manifest_write "$OPENCODE_DIR" "$LANGS_NL"

echo ""
echo "────────────────────────────────"
if $DRY_RUN; then
    echo -e "Would copy: ${GREEN}${copied}${NC} items"
else
    echo -e "Copied: ${GREEN}${copied}${NC}, Skipped: ${YELLOW}${skipped}${NC}"
    echo ""
    echo -e "${CYAN}Restart OpenCode, then verify with /<command> or the skill tool.${NC}"
fi
