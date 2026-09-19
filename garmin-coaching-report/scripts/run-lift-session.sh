#!/bin/bash
# Ephemeral lift-session run. Installed to /docker/garmin-coaching-report/ by
# deploy. Independent of run-report.sh's cron/mountain-report pipeline: own
# lock file, own docker invocation, own HA state-file publish step below.
set -euo pipefail

LOCK_FILE=/docker/garmin-coaching-report/run-lift-session.lock

# Single-flight guard, own lock file -- these are legitimately independent
# pipelines and must not serialize against each other or against run-report.sh.
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[run-lift-session] another lift-session run holds ${LOCK_FILE}; skipping ($(date -Is))"
  exit 0
fi

args=(run --rm --env-file /docker/garmin-coaching-report/.env --network docker_default --entrypoint python)
if [ -n "${LIFT_SHOULDER_FLAG:-}" ]; then args+=(-e "LIFT_SHOULDER_FLAG=${LIFT_SHOULDER_FLAG}"); fi
if [ -n "${LIFT_NOTE:-}" ];          then args+=(-e "LIFT_NOTE=${LIFT_NOTE}"); fi
if [ -n "${DRY_RUN:-}" ];            then args+=(-e "DRY_RUN=${DRY_RUN}"); fi
args+=(
  -v /docker/garmin-coaching-report/tokens:/root/.garminconnect
  -v /docker/garmin-coaching-report/reports:/reports
  garmin-coaching-report:local
  -m coaching_report.lift_main
)

set +e
docker "${args[@]}"
status=$?
set -e

# Publish the latest session summary for Home Assistant's command_line
# sensor -- same pattern as the existing Plex/HDHomeRun MQTT bridges' state-
# file publish, just triggered here instead of on a cron. Skipped on a dry
# run (nothing new generated) or on failure (nothing to publish).
if [ "${status}" -eq 0 ] && [ -z "${DRY_RUN:-}" ] \
   && [ -f /docker/garmin-coaching-report/reports/lift_session_latest.json ]; then
  cp /docker/garmin-coaching-report/reports/lift_session_latest.json \
     /docker/homeassistant/lift_session_state.json
fi

exit "${status}"
