#!/bin/bash
# Run config.alloy against tests/cases.py fixtures with a throwaway Loki, then check every
# line's labels. Run on a docker host (the Pi):  bash alloy/tests/run.sh
# Needs the GeoIP files; uses /docker/alloy/geo if present, else downloads them to a temp dir.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ALLOY_DIR="$(dirname "${HERE}")"
WORK="$(mktemp -d)"
NET="alloy-test-$$"
ALLOY_IMAGE="$(sed -n 's/^ *image: *\(grafana\/alloy:.*\)/\1/p' "${ALLOY_DIR}/docker-compose.yml")"
LOKI_IMAGE="grafana/loki:3.7.8"

cleanup() {
  [ "${KEEP:-0}" = "1" ] && { echo "kept: ${NET} (${WORK})"; return; }
  # Alloy writes positions as root; remove them from inside a container.
  docker run --rm -v "${WORK}:/w" --entrypoint rm "${ALLOY_IMAGE}" -rf /w/data >/dev/null 2>&1 || true
  docker rm -f "${NET}-alloy" "${NET}-loki" >/dev/null 2>&1 || true
  docker network rm "${NET}" >/dev/null 2>&1 || true
  rm -rf "${WORK}"
}
trap cleanup EXIT

export FIXTURE_START="$(( $(date +%s) - 3600 ))"
mkdir -p "${WORK}/logs" "${WORK}/backfill" "${WORK}/data"
chmod 777 "${WORK}/data"
python3 "${HERE}/cases.py" fixtures "${WORK}/logs"

GEO=/docker/alloy/geo
if [ ! -f "${GEO}/dbip-country-lite.mmdb" ]; then
  GEO="${WORK}/geo"
  GEO_DIR="${GEO}" bash "${ALLOY_DIR}/scripts/update-geoip.sh"
fi

docker network create "${NET}" >/dev/null
docker run -d --name "${NET}-loki" --network "${NET}" -p 127.0.0.1::3100 \
  -v "${HERE}/loki.yml:/etc/loki/loki.yml:ro" \
  "${LOKI_IMAGE}" -config.file=/etc/loki/loki.yml >/dev/null

docker run -d --name "${NET}-alloy" --network "${NET}" \
  -e OS_PW_SHA256="$(python3 "${HERE}/cases.py" digest)" \
  -e LOKI_URL="http://${NET}-loki:3100/loki/api/v1/push" \
  -v "${ALLOY_DIR}/config.alloy:/etc/alloy/config.alloy:ro" \
  -v "${WORK}/logs:/npm-logs:ro" \
  -v "${WORK}/backfill:/backfill:ro" \
  -v "${GEO}:/geo:ro" \
  -v "${WORK}/data:/var/lib/alloy/data" \
  "${ALLOY_IMAGE}" run --storage.path=/var/lib/alloy/data --disable-reporting \
  /etc/alloy/config.alloy >/dev/null

python3 "${HERE}/cases.py" expect > "${WORK}/expect.json"
LOKI_ADDR="$(docker port "${NET}-loki" 3100/tcp | head -1)"
set +e
python3 - "${WORK}/expect.json" "${LOKI_ADDR}" <<'PY'
import json, sys, time, urllib.parse, urllib.request

expect = json.load(open(sys.argv[1]))
loki = sys.argv[2]

def query():
    q = urllib.parse.urlencode({"query": '{job="npm"}', "since": "2h", "limit": "1000"})
    try:
        with urllib.request.urlopen(f"http://{loki}/loki/api/v1/query_range?{q}", timeout=10) as r:
            data = json.load(r)["data"]["result"]
    except Exception:
        return []
    return [(s["stream"], v[1], v[0]) for s in data for v in s["values"]]

rows = []
for _ in range(40):
    rows = query()
    if len(rows) >= len(expect):
        break
    time.sleep(3)

fail = 0
seen = {}
for labels, line, ts in rows:
    seen[str(int(ts) // 10**9)] = (labels, line)

for key, exp in expect.items():
    if key not in seen:
        print(f"MISSING line @ {key}: {exp}"); fail += 1; continue
    labels, line = seen[key]
    for k, v in exp.items():
        if k == "asn_org_contains":
            ok = v in labels.get("asn_org", "").lower()
        elif v is None:  # must be absent (empty structured metadata isn't stored)
            ok = not labels.get(k)
        else:
            ok = labels.get(k) == v
        if not ok:
            print(f"FAIL @ {key} {labels.get('uri')}: {k}={labels.get(k if k != 'asn_org_contains' else 'asn_org')!r}, want {v!r}")
            fail += 1

# No credential may survive into Loki, in the line or any label.
for labels, line, _ in rows:
    blob = line + json.dumps(labels)
    for secret in ("0123456789abcdef0123456789abcdef", "fedcba9876543210", "hunter2plaintext", "abc123secret",
                   "abcd1234secretwebhookid", "hlssecrettoken99", "camsecret42", "plexsecret123"):
        if secret in blob:
            print(f"LEAK {secret[:6]}… in {labels.get('uri')}"); fail += 1

print(f"{len(rows)} lines ingested, {len(expect)} cases, {fail} failures")
sys.exit(1 if fail else 0)
PY
status=$?
if [ "${status}" -ne 0 ]; then docker logs "${NET}-alloy" 2>&1 | tail -30; fi
exit "${status}"
