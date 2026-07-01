#!/usr/bin/env python3
"""Hide the generated Overview dashboard and prune stale weather config entries."""
from __future__ import annotations

import json
from pathlib import Path

STORAGE = Path("/docker/homeassistant/.storage")
DASHBOARDS = STORAGE / "lovelace_dashboards"
CONFIG_ENTRIES = STORAGE / "core.config_entries"


def log(message: str) -> None:
    print(f"[tune-ha] {message}")


def hide_overview_dashboard() -> bool:
    if not DASHBOARDS.exists():
        log("SKIP lovelace_dashboards not found")
        return False
    data = json.loads(DASHBOARDS.read_text())
    changed = False
    for item in data.get("data", {}).get("items", []):
        url_path = item.get("url_path", "")
        title = item.get("title", "")
        if url_path in {"lovelace", "overview"} or title == "Overview":
            if item.get("show_in_sidebar", True):
                item["show_in_sidebar"] = False
                changed = True
                log(f"hid sidebar entry: {title or url_path}")
    if changed:
        DASHBOARDS.write_text(json.dumps(data, indent=2))
    return changed


def prune_stale_weather_entries() -> bool:
    if not CONFIG_ENTRIES.exists():
        log("SKIP core.config_entries not found")
        return False
    data = json.loads(CONFIG_ENTRIES.read_text())
    entries = data.get("data", {}).get("entries", [])
    keep: list[dict] = []
    removed = 0
    for entry in entries:
        domain = entry.get("domain", "")
        state = entry.get("state", "loaded")
        title = (entry.get("title") or "").lower()
        if domain in {"met", "accuweather", "openweathermap"} and state != "loaded":
            removed += 1
            log(f"removed stale {domain} entry: {entry.get('title')}")
            continue
        if domain == "met" and "forecast_home" in title and state == "not_loaded":
            removed += 1
            log(f"removed duplicate met entry: {entry.get('title')}")
            continue
        keep.append(entry)
    if removed:
        data["data"]["entries"] = keep
        CONFIG_ENTRIES.write_text(json.dumps(data, indent=2))
    return removed > 0


def main() -> int:
    changed = hide_overview_dashboard() or prune_stale_weather_entries()
    if not changed:
        log("no UI or weather entry changes needed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
