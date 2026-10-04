#!/bin/bash
# Store the salted fingerprint Alloy uses to recognise the owner's OpenSprinkler password.
# OpenSprinkler clients send md5(password) as ?pw=; Alloy compares sha256(pw + "npm-exposure")
# with OS_PW_SHA256, so neither the password nor its md5 sits in Alloy's config or UI.
#
#   set-owner-pw.sh             prompt for the OpenSprinkler password
#   set-owner-pw.sh --from-logs use the hash the OpenSprinkler app has been sending (most common
#                               pw on successful /ja status polls in the NPM logs)
#
# Re-run after changing the OpenSprinkler password, or every request will show as "unrecognized".
set -euo pipefail

ENV_FILE="${ENV_FILE:-/docker/alloy/.env}"
LOG_DIR="${LOG_DIR:-/docker/npm/data/logs}"

if [ "${1:-}" = "--from-logs" ]; then
  digest="$(sudo cat "${LOG_DIR}"/proxy-host-*_access.log | python3 -c '
import collections, hashlib, re, sys
seen = collections.Counter(
    m.group(1) for line in sys.stdin
    if " 200 - GET " in line and (m := re.search(r"\"/ja\?pw=([0-9a-f]{32})[&\"]", line)))
if not seen:
    sys.exit("no successful OpenSprinkler /ja polls in the current logs")
print(hashlib.sha256((seen.most_common(1)[0][0] + "npm-exposure").encode()).hexdigest())
')"
else
  read -r -s -p "OpenSprinkler password: " pw; echo
  digest="$(printf '%s' "${pw}" | python3 -c '
import hashlib, sys
md5 = hashlib.md5(sys.stdin.buffer.read()).hexdigest()
print(hashlib.sha256((md5 + "npm-exposure").encode()).hexdigest())')"
  unset pw
fi

touch "${ENV_FILE}"
chmod 600 "${ENV_FILE}"
grep -v '^OS_PW_SHA256=' "${ENV_FILE}" > "${ENV_FILE}.tmp" || true
echo "OS_PW_SHA256=${digest}" >> "${ENV_FILE}.tmp"
mv "${ENV_FILE}.tmp" "${ENV_FILE}"
echo "updated OS_PW_SHA256 in ${ENV_FILE}"

if docker ps --format '{{.Names}}' | grep -qx alloy; then
  (cd "$(dirname "${ENV_FILE}")" && docker compose up -d --force-recreate alloy)
fi
