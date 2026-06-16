#!/usr/bin/env python3
"""Remove broken Roku config entries and normalize remaining entries."""
from __future__ import annotations

import json
import sys
from pathlib import Path

STORAGE = Path("/docker/homeassistant/.storage/core.config_entries")
REMOVE_HOSTS = {"10.0.0.208"}
ENTRY_DEFAULTS = {
    "discovery_keys": {},
    "disabled_by": None,
    "minor_version": 1,
    "options": {},
    "pref_disable_new_entities": False,
    "pref_disable_polling": False,
    "version": 1,
}


def log(message: str) -> None:
    print(f"[repair-ha] {message}")


def main() -> int:
    if not STORAGE.exists():
        log(f"missing storage file: {STORAGE}")
        return 1

    data = json.loads(STORAGE.read_text())
    entries = data.get("data", {}).get("entries", [])
    changed = False
    kept = []

    for entry in entries:
        host = entry.get("data", {}).get("host")
        if entry.get("domain") == "roku" and host in REMOVE_HOSTS:
            changed = True
            log(f"removed roku entry {entry.get('title', host)} ({host})")
            continue

        for key, value in ENTRY_DEFAULTS.items():
            if key not in entry:
                entry[key] = value
                changed = True
        kept.append(entry)

    if not changed:
        log("config entries already healthy")
        return 0

    data["data"]["entries"] = kept
    STORAGE.write_text(json.dumps(data, indent=2) + "\n")
    log("updated config entries")
    return 0


if __name__ == "__main__":
    sys.exit(main())
