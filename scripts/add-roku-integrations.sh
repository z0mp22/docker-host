#!/bin/bash
# Add both Roku integrations to Home Assistant via the config flow API.
# Run on the Pi (10.0.0.4) after creating a long-lived access token.
set -euo pipefail

HA_URL="${HA_URL:-http://localhost:8123}"
SECRETS="${SECRETS:-/docker/homeassistant/secrets.yaml}"

log() { echo "[add-roku] $*"; }
die() { echo "[add-roku] ERROR: $*" >&2; exit 1; }

read_secret() {
  local key="$1"
  local file="$2"
  python3 - "$key" "$file" <<'PY'
import sys
key, path = sys.argv[1], sys.argv[2]
value = ""
with open(path) as f:
    for line in f:
        if line.startswith(f"{key}:"):
            value = line.split(":", 1)[1].strip().strip('"').strip("'")
            break
print(value)
PY
}

resolve_ha_token() {
  if [ -n "${HA_TOKEN:-}" ]; then
    echo "${HA_TOKEN}"
    return 0
  fi
  if [ ! -f "${SECRETS}" ]; then
    return 1
  fi
  local token user pass
  token="$(read_secret ha_long_lived_access_token "${SECRETS}")"
  if [ -n "${token}" ]; then
    echo "${token}"
    return 0
  fi
  user="$(read_secret ha_username "${SECRETS}")"
  pass="$(read_secret ha_password "${SECRETS}")"
  if [ -z "${user}" ] || [ -z "${pass}" ]; then
    return 1
  fi
  token="$(curl -fsS -X POST "${HA_URL}/auth/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "grant_type=password" \
    --data-urlencode "username=${user}" \
    --data-urlencode "password=${pass}" \
    --data-urlencode "client_id=add-roku-integrations" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("access_token",""))')"
  if [ -n "${token}" ]; then
    echo "${token}"
    return 0
  fi
  return 1
}

if ! HA_TOKEN="$(resolve_ha_token)"; then
  die "set HA_TOKEN or add ha_long_lived_access_token (or ha_username/ha_password) to ${SECRETS}"
fi

command -v curl >/dev/null || die "curl not found"
command -v python3 >/dev/null || die "python3 not found"

ROKUS=(
  "10.0.0.208|Living Room|Z Roku Ultra"
  "10.0.0.188|Basement|Basement Roku"
)

api() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  if [ -n "${data}" ]; then
    curl -fsS -X "${method}" \
      -H "Authorization: Bearer ${HA_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "${data}" \
      "${HA_URL}${path}"
  else
    curl -fsS -X "${method}" \
      -H "Authorization: Bearer ${HA_TOKEN}" \
      "${HA_URL}${path}"
  fi
}

roku_configured() {
  local host="$1"
  api GET "/api/config/config_entries/entry" | python3 -c '
import json, sys
host = sys.argv[1]
entries = json.load(sys.stdin)
for entry in entries:
    if entry.get("domain") != "roku":
        continue
    if entry.get("data", {}).get("host") == host:
        raise SystemExit(0)
raise SystemExit(1)
' "${host}"
}

add_roku() {
  local host="$1"
  local label="$2"
  local device_name="$3"

  if roku_configured "${host}"; then
    log "already configured: ${label} (${host})"
    return 0
  fi

  log "adding ${label} (${device_name}) at ${host}"
  local flow_id response
  flow_id="$(api POST "/api/config/config_entries/flow" '{"handler":"roku"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["flow_id"])')"
  response="$(api POST "/api/config/config_entries/flow/${flow_id}" "{\"host\":\"${host}\"}")"
  if ! echo "${response}" | python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("type") == "create_entry" else 1)'; then
    die "failed to add ${label}: ${response}"
  fi
  log "added ${label}"
}

for entry in "${ROKUS[@]}"; do
  IFS='|' read -r host label device_name <<< "${entry}"
  add_roku "${host}" "${label}" "${device_name}"
done

log "done"
