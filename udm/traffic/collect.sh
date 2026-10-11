#!/bin/sh
# Forced command of docker-host's udm-traffic SSH key (see scripts/udm-traffic-install.sh).
# Read-only: prints memory, earlyoom and uptime facts, then query.js's JSON.
# Installed on the UDM at /data/udm-traffic/ (/data survives firmware updates).
set -eu
DIR=/data/udm-traffic
echo "@@meminfo"
grep -E '^(MemTotal|MemAvailable|SwapTotal|SwapFree):' /proc/meminfo
echo "@@uptime"
cut -d' ' -f1 /proc/uptime
echo "@@earlyoom"
journalctl -u earlyoom --since -24h --no-pager -o short-unix 2>/dev/null | grep 'sending SIG' || true
echo "@@mongo"
exec mongo --quiet --norc --port 27117 ace "$DIR/query.js"
