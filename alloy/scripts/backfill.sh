#!/bin/bash
# One-shot import of NPM's rotated access logs (*.log.N.gz, ~4 weeks) into Loki.
# Decompresses them into /docker/alloy/backfill/, which Alloy tails with a per-file "backfill"
# label. Lines before the real-IP fix carry Cloudflare edge IPs, so they get country=unknown.
#
#   backfill.sh          stage the files (Alloy picks them up within ~15s)
#   backfill.sh --clean  remove the staged files once Loki has them
set -euo pipefail

LOG_DIR="${LOG_DIR:-/docker/npm/data/logs}"
STAGE="${STAGE:-/docker/alloy/backfill}"

if [ "${1:-}" = "--clean" ]; then
  rm -f "${STAGE}"/*.log
  echo "backfill: cleaned ${STAGE}"
  exit 0
fi

mkdir -p "${STAGE}"
for gz in "${LOG_DIR}"/proxy-host-*_access.log.*.gz; do
  [ -e "${gz}" ] || continue
  # proxy-host-5_access.log.3.gz -> proxy-host-5_access-3.log
  name="$(basename "${gz}" .gz)"
  out="${STAGE}/${name%.log.*}-${name##*.}.log"
  sudo gunzip -c "${gz}" > "${out}.tmp"
  mv "${out}.tmp" "${out}"
  echo "backfill: $(wc -l < "${out}") lines from $(basename "${gz}")"
done
