#!/usr/bin/env bash
# Shared installer for external skills tracked in content/external-skills.json.
# Sourced by target install scripts after scripts/lib/common.sh (needs
# CONTENT_ROOT, FORCE, DRY_RUN, the log_* helpers and the copied/skipped
# counters).
#
# An entry applies to a target when it has no "targets" array or when the
# array contains that target's name.

# jq filters on one line (see JQ_MERGE_HOOKS in install.sh for why).
# shellcheck disable=SC2016
JQ_EXTERNAL_SKILLS='(.skills // [])[] | select((.targets | type) != "array" or any(.targets[]; . == $t)) | [.name, .repo, .path // ""] | @tsv'
JQ_EXTERNAL_SKILL_NAMES='(.skills // [])[] | select((.targets | type) != "array" or any(.targets[]; . == $t)) | .name'

# Names of the external skills that apply to <target>, one per line.
# Usage: external_skill_names <target>   (requires jq)
external_skill_names() {
    local src="${CONTENT_ROOT}/external-skills.json"
    [[ -f "$src" ]] || return 0
    jq -r --arg t "$1" "$JQ_EXTERNAL_SKILL_NAMES" "$src"
}

# Clone and install the external skills that apply to <target>.
# Usage: install_external_skills <dest-skills-dir> <dest-label> <target>
# Per-entry clone dirs live in the global ext_tmp so a caller's EXIT trap can
# remove a clone left behind by an interrupt.
ext_tmp=""
install_external_skills() {
    local dest_dir="$1" dest_label="$2" target="$3"
    local src="${CONTENT_ROOT}/external-skills.json"
    [[ -f "$src" ]] || return 0

    echo -e "${CYAN}[external skills]${NC}"
    if ! command -v jq &>/dev/null; then
        log_warn "jq not found; skipping external skills"
        jq_install_hint
        return 0
    fi
    if ! command -v git &>/dev/null; then
        log_warn "git not found; skipping external skills"
        return 0
    fi

    local name repo skill_path dest
    while IFS=$'\t' read -r name repo skill_path; do
        [[ -n "$name" ]] || continue

        # The JSON is repo-tracked, but a typo'd name/path must never write or
        # delete outside <dest-dir>/<name>/ (target uninstall scripts have the
        # twin name guard).
        case "$name" in
            # shellcheck disable=SC1003
            .|..|*/*|*'\'*)
                log_warn "${dest_label}: invalid name '${name}'; skipped"
                continue ;;
        esac
        if [[ -z "$repo" || -z "$skill_path" ]]; then
            log_warn "${dest_label}/${name}: missing repo or path; skipped"
            continue
        fi
        case "/${skill_path}/" in
            //*|*/../*)
                log_warn "${dest_label}/${name}: invalid path '${skill_path}'; skipped"
                continue ;;
        esac

        dest="${dest_dir}/${name}"

        if $DRY_RUN; then
            log_dry "${repo} (${skill_path})" "${dest_label}/${name}/"
            copied=$((copied + 1))
            continue
        fi
        if [[ -d "$dest" ]] && ! $FORCE; then
            log_skip "${dest_label}/${name}/"
            skipped=$((skipped + 1))
            continue
        fi

        ext_tmp=$(mktemp -d "${TMPDIR:-/tmp}/ecc-ext-skill.XXXXXX")
        if ! GIT_TERMINAL_PROMPT=0 git clone --quiet --depth 1 "$repo" "${ext_tmp}/repo"; then
            log_warn "${dest_label}/${name}: clone failed (${repo}); skipped"
            rm -rf "${ext_tmp:?}"; ext_tmp=""
            continue
        fi
        if [[ ! -f "${ext_tmp}/repo/${skill_path}/SKILL.md" ]]; then
            log_warn "${dest_label}/${name}: no SKILL.md at '${skill_path}' in ${repo}; skipped"
            rm -rf "${ext_tmp:?}"; ext_tmp=""
            continue
        fi
        rm -rf "${ext_tmp:?}/repo/.git"
        # Overlay copy (same semantics as copy_dir): files removed upstream
        # survive a -f refresh. Guarded so one broken entry cannot abort the
        # rest of the install under set -e.
        if ! { mkdir -p "$dest" && cp -r "${ext_tmp}/repo/${skill_path}"/. "$dest"/; }; then
            log_warn "${dest_label}/${name}: copy failed; skipped"
            rm -rf "${ext_tmp:?}"; ext_tmp=""
            continue
        fi
        log_copy "${repo} (${skill_path})" "${dest_label}/${name}/"
        copied=$((copied + 1))
        rm -rf "${ext_tmp:?}"; ext_tmp=""
    done < <(jq -r --arg t "$target" "$JQ_EXTERNAL_SKILLS" "$src")
    echo ""
}
