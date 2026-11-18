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
# shellcheck source=../../scripts/lib/pi-agents.sh
source "${REPO_ROOT}/scripts/lib/pi-agents.sh"
PRUNE_TARGET="omp"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS] <language>...

Install shared configuration into omp (oh-my-pi), at \$ECC_OMP_DIR or
~/.omp/agent:
  AGENTS.md          Global instructions + rules index (generated)
  rules/             Rules files, read on demand via the index
  skills/            Skill folders (invoked via /skill:name), plus external
                     skills tracked in content/external-skills.json
  commands/          Slash commands, from the shared commands
  agents/            Subagent definitions: shared agents converted to omp's
                     tool names. Shared agents named like an omp bundled
                     agent (scout, reviewer, security-reviewer, seance, task,
                     sonic) are skipped.
  extensions/        ecc-safety and simple-english

Options:
  -f    Force overwrite existing files
  -n    Dry run
  -p    Prune orphaned files from previous installs (see .ecc-manifest);
        with no manifest yet, falls back to a git-history check
  -m    Accepted and ignored (MCP is not ported to omp); lets
        'install.sh -m --target all' pass the flag to every target
  -l    List available languages and exit
  -h    Show this help

ECC_OMP_DIR is this installer's variable. omp itself reads
PI_CODING_AGENT_DIR, so with that variable set, point ECC_OMP_DIR at the
directory omp really uses.
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
    echo -e "${RED}Error: omp not detected (set ECC_OMP_DIR, create ~/.omp, or install omp)${NC}"
    exit 1
fi

if [[ -n "${ECC_OMP_DIR:-}" || -n "${PI_CONFIG_DIR:-}" ]]; then
    DEST_LABEL="$OMP_DIR"
else
    DEST_LABEL="~/.omp/agent"
fi

if $DRY_RUN; then
    echo -e "${CYAN}Dry run: showing what would be installed${NC}"
fi
if [[ -n "${PI_CODING_AGENT_DIR:-}" && -z "${ECC_OMP_DIR:-}" ]]; then
    log_warn "PI_CODING_AGENT_DIR is set: omp reads ${PI_CODING_AGENT_DIR}, not ${OMP_DIR}, which this target writes. Set ECC_OMP_DIR to the directory omp uses."
fi
echo -e "Installing: ${GREEN}${LANGUAGES[*]}${NC} → ${DEST_LABEL}/"
echo ""

$DRY_RUN || mkdir -p "$OMP_DIR/rules" "$OMP_DIR/skills" "$OMP_DIR/commands" \
    "$OMP_DIR/agents" "$OMP_DIR/extensions"

# Temp files covered by one EXIT trap: the generated AGENTS.md, the staged
# simple-english extension, and the clone dir of the external-skills installer.
agents_tmp=$(mktemp)
stage_tmp=""
ext_tmp=""
trap 'rm -f "$agents_tmp"; if [[ -n "$stage_tmp" ]]; then rm -rf "${stage_tmp:?}"; fi; if [[ -n "$ext_tmp" ]]; then rm -rf "${ext_tmp:?}"; fi' EXIT

# 1. Rules → rules/. omp injects a rule file only when it has a description or
# alwaysApply frontmatter, so these plain files are reached through the index
# in AGENTS.md.
echo -e "${CYAN}[rules]${NC}"
for lang in "${LANGUAGES[@]}"; do
    rules_dir="${CONTENT_ROOT}/rules/${lang}"
    [[ -d "$rules_dir" ]] || continue
    for f in "$rules_dir"/*.md; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        copy_file "$f" "${OMP_DIR}/rules/${name}" \
            "content/rules/${lang}/${name}" "rules/${name}"
        manifest_add_file "$lang" "rules/${name}" "$f" "${OMP_DIR}/rules/${name}"
    done
done
echo ""

# 2. AGENTS.md (generated: global instructions + omp addendum + rules index)
echo -e "${CYAN}[global]${NC}"
"${REPO_ROOT}/scripts/lib/build-agents-md.sh" "${DEST_LABEL}/rules" omp "${LANGUAGES[@]}" > "$agents_tmp"
copy_file "$agents_tmp" "${OMP_DIR}/AGENTS.md" \
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
        copy_dir "$skill_dir" "${OMP_DIR}/skills/${skill_name}" \
            "content/skills/${lang}/${skill_name}/" "skills/${skill_name}/"
        manifest_add_dir "$lang" "skills/${skill_name}" "$skill_dir" "${OMP_DIR}/skills/${skill_name}"
    done
done
echo ""

# 3.5 External skills (language-agnostic, kept out of the prune manifest).
install_external_skills "${OMP_DIR}/skills" "skills" omp

# 4. Commands → commands/. omp slash commands take the same `description`
# frontmatter and $ARGUMENTS as the shared commands, so they copy as-is.
echo -e "${CYAN}[commands]${NC}"
for lang in "${LANGUAGES[@]}"; do
    cmd_dir="${CONTENT_ROOT}/commands/${lang}"
    [[ -d "$cmd_dir" ]] || continue
    for f in "$cmd_dir"/*.md; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        copy_file "$f" "${OMP_DIR}/commands/${name}" \
            "content/commands/${lang}/${name}" "commands/${name}"
        manifest_add_file "$lang" "commands/${name}" "$f" "${OMP_DIR}/commands/${name}"
    done
done
echo ""

# 5. Agents → agents/. Shared agents get their tools: line converted and their
# model: line removed. A shared agent named like an omp bundled agent is
# skipped: writing it would override the bundled one. No worker/scout: omp
# bundles task and scout.
echo -e "${CYAN}[agents]${NC}"
log_info "agent model: lines removed; subagents use the models configured in omp"
for lang in "${LANGUAGES[@]}"; do
    agents_dir="${CONTENT_ROOT}/agents/${lang}"
    [[ -d "$agents_dir" ]] || continue
    for f in "$agents_dir"/*.md; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        if omp_is_bundled_agent "${name%.md}"; then
            log_info "agents/${name}: omp bundles an agent named ${name%.md}; skipped"
            continue
        fi
        dest="${OMP_DIR}/agents/${name}"
        if ! $DRY_RUN && [[ -f "$dest" ]] && ! $FORCE; then
            log_skip "agents/${name}"
            skipped=$((skipped + 1))
        elif omp_convert_agent "$f" "$dest" "${name%.md}"; then
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
        omp_agent_matches "$f" "$dest" || same=1
        manifest_add_checked "$lang" "agents/${name}" "$same" "$dest"
    done
done
echo ""

# 6. Extensions → extensions/<name>/, language-agnostic and kept out of the
# prune manifest. ecc-safety has one source, the pi extension (the omp API is
# compatible). simple-english is the omp-native extension plus the pi
# prompt.cjs, staged in a temp dir so copy_dir can copy it as one directory.
echo -e "${CYAN}[extensions]${NC}"
safety_src="${CONTENT_ROOT}/targets/pi/extensions/ecc-safety"
if [[ -d "$safety_src" ]]; then
    copy_dir "$safety_src" "${OMP_DIR}/extensions/ecc-safety" \
        "content/targets/pi/extensions/ecc-safety/" "extensions/ecc-safety/"
    installed_unmanifested_add "extensions/ecc-safety"
fi
se_src="${CONTENT_ROOT}/targets/omp/extensions/simple-english"
se_prompt="${CONTENT_ROOT}/targets/pi/extensions/simple-english/prompt.cjs"
if [[ -d "$se_src" && -f "$se_prompt" ]]; then
    stage_tmp=$(mktemp -d)
    cp -R "${se_src}/." "${stage_tmp}/"
    cp "$se_prompt" "${stage_tmp}/prompt.cjs"
    copy_dir "$stage_tmp" "${OMP_DIR}/extensions/simple-english" \
        "content/targets/omp/extensions/simple-english/ (+ pi prompt.cjs)" "extensions/simple-english/"
    installed_unmanifested_add "extensions/simple-english"
fi
echo ""

# Orphan pruning + manifest write (same flow as the pi target).
LANGS_NL=$(printf '%s\n' "${LANGUAGES[@]}")
run_prune "$OMP_DIR" "$LANGS_NL" "$PRUNE"
manifest_write "$OMP_DIR" "$LANGS_NL"

echo ""
echo "────────────────────────────────"
if $DRY_RUN; then
    echo -e "Would copy: ${GREEN}${copied}${NC} items"
else
    echo -e "Copied: ${GREEN}${copied}${NC}, Skipped: ${YELLOW}${skipped}${NC}"
    echo ""
    echo -e "${CYAN}Restart omp, then verify with /skill:name.${NC}"
fi
