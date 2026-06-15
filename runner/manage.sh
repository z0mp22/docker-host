#!/bin/bash
# Manage the native GitHub Actions runner on the Pi docker host.

set -euo pipefail

RUNNER_DIR="${RUNNER_DIR:-/home/pi/actions-runner}"
ACTION="${1:-status}"

print_status() { echo "[INFO] $1"; }
print_error() { echo "[ERROR] $1" >&2; }

is_running() {
  pgrep -f 'Runner.Listener run' >/dev/null
}

case "$ACTION" in
  status)
    if is_running; then
      print_status "Runner is running"
      pgrep -af 'Runner.Listener run'
    else
      print_error "Runner is not running"
      exit 1
    fi
    ;;
  start)
    if is_running; then
      print_status "Runner already running"
      exit 0
    fi
    cd "$RUNNER_DIR"
    nohup ./run.sh >> _diag/nohup.log 2>&1 &
    sleep 10
    if ! is_running; then
      print_error "Runner failed to start"
      tail -50 _diag/nohup.log || true
      exit 1
    fi
    print_status "Runner started"
    ;;
  stop)
    pkill -f 'Runner.Listener run' || true
    print_status "Runner stopped"
    ;;
  *)
    print_error "Usage: $0 [status|start|stop]"
    exit 1
    ;;
esac
