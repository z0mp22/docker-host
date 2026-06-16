#!/usr/bin/env python3
"""Ensure Roku config entries exist in Home Assistant storage."""
from __future__ import annotations

import json
import secrets
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from pathlib import Path

STORAGE = Path("/docker/homeassistant/.storage/core.config_entries")
ROKUS = (
    ("10.0.0.208", "Living Room"),
    ("10.0.0.188", "Basement"),
)


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
    return datetime.now(UTC).isoformat()


def main() -> int:
    if not STORAGE.exists():
        log(f"missing storage file: {STORAGE}")
        return 1

    data = json.loads(STORAGE.read_text())
    entries = data.setdefault("data", {}).setdefault("entries", [])
    existing = {
        entry.get("data", {}).get("host")
        for entry in entries
        if entry.get("domain") == "roku"
    }
    existing_unique = {
        entry.get("unique_id")
        for entry in entries
        if entry.get("domain") == "roku" and entry.get("unique_id")
    }

    added = 0
    for host, label in ROKUS:
        if host in existing:
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

        entries.append(
            {
                "created_at": now_iso(),
                "data": {"host": host},
                "disabled_by": None,
                "domain": "roku",
                "entry_id": secrets.token_hex(16),
                "minor_version": 1,
                "modified_at": now_iso(),
                "options": {},
                "pref_disable_new_entities": False,
                "pref_disable_polling": False,
                "source": "user",
                "title": info["title"],
                "unique_id": info["unique_id"],
                "version": 1,
            }
        )
        existing.add(host)
        existing_unique.add(info["unique_id"])
        added += 1
        log(f"added {info['title']} ({host})")

    if added:
        STORAGE.write_text(json.dumps(data, indent=2) + "\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
