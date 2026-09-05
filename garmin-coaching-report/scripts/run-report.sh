#!/bin/bash
# Ephemeral coaching report run. Installed to /docker/garmin-coaching-report/ by deploy.
set -euo pipefail

LOCK_FILE=/docker/garmin-coaching-report/run-report.lock

# Single-flight guard for ALL invocation paths (cron, workflow_dispatch, manual).
# Non-blocking: if a run is already in progress, log and exit 0 (a rare skip is fine).
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[run-report] another coaching-report run holds ${LOCK_FILE}; skipping ($(date -Is))"
  exit 0
fi

# Build docker args. Forward window / dry-run controls ONLY when the caller set
# them, so cron (which sets none) produces byte-identical args to before.
args=(run --rm --env-file /docker/garmin-coaching-report/.env)
if [ -n "${SINCE:-}" ];   then args+=(-e "SINCE=${SINCE}"); fi
if [ -n "${THROUGH:-}" ]; then args+=(-e "THROUGH=${THROUGH}"); fi
if [ -n "${DRY_RUN:-}" ]; then args+=(-e "DRY_RUN=${DRY_RUN}"); fi
args+=(
  -v /docker/garmin-coaching-report/tokens:/root/.garminconnect
  -v /docker/garmin-coaching-report/fatsecret-tokens:/root/.fatsecret
  -v /docker/garmin-coaching-report/reports:/reports
  garmin-coaching-report:local
)

docker "${args[@]}"
