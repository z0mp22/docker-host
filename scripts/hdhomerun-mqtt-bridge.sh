#!/bin/bash
# Pull the latest HDHomeRun signal readings from MQTT into a JSON file Home Assistant can read,
# split per tuner (live view) and per channel (trend sensors). See docs/decisions/0007-*.md.
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
if not status:
    # Nothing on the topic (or mosquitto_sub timed out): keep the last file.
    # HA flags it as stale from updated_at instead of reading it as idle.
    raise SystemExit(0)

readings = [r for r in status.get("readings") or [] if isinstance(r, dict)]
weather = next((r["weather"] for r in readings if r.get("weather")), {})

tuners = [
    {
        "tuner": r.get("tuner"),
        "channel": r.get("channel"),
        "channel_name": r.get("channel_name"),
        "strength": r.get("signal_strength_percent"),
        "quality": r.get("signal_quality_percent"),
        "symbol": r.get("symbol_quality_percent"),
        # First minute on a channel: still locking on, symbol quality reads 0.
        "settling": bool(r.get("settling")),
    }
    for r in readings
]

# Per channel, settled readings only. If both tuners sit on one channel, keep the worse one.
channels = {}
for t in tuners:
    if t["settling"] or not t["channel"] or t["quality"] is None:
        continue
    prev = channels.get(t["channel"])
    if prev is None or t["quality"] < prev["quality"]:
        channels[t["channel"]] = {k: t[k] for k in ("channel_name", "strength", "quality", "symbol")}

data = {
    "updated_at": status.get("updated_at"),
    "tuners": tuners,
    "channels": channels,
    "weather_condition": weather.get("condition"),
    "weather_temperature": weather.get("temperature"),
}

out = Path(os.environ["OUT"])
tmp = out.with_suffix(".json.tmp")
tmp.write_text(json.dumps(data, indent=2))
tmp.replace(out)
PY
