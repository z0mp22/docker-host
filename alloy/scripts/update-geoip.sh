#!/bin/bash
# Fetch db-ip's free "lite" country and ASN databases (CC-BY 4.0, https://db-ip.com) for Alloy's
# GeoIP stages. Monthly cron; db-ip publishes a new file at the start of each month, so fall
# back to last month's name early in the month. Alloy reads the files at startup, so restart it.
set -euo pipefail

GEO_DIR="${GEO_DIR:-/docker/alloy/geo}"
mkdir -p "${GEO_DIR}"

fetch() {
  local kind="$1" month url tmp
  tmp="$(mktemp)"
  for month in "$(date +%Y-%m)" "$(date -d "$(date +%Y-%m-01) -1 day" +%Y-%m)"; do
    url="https://download.db-ip.com/free/dbip-${kind}-lite-${month}.mmdb.gz"
    if curl -fsSL --retry 3 -o "${tmp}" "${url}"; then
      gunzip -c "${tmp}" > "${GEO_DIR}/dbip-${kind}-lite.mmdb.new"
      mv "${GEO_DIR}/dbip-${kind}-lite.mmdb.new" "${GEO_DIR}/dbip-${kind}-lite.mmdb"
      rm -f "${tmp}"
      echo "geoip: ${kind} ${month}"
      return 0
    fi
  done
  rm -f "${tmp}"
  echo "geoip: failed to download ${kind}" >&2
  return 1
}

fetch country
fetch asn

if [ "${RESTART_ALLOY:-0}" = "1" ] && docker ps --format '{{.Names}}' | grep -qx alloy; then
  docker restart alloy >/dev/null
fi
