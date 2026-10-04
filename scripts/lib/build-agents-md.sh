#!/usr/bin/env bash
# Generate an AGENTS.md on stdout: the global instructions, the target's own
# addendum (content/targets/<target>/instructions.md, when present), then an
# index of rules files installed under <dest-label>. With no languages the
# index is omitted (Claude Code loads ~/.claude/rules/ itself, so its
# CLAUDE.md needs only the global body and the addendum).
# Usage: build-agents-md.sh <dest-label> <target> [<lang>...]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTENT_ROOT="${REPO_ROOT}/content"

DEST_LABEL="${1:?usage: build-agents-md.sh <dest-label> <target> [<lang>...]}"
TARGET="${2:?usage: build-agents-md.sh <dest-label> <target> [<lang>...]}"
shift 2

cat "${CONTENT_ROOT}/instructions/global.md"

addendum="${CONTENT_ROOT}/targets/${TARGET}/instructions.md"
if [[ -f "$addendum" ]]; then
    echo ""
    cat "$addendum"
fi

[[ $# -gt 0 ]] || exit 0

echo ""
echo "## Rules Index"
echo ""
echo "Detailed rules are installed alongside this file."
echo "Read the matching file before working in that area:"
echo ""

for lang in "$@"; do
    rules_dir="${CONTENT_ROOT}/rules/${lang}"
    [[ -d "$rules_dir" ]] || continue
    for f in "$rules_dir"/*.md; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f")
        title=$(grep -m1 '^# ' "$f" | sed 's/^# //' || true)
        echo "- \`${DEST_LABEL}/${name}\` — ${title:-$name} (${lang})"
    done
done
