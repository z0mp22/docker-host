#!/bin/bash
# One weekly-coach update: a reply to a message or answer, a day check-off,
# or the nightly day check (coaching_report/coach_chat.py). Installed to
# /docker/garmin-coaching-report/scripts/ by deploy. Called by the Coach
# workflow (Home Assistant dispatches it) and by cron (COACH_MODE=check).
set -euo pipefail

BASE=/docker/garmin-coaching-report
LOCK_FILE=${BASE}/run-coach.lock

# Queue, don't skip: every message deserves its reply. Wait up to 5 min for
# the run before this one.
exec 9>"$LOCK_FILE"
if ! flock -w 300 9; then
  echo "[run-coach] waited 5 min for ${LOCK_FILE}; giving up ($(date -Is))"
  exit 1
fi

args=(run --rm --network docker_default --env-file "${BASE}/.env" --entrypoint python)
for v in COACH_MODE COACH_TEXT COACH_REF COACH_VALUE COACH_CID; do
  if [ -n "${!v:-}" ]; then args+=(-e "${v}=${!v}"); fi
done
args+=(
  -v "${BASE}/tokens:/root/.garminconnect"
  -v "${BASE}/reports:/reports"
  garmin-coaching-report:local
  -m coaching_report.coach_chat
)

set +e
docker "${args[@]}"
status=$?
set -e

# Publish even after a failed reply: the message itself was saved, and the
# panel shows it with a retry.
if [ -f "${BASE}/reports/weekly_coach.json" ]; then
  cp "${BASE}/reports/weekly_coach.json" /docker/homeassistant/weekly_coach_state.json
fi
exit "${status}"
