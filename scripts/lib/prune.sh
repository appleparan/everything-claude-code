#!/usr/bin/env bash
set -euo pipefail
# Manifest read/write and orphan-pruning helpers, shared by
# targets/claude/install.sh and targets/codex/install.sh.
#
# Callers must source scripts/lib/common.sh first (REPO_ROOT, FORCE,
# DRY_RUN, log_* helpers, remove_file/remove_dir), then set PRUNE_TARGET to
# "claude" or "codex" before calling run_prune/manifest_write.
#
# bash 3.2 compatible: no associative arrays, no mapfile/readarray. Lang
# membership checks use newline-joined strings + `grep -Fxq` instead.

MANIFEST_HEADER="# everything-claude-code manifest v1"

# This run's manifest entries, "<lang><TAB><relpath>", one per array element.
# Populated via manifest_add regardless of DRY_RUN, so `-n -p` can preview
# orphans without writing anything to disk.
MANIFEST_ENTRIES=()

# Records one destination this run manages (COPY or SKIP outcome alike).
# $1=lang $2=relpath (relative to the target's base dir, e.g. "agents/foo.md"
# or "skills/some-skill" for a skill directory).
manifest_add() {
    MANIFEST_ENTRIES+=("${1}"$'\t'"${2}")
}

manifest_file_path() {
    echo "${1}/.ecc-manifest"
}

# True (0) if $1 appears as a whole line in newline-joined list $2.
lang_in_list() {
    local lang="$1" list_nl="$2"
    printf '%s\n' "$list_nl" | grep -Fxq "$lang"
}

# Prints just the relpath column of this run's manifest entries, one per
# line. Used to compute "this run's full dest set" (regardless of lang) for
# orphan detection and fallback filtering.
manifest_full_dest_set() {
    if [[ ${#MANIFEST_ENTRIES[@]} -gt 0 ]]; then
        printf '%s\n' "${MANIFEST_ENTRIES[@]}" | cut -f2
    fi
}

# Writes the manifest for $1=base_dir given $2=this run's languages
# (newline-joined). New content = this run's entries + carryover from the old
# manifest. An old entry is carried over when its lang is NOT among this
# run's languages, or when its dest is not in this run's dest set but still
# exists on disk: an orphan detected without -p must stay recorded so a later
# -p run can still prune it. A pruned (or manually deleted) dest no longer
# exists, so it drops out of the manifest automatically.
# No-op on DRY_RUN: the manifest is never written for a dry run.
manifest_write() {
    local base_dir="$1" langs_nl="$2"
    $DRY_RUN && return 0

    local path
    path=$(manifest_file_path "$base_dir")

    local old_entries=""
    if [[ -f "$path" ]]; then
        old_entries=$(grep -v '^#' "$path" || true)
    fi

    local full_dest_nl
    full_dest_nl=$(manifest_full_dest_set)

    local carried=""
    if [[ -n "$old_entries" ]]; then
        local lang relpath keep
        while IFS=$'\t' read -r lang relpath; do
            [[ -z "$lang" ]] && continue
            keep=1
            if ! lang_in_list "$lang" "$langs_nl"; then
                keep=0
            elif [[ -e "${base_dir}/${relpath}" ]]; then
                if [[ -z "$full_dest_nl" ]] || ! printf '%s\n' "$full_dest_nl" | grep -Fxq "$relpath"; then
                    keep=0
                fi
            fi
            if [[ $keep -eq 0 ]]; then
                carried="${carried}${lang}"$'\t'"${relpath}"$'\n'
            fi
        done <<< "$old_entries"
    fi

    local body
    body=$(
        {
            if [[ ${#MANIFEST_ENTRIES[@]} -gt 0 ]]; then
                printf '%s\n' "${MANIFEST_ENTRIES[@]}"
            fi
            printf '%s' "$carried"
        } | grep -v '^$' | sort -u || true
    )

    {
        echo "$MANIFEST_HEADER"
        [[ -n "$body" ]] && printf '%s\n' "$body"
    } > "$path"
}

# Prints orphan entries ("<lang><TAB><path>") from the old manifest at
# $1=manifest_path: entries whose lang is in $2=this run's languages
# (newline-joined) and whose dest path is not in this run's full dest set
# (checked regardless of lang, so a dest that moved between languages is
# never treated as orphaned).
compute_orphans() {
    local manifest_path="$1" langs_nl="$2"
    [[ -f "$manifest_path" ]] || return 0

    local full_dest_nl
    full_dest_nl=$(manifest_full_dest_set)

    local old_entries
    old_entries=$(grep -v '^#' "$manifest_path" || true)
    [[ -z "$old_entries" ]] && return 0

    local lang relpath
    while IFS=$'\t' read -r lang relpath; do
        [[ -z "$lang" ]] && continue
        lang_in_list "$lang" "$langs_nl" || continue
        if [[ -n "$full_dest_nl" ]] && printf '%s\n' "$full_dest_nl" | grep -Fxq "$relpath"; then
            continue
        fi
        printf '%s\t%s\n' "$lang" "$relpath"
    done <<< "$old_entries"
}

# Counts non-empty lines in $1 without relying on `((var++))` or mapfile.
count_lines() {
    local text="$1" n=0 line
    [[ -z "$text" ]] && { echo 0; return 0; }
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        n=$((n + 1))
    done <<< "$text"
    echo "$n"
}

# Deletes one manifest-recorded dest: a directory via remove_dir, otherwise
# via remove_file (both already honor DRY_RUN).
prune_delete_entry() {
    local base_dir="$1" relpath="$2"
    local target="${base_dir}/${relpath}"
    if [[ -d "$target" ]]; then
        remove_dir "$target" "$relpath"
    else
        remove_file "$target" "$relpath"
    fi
}

# Orchestrates orphan detection/removal for one target run. Must run after
# every manifest_add call for this run and before manifest_write.
# $1=base_dir $2=this run's languages (newline-joined) $3=prune flag (true/false)
run_prune() {
    local base_dir="$1" langs_nl="$2" prune="$3"
    local manifest_path
    manifest_path=$(manifest_file_path "$base_dir")

    if [[ -f "$manifest_path" ]]; then
        local orphans
        orphans=$(compute_orphans "$manifest_path" "$langs_nl")
        [[ -z "$orphans" ]] && return 0

        if $prune; then
            echo ""
            echo -e "${CYAN}[prune]${NC}"
            local lang relpath
            while IFS=$'\t' read -r lang relpath; do
                [[ -z "$lang" ]] && continue
                prune_delete_entry "$base_dir" "$relpath"
            done <<< "$orphans"
        else
            local count
            count=$(count_lines "$orphans")
            echo ""
            log_info "${count} orphaned file(s) from previous installs detected; re-run with -p to remove"
        fi
        return 0
    fi

    $prune && prune_git_history_fallback "$base_dir" "$langs_nl"
    return 0
}

# Maps one historical repo-relative source path to "<dest>\t<srcprefix>\t<isdir>"
# for $PRUNE_TARGET, or prints nothing if the path is unmanaged or its lang is
# not in $2=this run's languages (newline-joined). srcprefix is the historical
# path (file) or historical directory prefix (skill dir) used for content
# verification; isdir is "1" for a skill directory, "0" for a single file.
prune_map_source() {
    local srcpath="$1" langs_nl="$2"
    local lang cat filename skill dest srcprefix

    if [[ "$PRUNE_TARGET" == "claude" ]]; then
        if [[ "$srcpath" =~ ^content/(agents|commands|rules)/([^/]+)/([^/]+\.md)$ ]]; then
            cat="${BASH_REMATCH[1]}"; lang="${BASH_REMATCH[2]}"; filename="${BASH_REMATCH[3]}"
            lang_in_list "$lang" "$langs_nl" || return 0
            printf '%s\t%s\t0\n' "${cat}/${filename}" "$srcpath"
            return 0
        fi
        if [[ "$srcpath" =~ ^content/skills/([^/]+)/([^/]+)/ ]]; then
            lang="${BASH_REMATCH[1]}"; skill="${BASH_REMATCH[2]}"
            lang_in_list "$lang" "$langs_nl" || return 0
            printf '%s\t%s\t1\n' "skills/${skill}" "content/skills/${lang}/${skill}"
            return 0
        fi
        if [[ "$srcpath" =~ ^content/hooks/([^/]+)/project-hooks\.json$ ]]; then
            lang="${BASH_REMATCH[1]}"
            lang_in_list "$lang" "$langs_nl" || return 0
            printf '%s\t%s\t0\n' "project-hooks/${lang}.json" "$srcpath"
            return 0
        fi
        if [[ "$srcpath" =~ ^scripts/([^/]+)/(hooks|lib)/([^/]+)$ ]]; then
            lang="${BASH_REMATCH[1]}"; local sub="${BASH_REMATCH[2]}"; filename="${BASH_REMATCH[3]}"
            lang_in_list "$lang" "$langs_nl" || return 0
            printf '%s\t%s\t0\n' "scripts/${lang}/${sub}/${filename}" "$srcpath"
            return 0
        fi
        # Pre-restructure layout (top-level agents/commands/rules/skills/hooks,
        # before the content/ move).
        if [[ "$srcpath" =~ ^(agents|commands|rules)/([^/]+)/([^/]+\.md)$ ]]; then
            cat="${BASH_REMATCH[1]}"; lang="${BASH_REMATCH[2]}"; filename="${BASH_REMATCH[3]}"
            lang_in_list "$lang" "$langs_nl" || return 0
            printf '%s\t%s\t0\n' "${cat}/${filename}" "$srcpath"
            return 0
        fi
        if [[ "$srcpath" =~ ^skills/([^/]+)/([^/]+)/ ]]; then
            lang="${BASH_REMATCH[1]}"; skill="${BASH_REMATCH[2]}"
            lang_in_list "$lang" "$langs_nl" || return 0
            printf '%s\t%s\t1\n' "skills/${skill}" "skills/${lang}/${skill}"
            return 0
        fi
        if [[ "$srcpath" =~ ^hooks/([^/]+)/project-hooks\.json$ ]]; then
            lang="${BASH_REMATCH[1]}"
            lang_in_list "$lang" "$langs_nl" || return 0
            printf '%s\t%s\t0\n' "project-hooks/${lang}.json" "$srcpath"
            return 0
        fi
        return 0
    fi

    if [[ "$PRUNE_TARGET" == "codex" ]]; then
        if [[ "$srcpath" =~ ^content/rules/([^/]+)/([^/]+\.md)$ ]]; then
            lang="${BASH_REMATCH[1]}"; filename="${BASH_REMATCH[2]}"
            lang_in_list "$lang" "$langs_nl" || return 0
            printf '%s\t%s\t0\n' "instructions/${filename}" "$srcpath"
            return 0
        fi
        if [[ "$srcpath" =~ ^content/skills/([^/]+)/([^/]+)/ ]]; then
            lang="${BASH_REMATCH[1]}"; skill="${BASH_REMATCH[2]}"
            lang_in_list "$lang" "$langs_nl" || return 0
            printf '%s\t%s\t1\n' "skills/${skill}" "content/skills/${lang}/${skill}"
            return 0
        fi
        if [[ "$srcpath" =~ ^rules/([^/]+)/([^/]+\.md)$ ]]; then
            lang="${BASH_REMATCH[1]}"; filename="${BASH_REMATCH[2]}"
            lang_in_list "$lang" "$langs_nl" || return 0
            printf '%s\t%s\t0\n' "instructions/${filename}" "$srcpath"
            return 0
        fi
        if [[ "$srcpath" =~ ^skills/([^/]+)/([^/]+)/ ]]; then
            lang="${BASH_REMATCH[1]}"; skill="${BASH_REMATCH[2]}"
            lang_in_list "$lang" "$langs_nl" || return 0
            printf '%s\t%s\t1\n' "skills/${skill}" "skills/${lang}/${skill}"
            return 0
        fi
        return 0
    fi
}

# True (0) iff local file $1 is byte-identical (per `git hash-object`) to
# SOME historical version of repo-relative path $2 (`git rev-parse
# <commit>:<path>` over every commit that ever touched it).
prune_verify_file() {
    local local_path="$1" srcpath="$2"
    [[ -f "$local_path" ]] || return 1
    local local_hash
    local_hash=$(git hash-object "$local_path" 2>/dev/null) || return 1

    local commit blob_hash
    while IFS= read -r commit; do
        [[ -z "$commit" ]] && continue
        blob_hash=$(git -C "$REPO_ROOT" rev-parse "${commit}:${srcpath}" 2>/dev/null || true)
        if [[ -n "$blob_hash" && "$blob_hash" == "$local_hash" ]]; then
            return 0
        fi
    done < <(git -C "$REPO_ROOT" log --all --format=%H -- "$srcpath" 2>/dev/null || true)
    return 1
}

# True (0) iff every file under local directory $1 verifies against the
# corresponding historical path under repo-relative prefix $2.
prune_verify_dir() {
    local local_dir="$1" srcprefix="$2"
    [[ -d "$local_dir" ]] || return 1
    local f rel
    while IFS= read -r f; do
        rel="${f#"$local_dir"/}"
        prune_verify_file "$f" "${srcprefix}/${rel}" || return 1
    done < <(find "$local_dir" -type f | sort)
    return 0
}

# Git-history fallback used when no manifest exists yet and -p was given:
# finds historically-deleted, install-managed paths whose dest still exists
# locally, verifies their content against git history, lists both groups,
# and (outside dry-run) deletes verified candidates after a y/N confirmation.
prune_git_history_fallback() {
    local base_dir="$1" langs_nl="$2"

    if ! command -v git &>/dev/null || ! git -C "$REPO_ROOT" rev-parse --is-inside-work-tree &>/dev/null; then
        echo ""
        log_warn "No manifest found and REPO_ROOT is not a git work tree (or git is unavailable); skipping -p fallback"
        return 0
    fi

    echo ""
    echo -e "${CYAN}[prune: git history fallback]${NC}"

    local deleted_paths
    deleted_paths=$(git -C "$REPO_ROOT" log --all --diff-filter=D --name-only --pretty=format: 2>/dev/null \
        | grep -v '^$' | sort -u || true)
    if [[ -z "$deleted_paths" ]]; then
        log_info "No historical deletions found."
        return 0
    fi

    local mapped=""
    local srcpath
    while IFS= read -r srcpath; do
        [[ -z "$srcpath" ]] && continue
        mapped="${mapped}$(prune_map_source "$srcpath" "$langs_nl")"$'\n'
    done <<< "$deleted_paths"
    mapped=$(printf '%s' "$mapped" | grep -v '^$' || true)
    if [[ -z "$mapped" ]]; then
        log_info "No historical deletions match install-managed paths for the selected languages."
        return 0
    fi

    # Dedupe by dest (col 1): a skill dir spans many file-deletion events, and
    # a path may have been deleted more than once across history.
    local dedup="" seen_dest="" dest srcprefix isdir
    while IFS=$'\t' read -r dest srcprefix isdir; do
        [[ -z "$dest" ]] && continue
        if [[ -n "$seen_dest" ]] && printf '%s\n' "$seen_dest" | grep -Fxq "$dest"; then
            continue
        fi
        seen_dest="${seen_dest}${dest}"$'\n'
        dedup="${dedup}${dest}"$'\t'"${srcprefix}"$'\t'"${isdir}"$'\n'
    done <<< "$mapped"

    # Drop candidates this run installs (regardless of lang), and candidates
    # that don't exist locally.
    local full_dest_nl candidates=""
    full_dest_nl=$(manifest_full_dest_set)
    while IFS=$'\t' read -r dest srcprefix isdir; do
        [[ -z "$dest" ]] && continue
        if [[ -n "$full_dest_nl" ]] && printf '%s\n' "$full_dest_nl" | grep -Fxq "$dest"; then
            continue
        fi
        [[ -e "${base_dir}/${dest}" ]] || continue
        candidates="${candidates}${dest}"$'\t'"${srcprefix}"$'\t'"${isdir}"$'\n'
    done <<< "$dedup"

    if [[ -z "$candidates" ]]; then
        log_info "No orphan candidates found via git history (all either still shipped or absent locally)."
        return 0
    fi

    local verified="" unverified=""
    while IFS=$'\t' read -r dest srcprefix isdir; do
        [[ -z "$dest" ]] && continue
        local ok=1
        if [[ "$isdir" == "1" ]]; then
            prune_verify_dir "${base_dir}/${dest}" "$srcprefix" && ok=0
        else
            prune_verify_file "${base_dir}/${dest}" "$srcprefix" && ok=0
        fi
        if [[ $ok -eq 0 ]]; then
            verified="${verified}${dest}"$'\t'"${isdir}"$'\n'
        else
            unverified="${unverified}${dest}"$'\n'
        fi
    done <<< "$candidates"

    if [[ -n "$verified" ]]; then
        echo "  Verified candidates (byte-identical to a historical version):"
        while IFS=$'\t' read -r dest isdir; do
            [[ -z "$dest" ]] && continue
            echo "    ${dest}"
        done <<< "$verified"
    fi
    if [[ -n "$unverified" ]]; then
        log_info "Not verified (locally modified or unknown origin); left untouched:"
        while IFS= read -r dest; do
            [[ -z "$dest" ]] && continue
            echo "    ${dest}"
        done <<< "$unverified"
    fi

    [[ -z "$verified" ]] && return 0

    local vcount
    vcount=$(count_lines "$verified")

    if $DRY_RUN; then
        local dest isdir
        while IFS=$'\t' read -r dest isdir; do
            [[ -z "$dest" ]] && continue
            prune_delete_entry "$base_dir" "$dest"
        done <<< "$verified"
        return 0
    fi

    local reply
    printf '  Delete these %s item(s)? [y/N] ' "$vcount"
    if ! IFS= read -r reply; then
        reply=""
    fi
    case "$reply" in
        y|Y)
            local dest isdir
            while IFS=$'\t' read -r dest isdir; do
                [[ -z "$dest" ]] && continue
                prune_delete_entry "$base_dir" "$dest"
            done <<< "$verified"
            ;;
        *)
            log_info "Prune cancelled; nothing deleted."
            ;;
    esac
}
