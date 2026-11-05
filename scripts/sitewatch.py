#!/usr/bin/env python3
"""Summarize which sites each person in the house uses, from Pi-hole's DNS log, for the Online panel.

Runs from cron/sitewatch every 15 minutes. Read-only on Pi-hole and the UDM; it blocks nothing.
  1. maps each Pi-hole client IP to a MAC and device name (UniFi API, read-only key from HA's
     secrets.yaml; Pi-hole's network table as fallback), and each MAC to a person
     (sitewatch/people.json),
  2. reads Pi-hole's query log since the last run, drops lookups Pi-hole blocked, and turns each
     domain into a site with sitewatch/sites.json (longest suffix wins; null = background noise),
  3. counts "active minutes": a 5-minute window counts for a site when the device looked up at
     least MIN_HOSTS different hostnames of it (www, images, video, api...). Using a site or app
     pulls from several; an app refreshing in the background mostly polls one or two. Measured
     2026-11-04 over 3 days on the ThinkPad: 14 of 249 overnight site-windows pass (a 2-lookup
     rule passed 235). On phones it can't tell late-night use from an app syncing, so the panel
     calls these times estimates,
  4. publishes one retained summary (today, last 7 days, hour-by-hour today, new sites) on
     home/sitewatch/summary. HA (packages/sitewatch.yaml) turns it into sensor.online_activity.

State (/var/lib/sitewatch/state.json) keeps per-window hostnames (up to MIN_HOSTS) for the last
DETAIL_DAYS days and the first day each person was active on each site. The first run backfills HISTORY_DAYS days
using today's IP-to-MAC map, which is right for every device whose DHCP address didn't change.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import ssl
import subprocess
import sys
import time
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

PEOPLE = Path(os.environ.get("SITEWATCH_PEOPLE", "/etc/sitewatch/people.json"))
SITES = Path(os.environ.get("SITEWATCH_SITES", "/etc/sitewatch/sites.json"))
STATE = Path(os.environ.get("SITEWATCH_STATE", "/var/lib/sitewatch/state.json"))
FTL_DB = os.environ.get("SITEWATCH_FTL_DB", "/docker/pihole/etc-pihole/pihole-FTL.db")
HA_SECRETS = Path(os.environ.get("SITEWATCH_HA_SECRETS", "/docker/homeassistant/secrets.yaml"))
UDM = os.environ.get("SITEWATCH_UDM", "https://10.0.0.1")
TOPIC = "home/sitewatch/summary"
TZ = ZoneInfo("America/Denver")
BUCKET_S = 300
MIN_HOSTS = 3
DETAIL_DAYS = 8  # today + the 7 days before it
HISTORY_DAYS = 28  # how far back "new this week" looks for an earlier visit
TOP_SITES = 10
# Pi-hole v6 query statuses that were answered (forwarded, cached, retried, stale cache).
# Everything else was blocked (gravity, regex, deny list) or special (iCloud Private Relay, Firefox canary).
ANSWERED = (2, 3, 12, 13, 14, 17)
# A device nobody is assigned to is listed when it used at least this many named sites this week;
# fewer than that is almost always an IoT gadget talking to its own cloud.
UNASSIGNED_MIN_SITES = 2


def log(msg: str) -> None:
    print(f"[{datetime.now(timezone.utc):%Y-%m-%dT%H:%M:%SZ}] {msg}", file=sys.stderr, flush=True)


def iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def local_day(ts: float) -> str:
    return datetime.fromtimestamp(ts, TZ).strftime("%Y-%m-%d")


def bucket_of(ts: float) -> int:
    """5-minute window of the local day, 0..287 (DST days have 276 or 300; that's fine here)."""
    t = datetime.fromtimestamp(ts, TZ)
    return (t.hour * 3600 + t.minute * 60 + t.second) // BUCKET_S


class SiteMap:
    def __init__(self, cfg: dict):
        self.rules = {k.lower().lstrip("."): v for k, v in cfg["sites"].items()}
        self.multi = set(cfg.get("multi_part_suffixes", []))
        self._cache: dict[str, tuple[str | None, bool]] = {}

    def site(self, domain: str) -> tuple[str | None, bool]:
        """(site, named) for a domain; site None = drop. named = it matched a rule in sites.json."""
        hit = self._cache.get(domain)
        if hit is None:
            hit = self._cache[domain] = self._lookup(domain)
        return hit

    def _lookup(self, domain: str) -> tuple[str | None, bool]:
        labels = domain.split(".")
        for i in range(len(labels)):
            suffix = ".".join(labels[i:])
            if suffix in self.rules:
                return self.rules[suffix], self.rules[suffix] is not None
        if len(labels) < 2 or re.fullmatch(r"[\d.]+", domain):
            return None, False
        n = 3 if ".".join(labels[-2:]) in self.multi else 2
        return ".".join(labels[-n:]), False


def unifi_clients() -> dict[str, tuple[str, str]]:
    """IP -> (MAC, name) for every client the UDM knows, newest sighting winning."""
    match = re.search(r"^unifi_api_key:\s*['\"]?([^'\"\s#]+)", HA_SECRETS.read_text(), re.M)
    if not match:
        return {}
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE  # the UDM's certificate is self-signed

    def get(path: str) -> list:
        req = urllib.request.Request(f"{UDM}/proxy/network/api/s/default/{path}",
                                     headers={"X-API-KEY": match.group(1), "Accept": "application/json"})
        with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
            return json.load(resp).get("data", [])

    seen: dict[str, tuple[float, str, str]] = {}
    for c in get("rest/user"):  # known clients, including ones offline now (last_ip)
        if c.get("last_ip") and c.get("mac"):
            name = c.get("name") or c.get("hostname") or c["mac"]
            prev = seen.get(c["last_ip"])
            if not prev or (c.get("last_seen") or 0) > prev[0]:
                seen[c["last_ip"]] = (c.get("last_seen") or 0, c["mac"].lower(), name)
    for c in get("stat/sta"):  # connected right now: always wins
        if c.get("ip") and c.get("mac"):
            seen[c["ip"]] = (float("inf"), c["mac"].lower(), c.get("name") or c.get("hostname") or c["mac"])
    return {ip: (mac, name) for ip, (_, mac, name) in seen.items()}


def pihole_clients(db: sqlite3.Connection) -> dict[str, tuple[str, str]]:
    rows = db.execute(
        "SELECT a.ip, n.hwaddr, COALESCE(a.name, n.macVendor, n.hwaddr) FROM network n "
        "JOIN network_addresses a ON a.network_id = n.id ORDER BY a.lastSeen")
    return {ip: (mac.lower(), name) for ip, mac, name in rows if ":" in (mac or "")}


def publish(payload: dict) -> None:
    subprocess.run(["docker", "exec", "mosquitto", "mosquitto_pub", "-h", "127.0.0.1", "-t", TOPIC, "-r",
                    "-m", json.dumps(payload, separators=(",", ":"))], check=True, capture_output=True, timeout=15)


def ingest(state: dict, rows, who_of, sites: SiteMap) -> int:
    """Add (timestamp, client, domain) rows to state's per-window counts. Returns rows kept."""
    counts = state["counts"]  # who -> day -> site -> {bucket: 1 (active) or [hostnames so far]}
    first = state["first_seen"]  # who -> site -> day
    named = state["named"]  # sites that matched a rule (for unassigned-device filtering)
    kept = 0
    for ts, client, domain in rows:
        who = who_of(client)
        if not who:
            continue
        domain = domain.lower().rstrip(".")
        site, is_named = sites.site(domain)
        if not site:
            continue
        day = local_day(ts)
        b = str(bucket_of(ts))
        per = counts.setdefault(who, {}).setdefault(day, {}).setdefault(site, {})
        hosts = per.setdefault(b, [])
        if hosts != 1 and domain not in hosts:
            hosts.append(domain)
            if len(hosts) >= MIN_HOSTS:
                per[b] = 1  # active; no need to keep the names
                fs = first.setdefault(who, {})
                if site not in fs or day < fs[site]:
                    fs[site] = day
        if is_named:
            named[site] = 1
        kept += 1
    return kept


def prune(state: dict, today: str) -> None:
    keep_from = (datetime.strptime(today, "%Y-%m-%d") - timedelta(days=DETAIL_DAYS - 1)).strftime("%Y-%m-%d")
    for who in list(state["counts"]):
        days = state["counts"][who]
        for day in [d for d in days if d < keep_from]:
            del days[day]
        if not days:
            del state["counts"][who]


def active(buckets: dict) -> set[int]:
    return {int(b) for b, v in buckets.items() if v == 1}


def summarize(state: dict, people: dict, now: float) -> dict:
    today = local_day(now)
    days = [(datetime.strptime(today, "%Y-%m-%d") - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
    week_start = days[0]
    baseline_ok = state.get("history_from", today) <= (datetime.strptime(week_start, "%Y-%m-%d") - timedelta(days=7)).strftime("%Y-%m-%d")
    now_bucket = bucket_of(now)

    def block(who: str) -> dict:
        per_day = state["counts"].get(who, {})
        daily, week_sites, today_sites = [], defaultdict(int), {}
        hours = [0] * 24
        last = None
        for day in days:
            union: set[int] = set()
            for site, buckets in per_day.get(day, {}).items():
                act = active(buckets)
                if not act:
                    continue
                union |= act
                week_sites[site] += len(act) * BUCKET_S // 60
                if day == today:
                    today_sites[site] = len(act) * BUCKET_S // 60
            daily.append(len(union) * BUCKET_S // 60)
            if union:
                last = (day, max(union))
            if day == today:
                for b in union:
                    hours[min(23, b * BUCKET_S // 3600)] += BUCKET_S // 60
        top = lambda d: [[s, m] for s, m in sorted(d.items(), key=lambda kv: (-kv[1], kv[0]))[:TOP_SITES]]
        fs = state["first_seen"].get(who, {})
        new = sorted(([s, d] for s, d in fs.items() if d >= week_start and s in week_sites), key=lambda x: (-week_sites[x[0]], x[0]))
        return {
            "today_min": daily[-1],
            "week_min": sum(daily),
            "daily": daily,
            "hours": hours,
            "today": top(today_sites),
            "week": top(week_sites),
            "new": [[s, d, week_sites[s]] for s, d in new[:8]] if baseline_ok else [],
            "last_active": f"{last[0]}T{last[1] * BUCKET_S // 3600:02d}:{last[1] * BUCKET_S % 3600 // 60:02d}" if last else None,
            "active_now": bool(last and last[0] == today and now_bucket - last[1] <= 2),
        }

    out_people = []
    for p in people["people"]:
        b = block(p["name"])
        b["name"] = p["name"]
        b["devices"] = list(p["devices"].values())
        out_people.append(b)

    unassigned = []
    for who in state["counts"]:
        if not who.startswith("dev:"):
            continue
        b = block(who)
        named_sites = [s for s, _ in b["week"] if s in state["named"]]
        if len(named_sites) < UNASSIGNED_MIN_SITES:
            continue
        mac = who[4:]
        b["name"] = state["names"].get(mac, mac)
        b["mac"] = mac
        b["new"] = []
        unassigned.append(b)
    unassigned.sort(key=lambda b: -b["week_min"])

    return {
        "updated": iso(now),
        "today": today,
        "days": days,
        "bucket_min": BUCKET_S // 60,
        "min_hosts": MIN_HOSTS,
        "new_ready": baseline_ok,
        "history_from": state.get("history_from"),
        "people": out_people,
        "unassigned": unassigned[:6],
        "coverage": state.get("coverage", {}),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--dry-run", action="store_true", help="print the summary; don't publish or save state")
    args = ap.parse_args()

    people = json.loads(PEOPLE.read_text())
    sites = SiteMap(json.loads(SITES.read_text()))
    owner = {mac.lower(): p["name"] for p in people["people"] for mac in p["devices"]}
    ignore = {mac.lower() for mac in people.get("ignore", {})}

    now = time.time()
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    for k in ("counts", "first_seen", "named", "names"):
        state.setdefault(k, {})
    since = state.get("last_ts")
    if since is None:
        since = now - HISTORY_DAYS * 86400
        state["history_from"] = local_day(since + 86400)  # first full day
        log(f"first run: backfilling {HISTORY_DAYS} days")

    db = sqlite3.connect(f"file:{FTL_DB}?mode=ro", uri=True, timeout=10)
    db.text_factory = lambda b: b.decode("utf-8", "replace")  # a few logged queries are binary junk
    clients = pihole_clients(db)
    try:
        clients.update(unifi_clients())
    except Exception as exc:  # fall back to Pi-hole's view; still useful
        log(f"WARN UniFi client lookup failed ({exc}); using Pi-hole's network table")
    for mac, name in {v for v in clients.values()}:
        state["names"][mac] = name

    def who_of(ip: str) -> str | None:
        hit = clients.get(ip)
        if not hit or hit[0] in ignore:
            return None
        return owner.get(hit[0]) or f"dev:{hit[0]}"

    marks = ",".join("?" * len(ANSWERED))
    rows = db.execute(
        f"SELECT timestamp, client, domain FROM queries WHERE timestamp > ? AND timestamp <= ? AND status IN ({marks}) ORDER BY timestamp",
        (since, now, *ANSWERED)).fetchall()
    kept = ingest(state, rows, who_of, sites)
    total_today = db.execute("SELECT COUNT(*) FROM queries WHERE timestamp > ?",
                             (datetime.now(TZ).replace(hour=0, minute=0, second=0, microsecond=0).timestamp(),)).fetchone()[0]
    db.close()

    state["last_ts"] = max([since] + [r[0] for r in rows[-1:]])
    prune(state, local_day(now))
    state["coverage"] = {"lookups_today": total_today, "kept_last_run": kept}
    summary = summarize(state, people, now)
    if args.dry_run:
        print(json.dumps(summary, indent=1))
        return 0
    publish(summary)
    STATE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, separators=(",", ":")))
    tmp.replace(STATE)
    log(f"ok: {len(rows)} lookups read, {kept} kept; {len(json.dumps(summary))} B published")
    return 0


if __name__ == "__main__":
    sys.exit(main())
