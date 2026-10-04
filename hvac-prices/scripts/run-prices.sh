#!/bin/bash
# Monthly HVAC price refresh for the HA Climate panel (Fort Collins electric, Xcel gas).
# Installed to /docker/hvac-prices/scripts/ by deploy. Cron calls it daily with --cron; it only
# does work until the current month has a successful run, so a failed 1st retries the next day.
#
# The container only sees its own state dir; this wrapper publishes prices.json into the HA
# config dir. If the container dies before writing, the wrapper records the failure itself so
# the panel shows an error instead of quietly going stale.
set -euo pipefail

ROOT=/docker/hvac-prices
STATE="${ROOT}/state"
HA_FILE=/docker/homeassistant/hvac_prices.json
LOCK_FILE="${ROOT}/run-prices.lock"
IMAGE=hvac-prices:local

log() { echo "[run-prices $(date -Is)] $*"; }

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  log "another run holds ${LOCK_FILE}; skipping"
  exit 0
fi

mkdir -p "${STATE}"
if [ "$(stat -c %u "${STATE}")" != 1000 ]; then
  chown 1000:1000 "${STATE}"
fi

if [ "${1:-}" = "--cron" ]; then
  last_success=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("last_success") or "")' \
    "${STATE}/prices.json" 2>/dev/null || true)
  if [ "${last_success:0:7}" = "$(date +%Y-%m)" ]; then
    exit 0
  fi
  sleep $((RANDOM % 900))
fi

log "starting"
rc=0
docker run --rm --read-only --tmpfs /tmp --shm-size 256m --cap-drop ALL \
  --security-opt no-new-privileges --user 1000:1000 -v /etc/localtime:/etc/localtime:ro \
  -v "${STATE}:/state" "${IMAGE}" || rc=$?

if [ "${rc}" -ne 0 ] && [ "${rc}" -ne 1 ]; then
  log "container exited ${rc}; recording the failure for Home Assistant"
  python3 - "${STATE}/prices.json" "${rc}" <<'PY'
import json, os, sys, tempfile
from datetime import datetime

path, rc = sys.argv[1], sys.argv[2]
try:
    with open(path) as fh:
        feed = json.load(fh)
except (OSError, ValueError):
    feed = {"schema": 1, "last_success": None}
feed.update(
    status="error",
    last_attempt=datetime.now().astimezone().isoformat(timespec="seconds"),
    summary="",
    errors=[f"price container exited with code {rc} (see /docker/hvac-prices/cron.log)"],
    prices={},
)
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path))
with os.fdopen(fd, "w") as fh:
    json.dump(feed, fh, indent=1)
os.chmod(tmp, 0o644)
os.replace(tmp, path)
PY
fi

install -m 644 "${STATE}/prices.json" "${HA_FILE}.tmp"
mv -f "${HA_FILE}.tmp" "${HA_FILE}"
log "published $(python3 -c 'import json,sys; f=json.load(open(sys.argv[1])); print("status=%s %s %s" % (f["status"], f.get("summary", ""), "; ".join(f.get("errors", []))))' "${HA_FILE}")"
exit "${rc}"
