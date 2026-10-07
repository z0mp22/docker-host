#!/bin/bash
# Host-side self-heal for the BlueZ stack behind HA's ThermoPro (TP358S) thermometers.
# Runs from /etc/cron.d/bluetooth-watchdog every 5 minutes. HA can see that the sensors went
# stale (packages/bluetooth_health.yaml reloads its own scanner), but not why; this covers the
# host side HA can't reach.
#
# 2026-10-06 outage: lightdm crash-looped on this headless Pi (labwc: "Found 0 GPUs") about
# 409k times. Every loop started a pipewire/wireplumber session that registered with
# bluetoothd, and bluetoothd leaked a D-Bus match rule per client until its connection hit
# max_match_rules_per_connection (2048). From then on BlueZ stopped feeding adverts to HA and
# both thermometers went unavailable for ~19 h while hci0 still read "UP RUNNING".
set -uo pipefail

LOG=/var/log/bluetooth-watchdog.log
STAMP=/run/bluetooth-watchdog.last-restart
# Don't restart bluetoothd more than once per this many seconds.
MIN_RESTART_GAP_S=1800

log() { echo "$(date -Is) $*" >> "${LOG}"; }

restart_bluetoothd() {
  local now last
  now=$(date +%s)
  last=$(cat "${STAMP}" 2>/dev/null || echo 0)
  if [ $((now - last)) -lt "${MIN_RESTART_GAP_S}" ]; then
    log "SKIP restart ($1): last restart $((now - last))s ago"
    return
  fi
  echo "${now}" > "${STAMP}"
  log "restarting bluetooth.service: $1"
  systemctl restart bluetooth
  sleep 3
  log "bluetooth.service $(systemctl is-active bluetooth); hci0 $(hciconfig hci0 2>/dev/null | grep -o 'UP RUNNING' || echo DOWN)"
}

# 1. There is no display on this Pi, so a display manager can only crash-loop.
if systemctl is-enabled --quiet lightdm 2>/dev/null || systemctl is-active --quiet lightdm 2>/dev/null; then
  systemctl disable --now lightdm >/dev/null 2>&1
  systemctl set-default multi-user.target >/dev/null 2>&1
  log "lightdm was enabled or running; disabled it and set multi-user.target"
fi

# 2. Adapter down: reuse the existing recovery (rfkill, power on, module reload).
if ! hciconfig hci0 2>/dev/null | grep -q 'UP RUNNING'; then
  log "hci0 not UP RUNNING; running ensure-bluetooth"
  /usr/local/bin/ensure-bluetooth.sh >> "${LOG}" 2>&1 || log "ensure-bluetooth failed"
  exit 0
fi

# 3. bluetoothd's own D-Bus connection at the match-rule limit.
bt_pid=$(systemctl show -p MainPID --value bluetooth)
conns=$(journalctl --since "-10min" --no-pager -q -t dbus-daemon 2>/dev/null \
  | grep -o 'Connection ":1\.[0-9]*" is not allowed to add more match rules' \
  | grep -o ':1\.[0-9]*' | sort -u)
for c in ${conns}; do
  pid=$(busctl --system status "${c}" 2>/dev/null | sed -n 's/^PID=//p')
  if [ -n "${pid}" ] && [ "${pid}" = "${bt_pid}" ]; then
    restart_bluetoothd "bluetoothd D-Bus connection ${c} hit the match-rule limit"
    break
  fi
done
