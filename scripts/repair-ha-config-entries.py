#!/usr/bin/env python3
"""Restore Home Assistant config entries from pre-Roku backup."""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

STORAGE = Path("/docker/homeassistant/.storage/core.config_entries")
BACKUP = STORAGE.with_suffix(".config_entries.bak")


def log(message: str) -> None:
    print(f"[repair-ha] {message}")


def main() -> int:
    if BACKUP.exists():
        shutil.copy2(BACKUP, STORAGE)
        log(f"restored config entries from {BACKUP}")
        return 0

    if not STORAGE.exists():
        log(f"missing storage file: {STORAGE}")
        return 1

    log("no backup found; leaving config entries unchanged")
    return 0


if __name__ == "__main__":
    sys.exit(main())
