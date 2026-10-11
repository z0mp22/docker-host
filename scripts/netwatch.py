#!/usr/bin/env python3
"""Watch what selected LAN devices look up in Pi-hole; alert on domains off their allowlist.

Runs from cron/netwatch every 15 minutes. For each device in netwatch/watchlist.json it:
  1. finds the device's current IP by MAC (UniFi Integration API, read-only key from HA's
     secrets.yaml; Pi-hole's network table as fallback - Pi-hole sits on a Docker bridge, so it
     only knows MACs for some clients),
  2. reads Pi-hole's query log since the last run (read-only),
  3. publishes one MQTT message on home/netwatch/alert per new (device, domain) that matches none
     of the device's allowed domain suffixes. HA (packages/netwatch.yaml) turns each into a push.
A retained summary of the last 24 h per device goes to home/netwatch/status.

State (/var/lib/netwatch/state.json) remembers which (device, domain) pairs were already alerted,
so each off-allowlist domain alerts once. Delete a device's entry there to hear about it again.
"""
from __future__ import annotations

import json
import os
import re
import sqlite3
import ssl
import subprocess
import sys
import time
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

CONFIG = Path(os.environ.get("NETWATCH_CONFIG", "/etc/netwatch/watchlist.json"))
STATE = Path(os.environ.get("NETWATCH_STATE", "/var/lib/netwatch/state.json"))
FTL_DB = os.environ.get("NETWATCH_FTL_DB", "/docker/pihole/etc-pihole/pihole-FTL.db")
HA_SECRETS = Path(os.environ.get("NETWATCH_HA_SECRETS", "/docker/homeassistant/secrets.yaml"))
UDM = os.environ.get("NETWATCH_UDM", "https://10.0.0.1")
ALERT_TOPIC = "home/netwatch/alert"
STATUS_TOPIC = "home/netwatch/status"
MAX_ALERTS_PER_DEVICE = 5  # per run; the rest are folded into one summary alert
FIRST_RUN_LOOKBACK = 24 * 3600


def log(msg: str) -> None:
    print(f"[{datetime.now(timezone.utc):%Y-%m-%dT%H:%M:%SZ}] {msg}", flush=True)


def iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def allowed(domain: str, suffixes: list[str]) -> bool:
    domain = domain.lower().rstrip(".")
    return any(domain == s or domain.endswith("." + s) for s in suffixes)


def unifi_ips() -> dict[str, str]:
    """MAC -> IP for connected clients, from the UniFi Network Integration API."""
    match = re.search(r"^unifi_api_key:\s*['\"]?([^'\"\s#]+)", HA_SECRETS.read_text(), re.M)
    if not match:
        return {}
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE  # the UDM's certificate is self-signed

    def get(path: str) -> dict:
        req = urllib.request.Request(f"{UDM}/proxy/network/integration/v1/{path}",
                                     headers={"X-API-KEY": match.group(1), "Accept": "application/json"})
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            return json.load(resp)

    site = get("sites")["data"][0]["id"]
    ips: dict[str, str] = {}
    offset = 0
    while True:
        page = get(f"sites/{site}/clients?limit=200&offset={offset}")
        for client in page.get("data", []):
            if client.get("macAddress") and client.get("ipAddress"):
                ips[client["macAddress"].lower()] = client["ipAddress"]
        offset += len(page.get("data", []))
        if not page.get("data") or offset >= page.get("totalCount", 0):
            return ips


def pihole_ips(db: sqlite3.Connection) -> dict[str, str]:
    rows = db.execute(
        "SELECT n.hwaddr, a.ip FROM network n JOIN network_addresses a ON a.network_id = n.id "
        "ORDER BY a.lastSeen")
    return {mac.lower(): ip for mac, ip in rows}  # later (newer) rows win


def publish(topic: str, payload: dict, retain: bool = False) -> None:
    cmd = ["docker", "exec", "mosquitto", "mosquitto_pub", "-h", "127.0.0.1", "-t", topic,
           "-m", json.dumps(payload, separators=(",", ":"))]
    if retain:
        cmd.append("-r")
    subprocess.run(cmd, check=True, capture_output=True, timeout=15)


def main() -> int:
    devices: dict = json.loads(CONFIG.read_text())["devices"]
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    now = time.time()
    since = state.get("last_ts", now - FIRST_RUN_LOOKBACK)
    alerted: dict[str, list[str]] = state.setdefault("alerted", {})

    db = sqlite3.connect(f"file:{FTL_DB}?mode=ro", uri=True, timeout=10)
    ips = pihole_ips(db)
    try:
        ips.update(unifi_ips())
    except Exception as exc:  # fall back to Pi-hole's view; still useful
        log(f"WARN UniFi client lookup failed ({exc}); using Pi-hole's network table")

    status = {"updated": iso(now), "off_allowlist_24h": 0, "devices": {}}
    new_until = since
    for name, dev in devices.items():
        mac = dev["mac"].lower()
        suffixes = [s.lower().lstrip(".") for s in dev.get("allow", [])]
        ip = ips.get(mac)
        if not ip:
            status["devices"][name] = {"ip": None, "note": "not seen on the network"}
            continue

        day = Counter(d for (d,) in db.execute(
            "SELECT domain FROM queries WHERE client = ? AND timestamp > ?", (ip, now - 86400)))
        off_day = {d: c for d, c in day.items() if not allowed(d, suffixes)}
        status["devices"][name] = {
            "ip": ip,
            "queries_24h": sum(day.values()),
            "off_allowlist_24h": sum(off_day.values()),
            "top": day.most_common(5),
        }
        status["off_allowlist_24h"] += sum(off_day.values())

        fresh: dict[str, list[float]] = {}
        for domain, ts in db.execute(
                "SELECT domain, timestamp FROM queries WHERE client = ? AND timestamp > ? ORDER BY timestamp",
                (ip, since)):
            new_until = max(new_until, ts)
            if allowed(domain, suffixes) or domain in alerted.get(mac, []):
                continue
            fresh.setdefault(domain, []).append(ts)

        seen = alerted.setdefault(mac, [])
        for i, (domain, stamps) in enumerate(sorted(fresh.items(), key=lambda kv: kv[1][0])):
            if i == MAX_ALERTS_PER_DEVICE:
                rest = sorted(fresh)[MAX_ALERTS_PER_DEVICE:]
                publish(ALERT_TOPIC, {
                    "device": name, "mac": mac, "ip": ip, "domain": f"{len(rest)} more",
                    "message": f"{name} also looked up {len(rest)} more domains off its allowlist, "
                               f"e.g. {', '.join(rest[:3])}",
                })
                seen.extend(rest)
                break
            publish(ALERT_TOPIC, {
                "device": name, "mac": mac, "ip": ip, "domain": domain, "count": len(stamps),
                "first_seen": iso(stamps[0]),
                "message": f"{name} looked up {domain} ({len(stamps)}x since {iso(stamps[0])}), "
                           f"which isn't on its allowlist ({', '.join(suffixes) or 'nothing'}).",
            })
            seen.append(domain)
            log(f"ALERT {name} {ip} {domain} x{len(stamps)}")

    publish(STATUS_TOPIC, status, retain=True)
    state["last_ts"] = max(new_until, since)
    STATE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=1))
    tmp.replace(STATE)
    return 0


if __name__ == "__main__":
    sys.exit(main())
