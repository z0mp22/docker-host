#!/bin/bash
# One-time FatSecret 3-legged OAuth. Requires FATSECRET_CONSUMER_KEY/SECRET in .env.
# Prints an authorize URL; approve in a browser and paste the PIN back here.
set -euo pipefail

ENV_FILE="${1:-/docker/garmin-coaching-report/.env}"

mkdir -p /docker/garmin-coaching-report/fatsecret-tokens

docker run -it --rm \
  --env-file "${ENV_FILE}" \
  -v /docker/garmin-coaching-report/fatsecret-tokens:/root/.fatsecret \
  --entrypoint python \
  garmin-coaching-report:local \
  -m coaching_report.fatsecret_setup
