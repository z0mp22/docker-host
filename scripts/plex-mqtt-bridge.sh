#!/bin/bash
# Pull Plex recordings MQTT state into a JSON file Home Assistant can read.
set -euo pipefail

OUT="${PLEX_STATE_FILE:-/docker/homeassistant/plex_recordings_state.json}"

read_topic() {
  local topic="$1"
  docker exec mosquitto mosquitto_sub -h 127.0.0.1 -t "${topic}" -C 1 -W 2 2>/dev/null | tr -d '\000' || true
}

if ! docker ps --format '{{.Names}}' | grep -qx mosquitto; then
  exit 0
fi

STATUS="$(read_topic home/plex_recordings/state/status)"
LAST_SCHEDULED="$(read_topic home/plex_recordings/state/last_scheduled)"
LAST_COMPLETED="$(read_topic home/plex_recordings/state/last_completed)"
STATUS_JSON="$(read_topic home/plex_recordings/status)"

export STATUS LAST_SCHEDULED LAST_COMPLETED STATUS_JSON OUT
python3 - <<'PY'
import json
import os
import re
from datetime import UTC, datetime
from pathlib import Path


def clean_text(value: object) -> str:
    if value is None:
        return ""
    text = str(value)
    text = re.sub(r"[\x00-\x1f<>]", "", text)
    return text.strip()


def parse_json(raw: str) -> dict:
    raw = clean_text(raw)
    if not raw:
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        if start < 0:
            return {}
        try:
            payload = json.loads(raw[start:])
        except json.JSONDecodeError:
            return {}
    return payload if isinstance(payload, dict) else {}


status_json = parse_json(os.environ.get("STATUS_JSON", ""))
data = {
    "status": clean_text(os.environ.get("STATUS")) or clean_text(status_json.get("status")) or "unknown",
    "last_scheduled": clean_text(os.environ.get("LAST_SCHEDULED")) or "None queued",
    "last_completed": clean_text(os.environ.get("LAST_COMPLETED")) or "None yet",
    "ran_at": status_json.get("ran_at") or datetime.now(UTC).isoformat(),
    "matched": status_json.get("matched"),
    "scheduled": status_json.get("scheduled") or [],
    "skipped_existing": status_json.get("skipped_existing") or [],
    "plex_queue": status_json.get("plex_queue") or [],
    "errors": status_json.get("errors") or [],
}

out = Path(os.environ["OUT"])
tmp = out.with_suffix(".json.tmp")
tmp.write_text(json.dumps(data, indent=2))
tmp.replace(out)
PY
