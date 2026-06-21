#!/bin/bash
# One-time Garmin auth. Set GARMIN_MFA_CODE in .env or export for MFA accounts.
set -euo pipefail

ENV_FILE="${1:-/docker/garmin-coaching-report/.env}"

docker run -it --rm \
  --env-file "${ENV_FILE}" \
  -e "GARMIN_MFA_CODE=${GARMIN_MFA_CODE:-}" \
  -v /docker/garmin-coaching-report/tokens:/root/.garminconnect \
  --entrypoint python \
  garmin-coaching-report:local \
  -c "
import os, sys
from garmin_connect_mcp.auth import load_config
from garmin_connect_mcp.client import init_garmin_client

def prompt_mfa():
    code = os.environ.get('GARMIN_MFA_CODE', '').strip()
    if not code:
        code = input('MFA one-time code: ').strip()
    return code

config = load_config()
client = init_garmin_client(config, prompt_mfa=prompt_mfa)
sys.exit(0 if client else 1)
"
