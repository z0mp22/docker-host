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
from pathlib import Path

data = {
    "status": os.environ.get("STATUS") or "unknown",
    "last_scheduled": os.environ.get("LAST_SCHEDULED") or "None queued",
    "last_completed": os.environ.get("LAST_COMPLETED") or "None yet",
}
raw = os.environ.get("STATUS_JSON", "").strip()
if raw:
    try:
        payload = json.loads(raw)
        data.update(
            {
                "ran_at": payload.get("ran_at"),
                "matched": payload.get("matched"),
                "scheduled": payload.get("scheduled") or [],
                "skipped_existing": payload.get("skipped_existing") or [],
            }
        )
    except json.JSONDecodeError:
        pass
out = Path(os.environ["OUT"])
tmp = out.with_suffix(".json.tmp")
tmp.write_text(json.dumps(data, indent=2))
tmp.replace(out)
PY
