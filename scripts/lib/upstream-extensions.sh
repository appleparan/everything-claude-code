#!/usr/bin/env bash
# Installer for pi extensions fetched from upstream repos, tracked in
# content/targets/pi/upstream-extensions.json. Sourced by targets/pi scripts
# after scripts/lib/common.sh (needs CONTENT_ROOT, FORCE, DRY_RUN, the log_*
# helpers and the copied/skipped counters).
#
# Unlike external-skills.sh (default-branch clone), each entry is pinned to a
# commit SHA and only the listed files are copied.

# jq filters on one line (see JQ_MERGE_HOOKS in install.sh for why).
JQ_UPSTREAM_EXTENSIONS='(.extensions // [])[] | [.name, .repo, .ref, .path] | @tsv'
# One file name per line for the entry named $n (no word splitting later).
JQ_UPSTREAM_FILES='(.extensions // [])[] | select(.name == $n) | (.files // [])[]'
JQ_UPSTREAM_EXTENSION_NAMES='(.extensions // [])[] | .name'

# Written into each installed upstream extension dir; holds the pinned ref.
UPSTREAM_MARKER=".ecc-upstream"

UPSTREAM_EXTENSIONS_JSON="${CONTENT_ROOT}/targets/pi/upstream-extensions.json"

# Names of the tracked upstream extensions, one per line (requires jq).
upstream_extension_names() {
    [[ -f "$UPSTREAM_EXTENSIONS_JSON" ]] || return 0
    jq -r "$JQ_UPSTREAM_EXTENSION_NAMES" "$UPSTREAM_EXTENSIONS_JSON"
}

# True (0) iff $1 is a safe single path segment (no separators, no dot dirs).
upstream_safe_name() {
    case "$1" in
        ''|.|..|*/*|*'\'*) return 1 ;;
    esac
    return 0
}

# True (0) iff $1 is a relative path without ".." segments.
upstream_safe_path() {
    case "/$1/" in
        //*|*/../*) return 1 ;;
    esac
    return 0
}

# True (0) iff $1 is a safe file name inside the extension dir: one path
# segment, no "..", no glob characters.
upstream_safe_file() {
    upstream_safe_name "$1" || return 1
    case "$1" in
        *..*|*[\*\?\[\]]*) return 1 ;;
    esac
    return 0
}

# True (0) iff $1 is a full lowercase commit SHA.
upstream_valid_ref() {
    [[ "$1" =~ ^[0-9a-f]{40}$ ]]
}

# Shallow-fetch commit <ref> of <repo> into <dir>. Fetching a SHA directly
# works on GitHub; a plain `git clone` cannot target an arbitrary commit.
upstream_fetch() {
    local repo="$1" ref="$2" dir="$3"
    git -C "$dir" init -q \
        && git -C "$dir" remote add -- origin "$repo" \
        && GIT_TERMINAL_PROMPT=0 git -C "$dir" fetch -q --depth 1 -- origin "$ref" \
        && git -C "$dir" checkout -q FETCH_HEAD
}

# Fetch and install the tracked upstream extensions.
# Usage: install_upstream_extensions <dest-extensions-dir> <dest-label>
# Honors ECC_SKIP_UPSTREAM=1 (no network). The per-entry fetch dir lives in
# the global ext_tmp (shared with external-skills.sh) so the caller's EXIT
# trap can remove one left behind by an interrupt.
install_upstream_extensions() {
    local dest_dir="$1" dest_label="$2"
    [[ -f "$UPSTREAM_EXTENSIONS_JSON" ]] || return 0

    if [[ "${ECC_SKIP_UPSTREAM:-}" == "1" ]]; then
        log_info "upstream extensions skipped (ECC_SKIP_UPSTREAM=1)"
        return 0
    fi
    if ! command -v jq &>/dev/null; then
        log_warn "jq not found; skipping upstream extensions"
        jq_install_hint
        return 0
    fi
    if ! command -v git &>/dev/null; then
        log_warn "git not found; skipping upstream extensions"
        return 0
    fi

    local name repo ref ext_path files_nl dest f bad copy_ok
    while IFS=$'\t' read -r name repo ref ext_path; do
        [[ -n "$name" ]] || continue
        if ! upstream_safe_name "$name"; then
            log_warn "${dest_label}/${name}: invalid name; skipped"
            continue
        fi
        files_nl=$(jq -r --arg n "$name" "$JQ_UPSTREAM_FILES" "$UPSTREAM_EXTENSIONS_JSON")
        if [[ -z "$repo" || -z "$ref" || -z "$ext_path" || -z "$files_nl" ]]; then
            log_warn "${dest_label}/${name}: missing repo, ref, path or files; skipped"
            continue
        fi
        if ! upstream_valid_ref "$ref"; then
            log_warn "${dest_label}/${name}: invalid ref '${ref}' (need a 40-char lowercase commit SHA); skipped"
            continue
        fi
        case "$repo" in
            -*)
                log_warn "${dest_label}/${name}: invalid repo '${repo}'; skipped"
                continue ;;
        esac
        if ! upstream_safe_path "$ext_path"; then
            log_warn "${dest_label}/${name}: invalid path '${ext_path}'; skipped"
            continue
        fi
        bad=false
        while IFS= read -r f; do
            upstream_safe_file "$f" || bad=true
        done <<< "$files_nl"
        if $bad; then
            log_warn "${dest_label}/${name}: invalid file name in file list; skipped"
            continue
        fi

        dest="${dest_dir}/${name}"
        # Not in the prune manifest; keep the git-history fallback off it.
        if declare -F installed_unmanifested_add >/dev/null; then
            installed_unmanifested_add "${dest_label}/${name}"
        fi
        # Never write through a symlinked dest dir or dest file (even with -f).
        bad=false
        [[ -L "$dest" ]] && bad=true
        while IFS= read -r f; do
            [[ -L "${dest}/${f}" ]] && bad=true
        done <<< "$files_nl"
        if $bad; then
            log_symlink "${dest_label}/${name}/"
            skipped=$((skipped + 1))
            continue
        fi
        if $DRY_RUN; then
            log_dry "${repo}@${ref:0:7} (${ext_path})" "${dest_label}/${name}/"
            copied=$((copied + 1))
            continue
        fi
        if [[ -d "$dest" ]] && ! $FORCE; then
            log_skip "${dest_label}/${name}/"
            skipped=$((skipped + 1))
            continue
        fi

        ext_tmp=$(mktemp -d "${TMPDIR:-/tmp}/ecc-ext-upstream.XXXXXX")
        if ! upstream_fetch "$repo" "$ref" "$ext_tmp" >/dev/null 2>&1; then
            log_warn "${dest_label}/${name}: fetch failed (${repo}@${ref:0:7}); skipped"
            rm -rf "${ext_tmp:?}"; ext_tmp=""
            continue
        fi
        bad=false
        while IFS= read -r f; do
            if [[ -L "${ext_tmp}/${ext_path}/${f}" ]]; then
                log_warn "${dest_label}/${name}: ${ext_path}/${f} is a symlink in the fetched tree; skipped"
                bad=true
            elif [[ ! -f "${ext_tmp}/${ext_path}/${f}" ]]; then
                log_warn "${dest_label}/${name}: ${ext_path}/${f} not found at ${ref:0:7}; skipped"
                bad=true
            fi
        done <<< "$files_nl"
        if $bad; then
            rm -rf "${ext_tmp:?}"; ext_tmp=""
            continue
        fi
        # Guarded so one broken entry cannot abort the rest of the install
        # under set -e. The .ecc-upstream marker (the ref) tells uninstall
        # that this dir was written by us, not by the user.
        copy_ok=true
        mkdir -p "$dest" || copy_ok=false
        while IFS= read -r f; do
            cp "${ext_tmp}/${ext_path}/${f}" "${dest}/${f}" || copy_ok=false
        done <<< "$files_nl"
        printf '%s\n' "$ref" > "${dest}/${UPSTREAM_MARKER}" || copy_ok=false
        if ! $copy_ok; then
            log_warn "${dest_label}/${name}: copy failed; skipped"
            rm -rf "${ext_tmp:?}"; ext_tmp=""
            continue
        fi
        log_copy "${repo}@${ref:0:7} (${ext_path})" "${dest_label}/${name}/"
        copied=$((copied + 1))
        rm -rf "${ext_tmp:?}"; ext_tmp=""
    done < <(jq -r "$JQ_UPSTREAM_EXTENSIONS" "$UPSTREAM_EXTENSIONS_JSON")
}
