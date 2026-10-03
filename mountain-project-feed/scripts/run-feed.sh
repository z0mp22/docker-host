#!/bin/bash
# Nightly Mountain Project "What's New" pull for the HA Climbing panel.
# Installed to /docker/mountain-project-feed/scripts/ by deploy.
#
# The container only ever sees its own state dir; this wrapper publishes feed.json into the
# HA config dir. If the container dies before writing (image missing, crash, OOM), the wrapper
# marks the feed as failed itself so the panel shows an error instead of quietly going stale.
#
# Overrides for testing failure paths: FEED_URL, BASE_URL, REQUEST_INTERVAL, RETRY_DELAYS.
set -euo pipefail

ROOT=/docker/mountain-project-feed
STATE="${ROOT}/state"
HA_FILE=/docker/homeassistant/mountain_project_feed.json
LOCK_FILE="${ROOT}/run-feed.lock"
IMAGE=mountain-project-feed:local

log() { echo "[run-feed $(date -Is)] $*"; }

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  log "another run holds ${LOCK_FILE}; skipping"
  exit 0
fi

if [ "${1:-}" = "--cron" ]; then
  sleep $((RANDOM % 900))
fi

mkdir -p "${STATE}"
if [ "$(stat -c %u "${STATE}")" != 1000 ]; then
  chown 1000:1000 "${STATE}"
fi

args=(run --rm --network docker_default
  --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges --user 1000:1000
  -v "${STATE}:/state")
for var in FEED_URL BASE_URL REQUEST_INTERVAL RETRY_DELAYS; do
  if [ -n "${!var:-}" ]; then args+=(-e "${var}=${!var}"); fi
done
args+=("${IMAGE}")

log "starting"
rc=0
docker "${args[@]}" || rc=$?

if [ "${rc}" -ne 0 ]; then
  log "container exited ${rc}; recording the failure for Home Assistant"
  python3 - "${STATE}/feed.json" "${rc}" <<'PY'
import json, os, sys, tempfile
from datetime import datetime, timezone

path, rc = sys.argv[1], sys.argv[2]
try:
    with open(path) as fh:
        feed = json.load(fh)
except (OSError, ValueError):
    feed = {"schema": 1, "items": [], "counts": {}, "new_count": 0, "last_success": None}
feed.update(
    status="error",
    source="cache",
    last_attempt=datetime.now(timezone.utc).isoformat(),
    error=f"The nightly container exited with code {rc} before finishing (see /docker/mountain-project-feed/cron.log)",
    warnings=[],
)
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path))
with os.fdopen(fd, "w") as fh:
    json.dump(feed, fh, ensure_ascii=False)
os.chmod(tmp, 0o644)
os.replace(tmp, path)
PY
fi

install -m 644 "${STATE}/feed.json" "${HA_FILE}.tmp"
mv -f "${HA_FILE}.tmp" "${HA_FILE}"
log "published $(python3 -c 'import json,sys; f=json.load(open(sys.argv[1])); print("status=%s items=%d new=%d" % (f["status"], len(f["items"]), f.get("new_count", 0)))' "${HA_FILE}")"
exit "${rc}"
