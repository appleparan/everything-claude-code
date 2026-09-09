#!/usr/bin/env python3
"""Merge a flat config fragment into a Codex config.toml.

The fragment supports only ``[table]`` sections holding scalar keys (e.g.
``[agents]\ndefault_subagent_model = "gpt-5.6-terra"``); a top-level scalar
key or a nested sub-table in the fragment is rejected. Existing keys in the
destination config win unless ``--force`` is given. All other keys,
comments, and formatting in the destination are preserved via tomlkit. A
timestamped backup is written before any modification. Run via
``uv run --with tomlkit python3 merge-config.py ...``.
"""

import argparse
import shutil
import sys
import time
from pathlib import Path

import tomlkit
from tomlkit.items import Table


def validate_fragment(fragment: tomlkit.TOMLDocument) -> str | None:
    """Check that the fragment only contains `[table] key = scalar` layers.

    Args:
        fragment: Parsed fragment document.

    Returns:
        An error message if the fragment is unsupported, otherwise None.
    """
    for key, value in fragment.items():
        if not isinstance(value, Table):
            return f'top-level scalar key {key!r} is not supported (use [table] key = value)'
        for subkey, subvalue in value.items():
            if isinstance(subvalue, Table):
                return f'nested sub-table [{key}.{subkey}] is not supported'
    return None


def main() -> int:
    """Merge fragment keys into config.toml and report actions."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True, type=Path)
    parser.add_argument('--fragment', required=True, type=Path)
    parser.add_argument('--force', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    try:
        fragment = tomlkit.parse(args.fragment.read_text())
    except (OSError, tomlkit.exceptions.ParseError) as e:
        print(f'ERROR: cannot parse {args.fragment}: {e}', file=sys.stderr)
        return 1

    error = validate_fragment(fragment)
    if error:
        print(f'ERROR: unsupported fragment {args.fragment}: {error}', file=sys.stderr)
        return 1

    try:
        doc = (
            tomlkit.parse(args.config.read_text())
            if args.config.exists()
            else tomlkit.document()
        )
    except (OSError, tomlkit.exceptions.ParseError) as e:
        print(f'ERROR: cannot parse {args.config}: {e}', file=sys.stderr)
        return 1

    changed = []
    for table_name, table in fragment.items():
        if table_name not in doc:
            doc[table_name] = tomlkit.table()
        dest_table = doc[table_name]
        if not isinstance(dest_table, Table):
            print(
                f'ERROR: {args.config}: [{table_name}] is not a table; not merging',
                file=sys.stderr,
            )
            return 1
        for key, value in table.items():
            full_key = f'{table_name}.{key}'
            exists = key in dest_table
            if exists and not args.force:
                print(f'SKIP {full_key} (exists; use --force to overwrite)')
                continue
            dest_table[key] = value
            changed.append(full_key)
            print(f'{"SET " if exists else "ADD "} {full_key}')

    if args.dry_run or not changed:
        return 0

    args.config.parent.mkdir(parents=True, exist_ok=True)
    if args.config.exists():
        backup = args.config.with_name(f'{args.config.name}.bak.{int(time.time())}')
        shutil.copy2(args.config, backup)
        print(f'BACKUP {backup}')
    args.config.write_text(tomlkit.dumps(doc))
    return 0


if __name__ == '__main__':
    sys.exit(main())
