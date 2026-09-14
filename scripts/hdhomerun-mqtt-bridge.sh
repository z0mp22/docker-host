#!/bin/bash
# Pull the latest HDHomeRun signal reading from MQTT into a JSON file Home Assistant can read.
set -euo pipefail

OUT="${HDHOMERUN_STATE_FILE:-/docker/homeassistant/hdhomerun_signal_state.json}"

read_topic() {
  local topic="$1"
  docker exec mosquitto mosquitto_sub -h 127.0.0.1 -t "${topic}" -C 1 -W 2 2>/dev/null | tr -d '\000' || true
}

if ! docker ps --format '{{.Names}}' | grep -qx mosquitto; then
  exit 0
fi

STATUS_JSON="$(read_topic home/hdhomerun_signal/status)"

export STATUS_JSON OUT
python3 - <<'PY'
import json
import os
import re
from pathlib import Path


def clean_text(value: object) -> str:
    if value is None:
        return ""
    text = str(value)
    return re.sub(r"[\x00-\x1f<>]", "", text).strip()


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


status = parse_json(os.environ.get("STATUS_JSON", ""))
readings = status.get("readings") or []
latest = readings[0] if readings else {}
weather = latest.get("weather") or {}

data = {
    "updated_at": status.get("updated_at"),
    "channel": latest.get("channel"),
    "channel_name": latest.get("channel_name"),
    "signal_strength_percent": latest.get("signal_strength_percent"),
    "signal_quality_percent": latest.get("signal_quality_percent"),
    "symbol_quality_percent": latest.get("symbol_quality_percent"),
    "weather_condition": weather.get("condition"),
    "weather_temperature": weather.get("temperature"),
    "readings": readings,
}

out = Path(os.environ["OUT"])
tmp = out.with_suffix(".json.tmp")
tmp.write_text(json.dumps(data, indent=2))
tmp.replace(out)
PY
