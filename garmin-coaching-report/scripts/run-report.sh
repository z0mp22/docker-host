#!/bin/bash
# Ephemeral weekly coaching report run. Installed to /docker/garmin-coaching-report/ by deploy.
set -euo pipefail

docker run --rm \
  --env-file /docker/garmin-coaching-report/.env \
  -v /docker/garmin-coaching-report/tokens:/root/.garminconnect \
  -v /docker/garmin-coaching-report/reports:/reports \
  garmin-coaching-report:local
