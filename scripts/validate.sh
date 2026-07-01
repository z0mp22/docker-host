#!/bin/bash
# Post-deploy health checks. Exit non-zero on required service failure.
set -euo pipefail

HOST="${VALIDATE_HOST:-127.0.0.1}"
RETRIES="${VALIDATE_RETRIES:-24}"
SLEEP="${VALIDATE_SLEEP:-5}"

wait_for_metrics() {
  local name="$1"
  local url="$2"
  local pattern="$3"
  local i
  for i in $(seq 1 "${RETRIES}"); do
    if curl -sf "${url}" 2>/dev/null | grep -qE "${pattern}"; then
      echo "[validate] OK ${name}"
      return 0
    fi
    echo "[validate] waiting for ${name} (${i}/${RETRIES})"
    sleep "${SLEEP}"
  done
  echo "[validate] FAIL ${name} (${url})" >&2
  return 1
}

wait_for_http() {
  local name="$1"
  local url="$2"
  local i code
  for i in $(seq 1 "${RETRIES}"); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "${url}" 2>/dev/null || echo "000")"
    if [ "${code}" = "200" ] || [ "${code}" = "302" ] || [ "${code}" = "405" ]; then
      echo "[validate] OK ${name} (HTTP ${code})"
      return 0
    fi
    echo "[validate] waiting for ${name} (${i}/${RETRIES}, HTTP ${code})"
    sleep "${SLEEP}"
  done
  echo "[validate] FAIL ${name} (${url})" >&2
  return 1
}

check_container() {
  local name="$1"
  if docker ps --format '{{.Names}}' | grep -qx "${name}"; then
    echo "[validate] OK container ${name}"
  else
    echo "[validate] FAIL container ${name} not running" >&2
    return 1
  fi
}

main() {
  for c in homeassistant mosquitto npm pihole portainer node-exporter \
           pihole-exporter npm-exporter npm-metrics-exporter; do
    check_container "${c}"
  done

  wait_for_http "homeassistant" "http://${HOST}:8123/"

  if [ -f "$(dirname "$0")/validate-ha-config.py" ]; then
    echo "[validate] checking homeassistant config and recovery mode"
    python3 "$(dirname "$0")/validate-ha-config.py" || return 1
  fi

  wait_for_http "portainer" "http://${HOST}:9000/"
  wait_for_metrics "node-exporter" "http://${HOST}:9100/metrics" '^node_'
  wait_for_metrics "pihole-exporter" "http://${HOST}:9617/metrics" '^pihole_'
  wait_for_metrics "npm-exporter" "http://${HOST}:9113/metrics" 'nginx_up 1'
  wait_for_metrics "npm-metrics" "http://${HOST}:9114/metrics" '^npm_proxy_hosts_total'

  if docker ps --format '{{.Names}}' | grep -qx 'unifi-poller'; then
    wait_for_metrics "unifi-poller" "http://${HOST}:9130/metrics" '^unpoller_' || true
  else
    echo "[validate] SKIP unifi-poller (not running — optional)"
  fi

  echo "[validate] all required checks passed"
}

main "$@"
