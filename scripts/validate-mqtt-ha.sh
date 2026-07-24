#!/bin/bash
# Validate Mosquitto topics and surface Home Assistant MQTT log lines.
set -euo pipefail

HOST="${VALIDATE_HOST:-127.0.0.1}"
TOPICS=(
  "home/plex_recordings/state/status"
  "home/plex_recordings/state/last_scheduled"
  "home/plex_recordings/status"
  "home/plex_recordings/disk"
)

log() { echo "[validate-mqtt] $*"; }

check_topic() {
  local topic="$1"
  if docker exec mosquitto mosquitto_sub -h 127.0.0.1 -t "${topic}" -C 1 -W 3 >/tmp/mqtt-check.txt 2>/dev/null; then
    msg="$(tr -d '\000' </tmp/mqtt-check.txt | head -c 120)"
    log "OK topic ${topic}: ${msg}"
    return 0
  fi
  log "WARN topic ${topic}: no retained/live message"
  return 0
}

main() {
  if ! docker ps --format '{{.Names}}' | grep -qx mosquitto; then
    log "SKIP mosquitto container not running"
    exit 0
  fi

  for topic in "${TOPICS[@]}"; do
    check_topic "${topic}" || true
  done

  if [ -f /docker/homeassistant/plex_recordings_state.json ]; then
    log "OK state file: $(head -c 120 /docker/homeassistant/plex_recordings_state.json)"
  else
    log "WARN missing /docker/homeassistant/plex_recordings_state.json"
  fi

  if [ -f /docker/homeassistant/.storage/core.entity_registry ]; then
    log "plex entities in registry:"
    grep -o 'sensor\.plex[^"\\]*' /docker/homeassistant/.storage/core.entity_registry | sort -u | head -10 || true
  fi

  if docker ps --format '{{.Names}}' | grep -qx homeassistant; then
    log "recent homeassistant mqtt log lines:"
    docker logs homeassistant --since 10m 2>&1 | grep -iE 'mqtt|plex_recordings|command_line' | tail -20 || true
  fi

  log "done"
}

main "$@"
