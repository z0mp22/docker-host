#!/bin/bash
# One-time (and after a UDM firmware update) setup for scripts/udm-traffic.py. Run from a
# workstation that can reach both hosts and has the UDM's root SSH password:
#
#   UDM_SSH_PASS=... scripts/udm-traffic-install.sh        (needs sshpass)
#
# 1. Makes docker-host's key at /etc/udm-traffic/id_ed25519 (root-only; never leaves the Pi).
# 2. Copies udm/traffic/{collect.sh,query.js} to /data/udm-traffic/ on the UDM.
# 3. Authorizes the key on the UDM as root, restricted to that one read-only command and to
#    docker-host's address: no shell, no forwarding, no pty.
# Re-running is safe; it replaces the previous key line. Firmware updates can reset
# /root/.ssh but keep /data, so if the panel says it can't read the UDM, run this again.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UDM="${UDM_HOST:-10.0.0.1}"
PI="${PI_HOST:-docker-host}"
PI_IP="${PI_IP:-10.0.0.4}"
TAG="udm-traffic@docker-host"
: "${UDM_SSH_PASS:?set UDM_SSH_PASS to the UDM root SSH password}"
export SSHPASS="$UDM_SSH_PASS"
udm() { sshpass -e ssh -o StrictHostKeyChecking=accept-new "root@${UDM}" "$@"; }

echo "[udm-traffic] key on ${PI}"
PUB="$(ssh "$PI" "sudo install -d -m 700 /etc/udm-traffic && \
  { sudo test -f /etc/udm-traffic/id_ed25519 || sudo ssh-keygen -q -t ed25519 -N '' -C '${TAG}' -f /etc/udm-traffic/id_ed25519; } && \
  sudo cat /etc/udm-traffic/id_ed25519.pub")"

echo "[udm-traffic] collector files on the UDM"
udm 'mkdir -p /data/udm-traffic'
sshpass -e scp -q "${REPO_ROOT}/udm/traffic/collect.sh" "${REPO_ROOT}/udm/traffic/query.js" "root@${UDM}:/data/udm-traffic/"
udm 'chmod 755 /data/udm-traffic/collect.sh && chmod 644 /data/udm-traffic/query.js'

echo "[udm-traffic] restricted key in /root/.ssh/authorized_keys"
LINE="restrict,from=\"${PI_IP}\",command=\"/bin/sh /data/udm-traffic/collect.sh\" ${PUB}"
printf '%s\n' "$LINE" | udm "set -e; K=/root/.ssh/authorized_keys; mkdir -p /root/.ssh; chmod 700 /root/.ssh; touch \$K; \
  (grep -v ' ${TAG}\$' \$K || true) > \$K.new; cat >> \$K.new; chmod 600 \$K.new; mv \$K.new \$K"

echo "[udm-traffic] test from ${PI}"
ssh "$PI" "sudo ssh -i /etc/udm-traffic/id_ed25519 -o BatchMode=yes -o UserKnownHostsFile=/etc/udm-traffic/known_hosts \
  -o StrictHostKeyChecking=accept-new root@${UDM} | head -c 300; echo"
echo "[udm-traffic] done"
