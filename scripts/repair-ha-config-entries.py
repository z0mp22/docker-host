#!/usr/bin/env python3
"""Normalize Home Assistant config entries and ensure Mosquitto MQTT is configured."""
from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from pathlib import Path

STORAGE = Path("/docker/homeassistant/.storage/core.config_entries")
BROKER = "127.0.0.1"
PORT = 1883
ENTRY_DEFAULTS = {
    "discovery_keys": {},
    "disabled_by": None,
    "minor_version": 1,
    "options": {},
    "pref_disable_new_entities": False,
    "pref_disable_polling": False,
    "subentries": [],
    "version": 1,
}


def log(message: str) -> None:
    print(f"[repair-ha] {message}")


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def normalize_entry(entry: dict) -> bool:
    changed = False
    for key, value in ENTRY_DEFAULTS.items():
        if key not in entry:
            entry[key] = value
            changed = True
    if entry.get("domain") == "mqtt" and entry.get("minor_version", 0) < 2:
        entry["minor_version"] = 2
        changed = True
    return changed


def ensure_mqtt_entry(entries: list[dict]) -> bool:
    mqtt_entries = [entry for entry in entries if entry.get("domain") == "mqtt"]
    if mqtt_entries:
        changed = False
        for entry in mqtt_entries:
            data = entry.setdefault("data", {})
            if data.get("broker") != BROKER or data.get("port") != PORT:
                data["broker"] = BROKER
                data["port"] = PORT
                entry["modified_at"] = now_iso()
                changed = True
            if normalize_entry(entry):
                changed = True
        return changed

    stamp = now_iso()
    entries.append(
        {
            "created_at": stamp,
            "data": {"broker": BROKER, "port": PORT},
            "disabled_by": None,
            "domain": "mqtt",
            "entry_id": str(uuid.uuid4()),
            "minor_version": 2,
            "modified_at": stamp,
            "options": {},
            "pref_disable_new_entities": False,
            "pref_disable_polling": False,
            "source": "user",
            "subentries": [],
            "title": "Mosquitto",
            "unique_id": None,
            "version": 1,
            "discovery_keys": {},
        }
    )
    log(f"created mqtt config entry for {BROKER}:{PORT}")
    return True


def main() -> int:
    if not STORAGE.exists():
        log(f"missing storage file: {STORAGE}")
        return 1

    data = json.loads(STORAGE.read_text())
    entries = data.get("data", {}).get("entries", [])
    changed = False

    kept: list[dict] = []
    for entry in entries:
        host = entry.get("data", {}).get("host")
        if entry.get("domain") == "roku" and host in {"10.0.0.208"}:
            changed = True
            log(f"removed roku entry {entry.get('title', host)} ({host})")
            continue
        if normalize_entry(entry):
            changed = True
        kept.append(entry)

    if ensure_mqtt_entry(kept):
        changed = True

    if not changed:
        log("config entries already healthy")
        return 0

    data["data"]["entries"] = kept
    STORAGE.write_text(json.dumps(data, indent=2) + "\n")
    log("updated config entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
