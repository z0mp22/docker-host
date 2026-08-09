#!/bin/bash
# Best-effort recovery for the Pi onboard Bluetooth adapter used by HA ThermoPro sensors.
set -euo pipefail

log() { echo "[ensure-bluetooth] $*"; }

if ! command -v hciconfig >/dev/null 2>&1; then
  log "SKIP hciconfig not installed"
  exit 0
fi

if ! hciconfig hci0 >/dev/null 2>&1; then
  log "FAIL hci0 adapter missing"
  exit 1
fi

if hciconfig hci0 | grep -q 'UP RUNNING'; then
  log "OK hci0 already UP RUNNING"
  exit 0
fi

log "hci0 not up; attempting recovery"
rfkill unblock bluetooth 2>/dev/null || true
systemctl restart bluetooth 2>/dev/null || true
sleep 2
bluetoothctl power on 2>/dev/null || true
hciconfig hci0 up 2>/dev/null || true
sleep 2

if hciconfig hci0 | grep -q 'UP RUNNING'; then
  log "OK hci0 recovered to UP RUNNING"
  exit 0
fi

log "WARN soft recovery failed; reloading bluetooth modules"
systemctl stop bluetooth 2>/dev/null || true
docker stop homeassistant 2>/dev/null || true
sleep 1
modprobe -r btbcm hci_uart bluetooth 2>/dev/null || true
sleep 1
modprobe bluetooth 2>/dev/null || true
modprobe hci_uart 2>/dev/null || true
modprobe btbcm 2>/dev/null || true
sleep 2
systemctl start bluetooth 2>/dev/null || true
bluetoothctl power on 2>/dev/null || true
hciconfig hci0 up 2>/dev/null || true
docker start homeassistant 2>/dev/null || true
sleep 5

if hciconfig hci0 | grep -q 'UP RUNNING'; then
  log "OK hci0 recovered after module reload"
  exit 0
fi

log "FAIL hci0 still down after recovery"
hciconfig hci0 || true
exit 1
