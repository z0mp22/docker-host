#!/usr/bin/env python3
"""Ensure Roku config entries exist in Home Assistant storage."""
from __future__ import annotations

import json
import secrets
import shutil
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

STORAGE = Path("/docker/homeassistant/.storage/core.config_entries")
ROKUS = (
    ("10.0.0.208", "Living Room"),
    ("10.0.0.188", "Basement"),
)
ENTRY_DEFAULTS = {
    "discovery_keys": {},
    "disabled_by": None,
    "minor_version": 1,
    "options": {},
    "pref_disable_new_entities": False,
    "pref_disable_polling": False,
    "source": "user",
    "version": 1,
}


def log(message: str) -> None:
    print(f"[ensure-roku] {message}")


def roku_info(host: str) -> dict[str, str]:
    with urllib.request.urlopen(f"http://{host}:8060/query/device-info", timeout=5) as response:
        root = ET.fromstring(response.read())

    def tag(name: str) -> str:
        element = root.find(name)
        return element.text.strip() if element is not None and element.text else ""

    title = tag("friendly-device-name") or tag("model-name") or host
    unique_id = tag("device-id") or tag("serial-number")
    if not unique_id:
        raise RuntimeError(f"could not read device id from {host}")

    return {"title": title, "unique_id": unique_id}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_entry(entry: dict) -> bool:
    changed = False
    for key, value in ENTRY_DEFAULTS.items():
        if key not in entry:
            entry[key] = value
            changed = True
    return changed


def main() -> int:
    if not STORAGE.exists():
        log(f"missing storage file: {STORAGE}")
        return 1

    data = json.loads(STORAGE.read_text())
    entries = data.setdefault("data", {}).setdefault("entries", [])
    changed = False

    for entry in entries:
        if normalize_entry(entry):
            changed = True

    existing_hosts = {
        entry.get("data", {}).get("host")
        for entry in entries
        if entry.get("domain") == "roku"
    }
    existing_unique = {
        entry.get("unique_id")
        for entry in entries
        if entry.get("domain") == "roku" and entry.get("unique_id")
    }

    for host, label in ROKUS:
        if host in existing_hosts:
            log(f"already configured: {label} ({host})")
            continue

        try:
            info = roku_info(host)
        except (urllib.error.URLError, TimeoutError, ET.ParseError, RuntimeError) as exc:
            log(f"could not query {label} at {host}: {exc}")
            return 1

        if info["unique_id"] in existing_unique:
            log(f"already configured by unique_id: {info['title']} ({info['unique_id']})")
            continue

        entry = {
            "created_at": now_iso(),
            "data": {"host": host},
            "domain": "roku",
            "entry_id": secrets.token_hex(16),
            "modified_at": now_iso(),
            "title": info["title"],
            "unique_id": info["unique_id"],
        }
        entry.update(ENTRY_DEFAULTS)
        entries.append(entry)
        existing_hosts.add(host)
        existing_unique.add(info["unique_id"])
        changed = True
        log(f"added {info['title']} ({host})")

    if not changed:
        return 0

    backup = STORAGE.with_suffix(".config_entries.bak")
    shutil.copy2(STORAGE, backup)
    STORAGE.write_text(json.dumps(data, indent=2) + "\n")
    log(f"updated {STORAGE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
