#!/usr/bin/env python3
"""Summarize UDM traffic, firewall blocks and gateway memory for the Network panel.

Runs from cron/udm-traffic every 15 minutes. It SSHes to the UDM with a restricted key whose
forced command is udm/traffic/collect.sh (installed by scripts/udm-traffic-install.sh), so this
host can only read that output: no shell, no API login (the UDM's login lockout can't be hit).
It publishes one retained JSON summary on home/udm/traffic; HA's packages/udm_traffic.yaml
turns it into sensor.network_traffic and the Network panel draws the Traffic and Blocked cards.

Limits worth knowing (they're shown in the panel too):
  * Per-device bytes cover Wi-Fi clients only and include in-house traffic (a camera streaming
    to Frigate counts). Wired devices only exist as per-switch-port totals on the UDM.
  * The UDM keeps hourly stats since its last restart and daily stats ~90 days; "usual" is the
    median of up to 14 recent days and is left out until there are at least 3.
"""
from __future__ import annotations

import base64
import json
import os
import statistics
import subprocess
import sys
import time
from datetime import datetime, timezone

UDM = os.environ.get("UDM_TRAFFIC_HOST", "root@10.0.0.1")
KEY = os.environ.get("UDM_TRAFFIC_KEY", "/etc/udm-traffic/id_ed25519")
KNOWN_HOSTS = os.environ.get("UDM_TRAFFIC_KNOWN_HOSTS", "/etc/udm-traffic/known_hosts")
TOPIC = "home/udm/traffic"
HOUR = 3600
DAY = 86400

TOP_DEVICES = 8
MIN_USUAL_DAYS = 3
USUAL_DAYS = 14
# A device or the whole house is "unusual" when it sends this many times its usual daily
# amount AND at least this much more. Uploads only: big downloads are normal (streaming).
UNUSUAL_RATIO = 3
UNUSUAL_EXTRA_DEVICE = 500e6
UNUSUAL_EXTRA_HOUSE = 2e9
# A block rule "went quiet" if it blocked at least this many attempts the day before and none
# in the last 24 h (the device may be gone, or have a new MAC the rule doesn't cover).
QUIET_PREV_MIN = 20
NEW_DEVICE_DAYS = 7


def log(msg: str) -> None:
    print(f"[{datetime.now(timezone.utc):%Y-%m-%dT%H:%M:%SZ}] {msg}", flush=True)


def iso(ts: float | None) -> str | None:
    return None if not ts else datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch() -> dict[str, list[str]]:
    out = subprocess.run(
        ["ssh", "-i", KEY, "-o", "BatchMode=yes", "-o", "ConnectTimeout=15",
         "-o", f"UserKnownHostsFile={KNOWN_HOSTS}", "-o", "StrictHostKeyChecking=accept-new", UDM],
        check=True, capture_output=True, text=True, timeout=120).stdout
    sections: dict[str, list[str]] = {}
    cur = None
    for line in out.splitlines():
        if line.startswith("@@"):
            cur = sections.setdefault(line[2:].strip(), [])
        elif cur is not None and line.strip():
            cur.append(line)
    if "mongo" not in sections:
        raise RuntimeError(f"unexpected output from the UDM: {out[:200]!r}")
    return sections


def policy_id(key: str) -> tuple[int, str]:
    """'4-asusX2O6hjADINP2' -> (4, '6acbac5f63ba86300320d3f6'): type + base64url ObjectId."""
    kind, _, enc = key.partition("-")
    return int(kind), base64.urlsafe_b64decode(enc + "=" * (-len(enc) % 4)).hex()


def usual(days: list[list[float]], col: int, now: float) -> float | None:
    """Median of up to USUAL_DAYS recent complete days (stat_daily rows: [ms, sent, recv])."""
    vals = [r[col] for r in days if r[0] / 1000 < now - DAY][-USUAL_DAYS:]
    return statistics.median(vals) if len(vals) >= MIN_USUAL_DAYS else None


def gateway(sections: dict[str, list[str]], now: float) -> dict:
    mem = {}
    for line in sections.get("meminfo", []):
        k, _, v = line.partition(":")
        mem[k] = int(v.split()[0]) * 1024
    kills = []
    for line in sections.get("earlyoom", []):
        # "1791729637.123456 ZsDM earlyoom[1244]: sending SIGTERM to process 2863250 uid 997 "unifi": ..."
        try:
            ts = float(line.split()[0])
        except ValueError:
            continue
        proc = line.split('"')[1] if line.count('"') >= 2 else ""
        if "to process" in line:
            kills.append((ts, proc))
    total, avail = mem.get("MemTotal"), mem.get("MemAvailable")
    swap, swap_free = mem.get("SwapTotal"), mem.get("SwapFree")
    up = sections.get("uptime", ["0"])[0]
    return {
        "mem_total": total, "mem_available": avail,
        "mem_available_pct": round(100 * avail / total, 1) if total and avail is not None else None,
        "swap_used_pct": round(100 * (swap - swap_free) / swap, 1) if swap else None,
        "earlyoom_kills_24h": len(kills),
        "earlyoom_last": iso(kills[-1][0]) if kills else None,
        "earlyoom_procs": sorted({p for _, p in kills if p}),
        "uptime_s": int(float(up)),
    }


def summarize(raw: dict, gw: dict, now: float) -> dict:
    users = {u[0]: {"mac": u[0], "name": u[1] or u[2], "vendor": u[3], "first_seen": u[4], "last_seen": u[5],
                    "wired": u[6], "ip": u[7], "network": u[8]} for u in raw["users"]}

    def label(mac: str) -> dict:
        u = users.get(mac, {})
        return {"mac": mac, "name": u.get("name") or "", "vendor": u.get("vendor") or ""}

    stats_since = raw["stats_since"] / 1000
    window_start = max(now - DAY, stats_since)
    covered_h = round((now - window_start) / HOUR, 1)

    # Whole-house internet use, per hour for the chart.
    hours: dict[int, list[float]] = {}
    for ms, rx, tx in raw["wan"]:
        t = int(ms / 1000) // HOUR * HOUR
        h = hours.setdefault(t, [0.0, 0.0])
        h[0] += rx
        h[1] += tx
    cur_hour = int(now) // HOUR * HOUR
    chart = [[t, round(hours.get(t, [0, 0])[0]), round(hours.get(t, [0, 0])[1])]
             for t in range(cur_hour - 23 * HOUR, cur_hour + HOUR, HOUR) if t + HOUR > stats_since]
    down = sum(r[1] for r in raw["wan"] if r[0] / 1000 >= now - DAY)
    up = sum(r[2] for r in raw["wan"] if r[0] / 1000 >= now - DAY)
    usual_down, usual_up = usual(raw["wan_daily"], 1, now), usual(raw["wan_daily"], 2, now)
    wan = {
        "down": round(down), "up": round(up),
        "usual_down": usual_down and round(usual_down), "usual_up": usual_up and round(usual_up),
        "unusual_up": bool(usual_up and covered_h >= 20 and up >= UNUSUAL_RATIO * usual_up
                           and up - usual_up >= UNUSUAL_EXTRA_HOUSE),
        "hours": chart,
    }

    # Internet-blocked MACs, so the panel can say a busy camera's traffic stays in the house.
    policies = raw["policies"]
    blocked_macs = {m.lower() for p in policies
                    if p["enabled"] and p["action"] in ("BLOCK", "REJECT") and p["dst_zone"] == "external"
                    for m in p["macs"]}

    devices = []
    for mac, (sent, recv) in raw["users_24h"].items():
        if sent + recv <= 0:
            continue
        hist = raw["users_daily"].get(mac, [])
        u_sent = usual(hist, 1, now)
        devices.append({
            **label(mac), "sent": round(sent), "recv": round(recv),
            "usual_sent": u_sent and round(u_sent),
            "usual_recv": (lambda v: v and round(v))(usual(hist, 2, now)),
            "internet_blocked": mac.lower() in blocked_macs,
            "unusual": bool(u_sent is not None and covered_h >= 20 and sent >= UNUSUAL_RATIO * u_sent
                            and sent - u_sent >= UNUSUAL_EXTRA_DEVICE),
        })
    devices.sort(key=lambda d: d["sent"] + d["recv"], reverse=True)
    wifi_count = len(devices)
    shown = devices[:TOP_DEVICES] + [d for d in devices[TOP_DEVICES:] if d["unusual"]]

    # Blocks per rule, last 24 h vs the 24 h before (when the UDM has that much history).
    cur_by_policy: dict[str, int] = {}
    prev_by_policy: dict[str, int] = {}
    by_client: dict[str, int] = {}
    for ms, by_pol, by_cli in raw["flows"]:
        recent = ms / 1000 >= now - DAY
        for key, cnt in by_pol.items():
            kind, pid = policy_id(key)
            if kind == 26:  # dropped at the router; counted from the flow log below instead
                continue
            target = cur_by_policy if recent else prev_by_policy
            target[pid] = target.get(pid, 0) + cnt
        if recent:
            for mac, cnt in by_cli.items():
                by_client[mac] = by_client.get(mac, 0) + cnt
    have_prev = stats_since <= now - 2 * DAY + HOUR

    rules: dict[str, dict] = {}
    for p in sorted(policies, key=lambda x: x["index"]):
        if p["dst_zone"] != "external" or not p["enabled"]:
            continue
        # The UI creates one copy per source zone (Internal, Hotspot); show them as one rule.
        r = rules.setdefault(p["name"], {"name": p["name"], "action": p["action"], "port": p["port"],
                                         "attempts": 0, "prev": 0 if have_prev else None, "macs": []})
        r["attempts"] += cur_by_policy.get(p["id"], 0)
        if have_prev:
            r["prev"] += prev_by_policy.get(p["id"], 0)
        r["macs"] += [m.lower() for m in p["macs"] if m.lower() not in r["macs"]]
    out_rules = []
    for r in rules.values():
        block = r["action"] in ("BLOCK", "REJECT")
        devs = []
        for mac in r["macs"]:
            u = users.get(mac, {})
            tried = sorted(raw["tried"].get(mac, []), key=lambda x: -x[1])
            devs.append({**label(mac), "attempts": by_client.get(mac, 0) if block else None,
                         "last_seen": iso(u.get("last_seen")),
                         "tried": [t[0] for t in tried[:3]] if block else []})
        out_rules.append({
            "name": r["name"], "kind": "block" if block else ("allow" if not r["port"] else "allow_port"),
            "port": r["port"], "attempts": r["attempts"] if block else None,
            "prev": r["prev"] if block else None,
            "went_quiet": bool(block and r["prev"] is not None and r["prev"] >= QUIET_PREV_MIN and r["attempts"] == 0),
            "devices": devs,
        })
    out_rules.sort(key=lambda r: (r["kind"] != "block", -(r["attempts"] or 0)))

    inbound = raw["inbound"]
    inbound_out = {
        # From the flow log, which can start later than the stats (it keeps ~10 days).
        "since": iso(inbound["since"] / 1000),
        "dropped": inbound["dropped"],
        "sources": inbound["sources"],
        "ports": sorted(inbound["ports"], key=lambda x: -x[1])[:5],
        "countries": sorted([r for r in inbound["regions"] if r[0]], key=lambda x: -x[1])[:5],
        "web": sum(c for p, c in inbound["ports"] if p in (80, 443)),
    }

    new_devices = sorted(
        [{**label(u["mac"]), "first_seen": iso(u["first_seen"]), "wired": u["wired"], "ip": u["ip"],
          "network": u["network"]}
         for u in users.values() if u["first_seen"] and u["first_seen"] >= now - NEW_DEVICE_DAYS * DAY],
        key=lambda d: d["first_seen"], reverse=True)

    return {
        "updated": iso(now),
        "stats_since": iso(stats_since),
        "covered_h": covered_h,
        "wan": wan,
        "devices": shown,
        "wifi_devices": wifi_count,
        "rules": out_rules,
        "inbound": inbound_out,
        "new_devices": new_devices[:10],
        "gateway": gw,
    }


def publish(payload: dict) -> None:
    subprocess.run(["docker", "exec", "-i", "mosquitto", "mosquitto_pub", "-h", "127.0.0.1", "-t", TOPIC, "-r", "-s"],
                   input=json.dumps(payload, separators=(",", ":")), text=True,
                   check=True, capture_output=True, timeout=20)


def main() -> int:
    now = time.time()
    sections = fetch()
    raw = json.loads(sections["mongo"][-1])
    payload = summarize(raw, gateway(sections, now), now)
    if "--print" in sys.argv:
        print(json.dumps(payload, indent=1))
        return 0
    publish(payload)
    w = payload["wan"]
    log(f"ok: {w['down'] / 1e9:.1f} GB down / {w['up'] / 1e9:.1f} GB up in {payload['covered_h']} h, "
        f"{sum(r['attempts'] or 0 for r in payload['rules'])} blocked, {len(json.dumps(payload))} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
