#!/usr/bin/env python3
"""Ensure a single MQTT broker config: prefer YAML broker over UI config entry."""
from __future__ import annotations

import json
from pathlib import Path

STORAGE = Path("/docker/homeassistant/.storage/core.config_entries")
CONFIG = Path("/docker/homeassistant/configuration.yaml")
MQTT_YAML = Path("/docker/homeassistant/mqtt.yaml")


def log(message: str) -> None:
    print(f"[repair-mqtt] {message}")


def main() -> int:
    if not STORAGE.exists():
        log("missing config entries storage")
        return 0

    uses_yaml_broker = False
    if CONFIG.exists() and "mqtt:" in CONFIG.read_text():
        uses_yaml_broker = True
    if MQTT_YAML.exists() and "broker:" in MQTT_YAML.read_text():
        uses_yaml_broker = True

    data = json.loads(STORAGE.read_text())
    entries = data.get("data", {}).get("entries", [])
    mqtt_entries = [entry for entry in entries if entry.get("domain") == "mqtt"]

    if not mqtt_entries:
        log("no UI mqtt config entries")
        return 0

    if not uses_yaml_broker:
        log(f"keeping {len(mqtt_entries)} UI mqtt config entr(y/ies)")
        return 0

    kept = [entry for entry in entries if entry.get("domain") != "mqtt"]
    removed = len(entries) - len(kept)
    if removed:
        data["data"]["entries"] = kept
        STORAGE.write_text(json.dumps(data, indent=2) + "\n")
        log(f"removed {removed} UI mqtt config entr(y/ies); YAML broker is authoritative")
    else:
        log("UI mqtt entries already removed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
