#!/usr/bin/env python3
"""Summarize what Cloudflare stopped in front of the public hosts, for the Network panel.

Runs from cron/cloudflare-edge every 5 minutes. It reads Cloudflare's GraphQL analytics for the
tacoman.us zone (Free plan keeps about 7 days of raw security events) and publishes one retained JSON summary on home/cloudflare/edge. HA's
packages/cloudflare_edge.yaml turns it into sensor.cloudflare_edge, and the Network panel's
Internet exposure card draws the funnel: stopped at Cloudflare | reached NPM -> attack probes ->
got through (everything after Cloudflare comes from Loki, packages/internet_exposure.yaml).

Only exact counts: each security event is one stopped request. Cloudflare's per-host request
analytics are sampled estimates on Free, so they're left out rather than shown next to exact
numbers they wouldn't add up with.

The API token is the one HA uses for the edge controls: `cloudflare_api_auth: "Bearer <token>"`
in /docker/homeassistant/secrets.yaml (Zone Read, Zone WAF Edit, Analytics Read on tacoman.us).
One copy, so rolling the token is one edit on this host.

Events are counted per rule by the rule's *description*, which is how the panel and HA's scripts
find the rules too (rule ids change if a rule is recreated in the dashboard).
"""
from __future__ import annotations

import collections
import json
import os
import re
import subprocess
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

ZONE = os.environ.get("CF_EDGE_ZONE", "3c624b8f3df1a6358b501adf5c82b349")
SECRETS = os.environ.get("CF_EDGE_SECRETS", "/docker/homeassistant/secrets.yaml")
API = "https://api.cloudflare.com/client/v4"
TOPIC = "home/cloudflare/edge"
WINDOW_H = 24
PAGE = 10000
MAX_PAGES = 5
LATEST = 8
TOP = 5
# Event actions that mean the visitor did not get through (a passed challenge is "..._solved").
STOPPED = {"block", "managed_challenge", "challenge", "jschallenge", "connection_close", "drop"}
# Event sources that aren't one of our custom rules, named the way the panel shows them.
SOURCE_NAMES = {
    "firewallManaged": "Cloudflare managed rules",
    "securitylevel": "Cloudflare security level",
    "bic": "Browser integrity check",
    "hot": "Hotlink protection",
    "ratelimit": "Rate limiting",
    "botFight": "Bot fight mode",
    "l7ddos": "DDoS protection",
    "validation": "Invalid request",
}


def log(msg: str) -> None:
    print(f"[{datetime.now(timezone.utc):%Y-%m-%dT%H:%M:%SZ}] {msg}", flush=True)


def iso(t: datetime) -> str:
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


def token() -> str:
    with open(SECRETS) as f:
        for line in f:
            m = re.match(r"\s*cloudflare_api_auth:\s*['\"]?Bearer\s+([^'\"\s]+)", line)
            if m:
                return m.group(1)
    raise RuntimeError(f"no cloudflare_api_auth in {SECRETS}")


def call(tok: str, path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        API + path, data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def gql(tok: str, fields: str) -> dict:
    d = call(tok, "/graphql", {"query": '{viewer{zones(filter:{zoneTag:"%s"}){%s}}}' % (ZONE, fields)})
    if d.get("errors"):
        raise RuntimeError(f"graphql: {d['errors'][0].get('message')}")
    return d["data"]["viewer"]["zones"][0]


def rules(tok: str) -> list[dict]:
    d = call(tok, f"/zones/{ZONE}/rulesets/phases/http_request_firewall_custom/entrypoint")
    if not d.get("success"):
        raise RuntimeError(f"ruleset: {d.get('errors')}")
    return [{"id": r["id"], "description": r.get("description") or r["id"], "action": r["action"],
             "enabled": r.get("enabled", True)} for r in d["result"].get("rules", [])]


def events(tok: str, since: datetime, until: datetime) -> tuple[list[dict], bool]:
    """Raw security events, newest first, paging back by time. Returns (events, truncated)."""
    out: list[dict] = []
    before = until
    for _ in range(MAX_PAGES):
        page = gql(tok, 'firewallEventsAdaptive(limit:%d, filter:{datetime_geq:"%s", datetime_lt:"%s"}, '
                        'orderBy:[datetime_DESC]){datetime action source ruleId clientCountryName '
                        'clientAsn clientASNDescription clientRequestHTTPHost clientRequestPath}'
                   % (PAGE, iso(since), iso(before)))["firewallEventsAdaptive"]
        out += page
        if len(page) < PAGE:
            return out, False
        before = datetime.strptime(page[-1]["datetime"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    return out, True


def site(host: str) -> str:
    """frigate.tacoman.us -> frigate (the panel's SITE_NAMES keys); the bare zone -> apex."""
    return host.split(".")[0] if host.count(".") > 1 else "apex"


def summarize(rs: list[dict], evs: list[dict], truncated: bool, now: datetime) -> dict:
    by_id = {r["id"]: r["description"] for r in rs}
    label = lambda e: by_id.get(e["ruleId"]) or SOURCE_NAMES.get(e["source"], e["source"])
    stopped = [e for e in evs if e["action"] in STOPPED]
    by_rule = collections.Counter(label(e) for e in stopped)
    # Challenges someone then passed (a person in a browser, or a bot that solves them).
    solved = sum(1 for e in evs if "solved" in e["action"])
    per_host = collections.Counter(site(e["clientRequestHTTPHost"]) for e in stopped)
    countries = collections.Counter(e["clientCountryName"] for e in stopped)
    asns = collections.Counter(e["clientASNDescription"] or f"AS{e['clientAsn']}" for e in stopped)
    hourly = [0] * WINDOW_H
    t0 = now - timedelta(hours=WINDOW_H)
    for e in stopped:
        at = datetime.strptime(e["datetime"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        hourly[min(WINDOW_H - 1, int((at - t0).total_seconds() // 3600))] += 1
    return {
        "updated": iso(now),
        "window_h": WINDOW_H,
        "stopped": len(stopped),
        "truncated": truncated,
        "solved": solved,
        "by_rule": by_rule.most_common(),
        "hosts": dict(per_host),
        "countries": countries.most_common(TOP),
        "networks": asns.most_common(TOP),
        "hourly": hourly,
        "latest": [{"at": e["datetime"], "host": site(e["clientRequestHTTPHost"]), "path": e["clientRequestPath"][:80],
                    "country": e["clientCountryName"], "network": e["clientASNDescription"], "rule": label(e)}
                   for e in stopped[:LATEST]],
    }


def publish(payload: dict) -> None:
    subprocess.run(["docker", "exec", "-i", "mosquitto", "mosquitto_pub", "-h", "127.0.0.1", "-t", TOPIC, "-r", "-s"],
                   input=json.dumps(payload, separators=(",", ":")), text=True,
                   check=True, capture_output=True, timeout=20)


def main() -> int:
    tok = token()
    now = datetime.now(timezone.utc).replace(microsecond=0)
    since = now - timedelta(hours=WINDOW_H)
    rs = rules(tok)
    evs, truncated = events(tok, since, now)
    payload = summarize(rs, evs, truncated, now)
    if "--print" in sys.argv:
        print(json.dumps(payload, indent=1))
        return 0
    publish(payload)
    log(f"ok: {payload['stopped']} stopped in {WINDOW_H} h{' (truncated)' if truncated else ''}, "
        f"{len(json.dumps(payload))} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
