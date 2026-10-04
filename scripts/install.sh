#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "${REPO_ROOT}/scripts/lib/common.sh"

TARGET="all"
TARGET_EXPLICIT=false
PASS_ARGS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --target)   TARGET="${2:?--target requires a value}"; TARGET_EXPLICIT=true; shift 2 ;;
        --target=*) TARGET="${1#--target=}"; TARGET_EXPLICIT=true; shift ;;
        *)          PASS_ARGS+=("$1"); shift ;;
    esac
done

TARGETS=()
while IFS= read -r t; do
    [[ -n "$t" ]] && TARGETS+=("$t")
done < <(discover_targets)

join_by() {
    local sep="$1" out="" item
    shift
    for item in "$@"; do
        out="${out:+${out}${sep}}${item}"
    done
    echo "$out"
}

usage_dispatcher() {
    echo "Usage: $(basename "$0") [--target $(join_by '|' "${TARGETS[@]}" all)] [OPTIONS] <language>..."
    echo ""
    echo "Targets:"
    local t
    for t in "${TARGETS[@]}"; do
        printf '  %-8s %s\n' "$t" "$(target_summary "$t")"
    done
    echo "  all      Every target (default; targets other than claude skipped when not detected)"
    echo ""
    echo "Common option worth knowing about here: -p prunes orphaned files left behind"
    echo "by previous installs (tracked via .ecc-manifest, with a git-history fallback"
    echo "on the first run). See below for the full set of target-specific options."
    echo ""
    echo "Target-specific options follow below."
}

# When no explicit --target was given and -h is requested, surface the
# dispatcher's own usage (which documents --target) before falling through
# to the claude target's usage, instead of silently defaulting to "all" and
# potentially printing several concatenated usage blocks.
if ! $TARGET_EXPLICIT; then
    for arg in "${PASS_ARGS[@]:-}"; do
        if [[ "$arg" == "-h" ]]; then
            usage_dispatcher
            echo ""
            exec "${REPO_ROOT}/targets/claude/install.sh" "${PASS_ARGS[@]:-}"
        fi
    done
fi

if [[ "$TARGET" == "all" ]]; then
    "${REPO_ROOT}/targets/claude/install.sh" "${PASS_ARGS[@]:-}"
    for t in "${TARGETS[@]}"; do
        [[ "$t" == "claude" ]] && continue
        if target_detected "$t"; then
            "${REPO_ROOT}/targets/${t}/install.sh" "${PASS_ARGS[@]:-}"
        else
            label="$(target_label "$t")"
            log_info "${label} not detected; skipping ${t} target"
        fi
    done
    exit 0
fi

for t in "${TARGETS[@]}"; do
    if [[ "$TARGET" == "$t" ]]; then
        exec "${REPO_ROOT}/targets/${t}/install.sh" "${PASS_ARGS[@]:-}"
    fi
done
echo -e "${RED}Error: Unknown target '${TARGET}' (expected $(join_by ', ' "${TARGETS[@]}"), or all)${NC}"
exit 1
