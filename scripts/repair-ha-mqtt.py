#!/usr/bin/env python3
"""Ensure Home Assistant has a Mosquitto MQTT config entry (UI flow, not YAML broker)."""
from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from pathlib import Path

STORAGE = Path("/docker/homeassistant/.storage/core.config_entries")
BROKER = "127.0.0.1"
PORT = 1883


def log(message: str) -> None:
    print(f"[repair-mqtt] {message}")


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def main() -> int:
    if not STORAGE.exists():
        log("missing config entries storage")
        return 0

    data = json.loads(STORAGE.read_text())
    entries = data.get("data", {}).get("entries", [])
    mqtt_entries = [entry for entry in entries if entry.get("domain") == "mqtt"]

    if mqtt_entries:
        changed = False
        for entry in mqtt_entries:
            broker = entry.get("data", {}).get("broker")
            port = entry.get("data", {}).get("port")
            if broker != BROKER or port != PORT:
                entry.setdefault("data", {})
                entry["data"]["broker"] = BROKER
                entry["data"]["port"] = PORT
                entry["modified_at"] = now_iso()
                changed = True
                log(f"updated mqtt entry broker to {BROKER}:{PORT}")
        if not changed:
            log(f"mqtt config entry already present ({len(mqtt_entries)})")
        return 0

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
            "title": "Mosquitto",
            "unique_id": None,
            "version": 1,
            "discovery_keys": {},
        }
    )
    data["data"]["entries"] = entries
    STORAGE.write_text(json.dumps(data, indent=2) + "\n")
    log(f"created mqtt config entry for {BROKER}:{PORT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
