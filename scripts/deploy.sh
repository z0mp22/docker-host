#!/bin/bash
# Sync repo to /docker and apply all stacks. Used by GitHub Actions and manual deploy.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_ROOT="${DEPLOY_ROOT:-/docker}"

log() { echo "[deploy] $*"; }
die() { echo "[deploy] ERROR: $*" >&2; exit 1; }

install_file() {
  local src="$1"
  local dest="$2"
  local mode="${3:-644}"
  mkdir -p "$(dirname "${dest}")"
  if install -m "${mode}" "${src}" "${dest}" 2>/dev/null; then
    return 0
  fi
  sudo install -m "${mode}" "${src}" "${dest}"
}

require_docker() {
  command -v docker >/dev/null || die "docker not found"
  docker info >/dev/null 2>&1 || die "docker daemon not reachable"
}

ensure_networks() {
  docker network inspect docker_default >/dev/null 2>&1 \
    || docker network create docker_default
  docker network inspect mqtt_network >/dev/null 2>&1 \
    || docker network create mqtt_network
}

sync_homeassistant() {
  log "syncing homeassistant config to ${DEPLOY_ROOT}/homeassistant"
  mkdir -p "${DEPLOY_ROOT}/homeassistant"
  # Do not use --delete: HA creates host-only paths (blueprints, .storage, etc.)
  rsync -a \
    --exclude 'secrets.yaml' \
    --exclude '.storage/' \
    --exclude 'custom_components/' \
    --exclude 'blueprints/' \
    --exclude 'home-assistant.log*' \
    --exclude 'deps/' \
    --exclude '*.db' \
    --exclude '.cloud/' \
    --exclude 'tts/' \
    --exclude 'www/' \
    "${REPO_ROOT}/homeassistant/config/" "${DEPLOY_ROOT}/homeassistant/"

  if [ ! -f "${DEPLOY_ROOT}/homeassistant/secrets.yaml" ]; then
    if [ -f "${REPO_ROOT}/homeassistant/config/secrets.yaml.example" ]; then
      cp "${REPO_ROOT}/homeassistant/config/secrets.yaml.example" \
        "${DEPLOY_ROOT}/homeassistant/secrets.yaml"
      log "created secrets.yaml from example — edit on host before relying on integrations"
    else
      die "missing ${DEPLOY_ROOT}/homeassistant/secrets.yaml"
    fi
  fi
}

sync_mosquitto() {
  log "syncing mosquitto config"
  mkdir -p "${DEPLOY_ROOT}/mosquitto/config" "${DEPLOY_ROOT}/mosquitto/data" "${DEPLOY_ROOT}/mosquitto/log"
  install_file "${REPO_ROOT}/mosquitto/config/mosquitto.conf" \
    "${DEPLOY_ROOT}/mosquitto/config/mosquitto.conf" 644
}

sync_npm_custom() {
  log "syncing NPM stub_status config"
  sudo mkdir -p "${DEPLOY_ROOT}/npm/data/nginx/custom"
  install_file "${REPO_ROOT}/npm/nginx/custom/http.conf" \
    "${DEPLOY_ROOT}/npm/data/nginx/custom/http.conf" 644
}

sync_exporter_stack() {
  local svc="$1"
  log "syncing ${svc}"
  mkdir -p "${DEPLOY_ROOT}/${svc}"
  rsync -a --exclude '.env' "${REPO_ROOT}/${svc}/" "${DEPLOY_ROOT}/${svc}/"
}

preserve_env_file() {
  local dir="$1"
  local example="${REPO_ROOT}/${dir}/.env.example"
  if [ ! -f "${DEPLOY_ROOT}/${dir}/.env" ] && [ -f "${example}" ]; then
    cp "${example}" "${DEPLOY_ROOT}/${dir}/.env"
    log "created ${DEPLOY_ROOT}/${dir}/.env from example — set secrets on host"
  fi
}

preserve_up_conf() {
  if [ ! -f "${DEPLOY_ROOT}/unifi-poller/up.conf" ]; then
    if [ -f "${REPO_ROOT}/unifi-poller/up.conf.example" ]; then
      cp "${REPO_ROOT}/unifi-poller/up.conf.example" "${DEPLOY_ROOT}/unifi-poller/up.conf"
      log "created up.conf from example — set UniFi credentials on host"
    else
      die "missing ${DEPLOY_ROOT}/unifi-poller/up.conf"
    fi
  fi
}

is_compose_managed() {
  local name="$1"
  docker inspect "${name}" --format '{{index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null | grep -q .
}

remove_legacy_container() {
  local name="$1"
  if docker ps -a --format '{{.Names}}' | grep -qx "${name}"; then
    if is_compose_managed "${name}"; then
      return 0
    fi
    log "replacing legacy container ${name} (volumes on host are kept)"
    docker rm -f "${name}"
  fi
}

migrate_legacy_main_stack() {
  for name in homeassistant mosquitto npm pihole portainer; do
    remove_legacy_container "${name}"
  done
}

migrate_legacy_exporters() {
  for name in node-exporter pihole-exporter npm-exporter npm-metrics-exporter unifi-poller; do
    remove_legacy_container "${name}"
  done
}

cleanup_compose_artifacts() {
  local name
  while read -r name; do
    [ -z "${name}" ] && continue
    log "removing stale compose artifact ${name}"
    docker rm -f "${name}" || true
  done < <(docker ps -a --format '{{.Names}}' | grep -E '_npm$|_mosquitto$|_portainer$|_pihole$' || true)
}

seed_host_env() {
  if [ -f "${DEPLOY_ROOT}/.env" ]; then
    return 0
  fi
  if docker inspect pihole >/dev/null 2>&1; then
    local pw
    pw="$(docker inspect pihole --format '{{range .Config.Env}}{{println .}}{{end}}' \
      | sed -n 's/^WEBPASSWORD=//p' | head -1)"
    if [ -n "${pw}" ]; then
      printf 'PIHOLE_WEBPASSWORD=%s\n' "${pw}" > "${DEPLOY_ROOT}/.env"
      log "seeded ${DEPLOY_ROOT}/.env from running pihole container"
      return 0
    fi
  fi
  if [ -f "${REPO_ROOT}/.env.example" ]; then
    cp "${REPO_ROOT}/.env.example" "${DEPLOY_ROOT}/.env"
    log "created ${DEPLOY_ROOT}/.env from example — set PIHOLE_WEBPASSWORD before recreating pihole"
  fi
}

deploy_main_stack() {
  log "deploying main stack"
  seed_host_env
  install_file "${REPO_ROOT}/docker-compose.yml" "${DEPLOY_ROOT}/docker-compose.yml" 644
  (
    cd "${DEPLOY_ROOT}"
    if [ "${PULL_IMAGES:-0}" = "1" ]; then
      docker compose --env-file "${DEPLOY_ROOT}/.env" pull
    fi
    docker compose --env-file "${DEPLOY_ROOT}/.env" up -d
  )
}

reload_npm() {
  if ! docker ps --format '{{.Names}}' | grep -qx 'npm'; then
    return 0
  fi
  log "reloading NPM nginx"
  local i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if docker exec npm nginx -t >/dev/null 2>&1; then
      docker exec npm nginx -s reload
      return 0
    fi
    sleep 3
  done
  log "WARN: NPM nginx reload skipped (container not ready)"
}

deploy_exporters() {
  log "deploying node-exporter"
  (
    cd "${DEPLOY_ROOT}/node-exporter"
    [ "${PULL_IMAGES:-0}" = "1" ] && docker compose pull
    docker compose up -d
  )

  log "deploying pihole-exporter"
  (cd "${DEPLOY_ROOT}/pihole-exporter" && docker compose up -d)

  log "deploying npm-exporter"
  (cd "${DEPLOY_ROOT}/npm-exporter" && docker compose up -d)

  log "deploying npm-metrics-exporter"
  (cd "${DEPLOY_ROOT}/npm-metrics-exporter" && docker compose up -d --build)

  log "deploying unifi-poller"
  (
    cd "${DEPLOY_ROOT}/unifi-poller"
    docker compose down 2>/dev/null || true
    docker rm -f unifi-poller 2>/dev/null || true
    [ "${PULL_IMAGES:-0}" = "1" ] && docker compose pull
    docker compose up -d
  )

  deploy_garmin_coaching_report
}

deploy_garmin_coaching_report() {
  log "deploying garmin-coaching-report"
  if [ -f "${REPO_ROOT}/.gitmodules" ]; then
    git -C "${REPO_ROOT}" submodule update --init garmin-coaching-report/vendor/garmin-connect-mcp 2>/dev/null \
      || log "WARN: submodule init skipped (not a git checkout?)"
  fi
  sync_exporter_stack "garmin-coaching-report"
  preserve_env_file "garmin-coaching-report"
  mkdir -p "${DEPLOY_ROOT}/garmin-coaching-report/tokens" \
           "${DEPLOY_ROOT}/garmin-coaching-report/fatsecret-tokens" \
           "${DEPLOY_ROOT}/garmin-coaching-report/reports"
  install_file "${REPO_ROOT}/garmin-coaching-report/scripts/run-report.sh" \
    "${DEPLOY_ROOT}/garmin-coaching-report/scripts/run-report.sh" 755
  install_file "${REPO_ROOT}/garmin-coaching-report/cron/garmin-coaching-report" \
    "/etc/cron.d/garmin-coaching-report" 644
  (
    cd "${DEPLOY_ROOT}/garmin-coaching-report"
    docker compose build
  )
}

restart_homeassistant_if_running() {
  if docker ps -a --format '{{.Names}}' | grep -qx 'homeassistant'; then
    log "restarting homeassistant to load config changes"
    if docker ps --format '{{.Names}}' | grep -qx 'homeassistant'; then
      docker restart homeassistant
    else
      docker start homeassistant
    fi
    sleep 90
  fi
}

repair_homeassistant_config_entries() {
  local repair="${REPO_ROOT}/scripts/repair-ha-config-entries.py"
  local tune="${REPO_ROOT}/scripts/tune-ha-lovelace.py"
  if [ ! -f "${repair}" ]; then
    return 0
  fi
  if ! docker ps -a --format '{{.Names}}' | grep -qx 'homeassistant'; then
    return 0
  fi
  if docker ps --format '{{.Names}}' | grep -qx 'homeassistant'; then
    log "stopping homeassistant for config entry repair"
    docker stop homeassistant
  fi
  log "repairing homeassistant config entries"
  sudo python3 "${repair}" || log "config entry repair skipped"
  if [ -f "${tune}" ]; then
    log "tuning lovelace sidebar and stale weather entries"
    sudo python3 "${tune}" || log "lovelace tune skipped"
  fi
}

add_roku_integrations() {
  local script="${REPO_ROOT}/scripts/add-roku-integrations.sh"
  if [ ! -x "${script}" ]; then
    return 0
  fi
  log "ensuring roku integrations via API"
  if bash "${script}"; then
    log "roku integrations ready"
  else
    log "roku API setup skipped (storage entries are used when available)"
  fi
}

install_plex_mqtt_bridge() {
  log "installing plex mqtt bridge"
  install_file "${REPO_ROOT}/scripts/plex-mqtt-bridge.sh" \
    "/usr/local/bin/plex-mqtt-bridge.sh" 755
  install_file "${REPO_ROOT}/cron/plex-mqtt-bridge" \
    "/etc/cron.d/plex-mqtt-bridge" 644
  bash /usr/local/bin/plex-mqtt-bridge.sh || log "WARN: plex mqtt bridge initial run failed"
}

main() {
  require_docker
  ensure_networks
  sync_homeassistant
  sync_mosquitto
  sync_npm_custom
  for svc in node-exporter pihole-exporter npm-exporter npm-metrics-exporter unifi-poller garmin-coaching-report; do
    sync_exporter_stack "${svc}"
  done
  preserve_env_file "pihole-exporter"
  preserve_up_conf
  cleanup_compose_artifacts
  migrate_legacy_main_stack
  deploy_main_stack
  reload_npm
  migrate_legacy_exporters
  deploy_exporters
  repair_homeassistant_config_entries
  install_plex_mqtt_bridge
  restart_homeassistant_if_running
  add_roku_integrations
  log "deploy complete"
}

main "$@"
