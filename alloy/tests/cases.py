#!/usr/bin/env python3
"""Fixture log lines and the labels config.alloy must give each one.

Lines are real NPM traffic shapes from 2026-09 (scanner probes, the Sep 11 SSRF burst, owner app
traffic), with secrets replaced by the test values below. Each case gets a unique timestamp so
run.sh can match Loki's output back to its expectation.
"""

import hashlib
import json
import os
import sys
from datetime import datetime, timedelta, timezone

OWNER_PW = "0123456789abcdef0123456789abcdef"  # stands in for the real md5 hash
OTHER_PW = "fedcba9876543210fedcba9876543210"
SALT = "npm-exposure"

CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
OS_APP = "Mozilla/5.0 (Linux; Android 13; SM-G981U1 Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/151.0.7922.200 Mobile Safari/537.36"
ANDROID = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36"
MAC_FF = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:156.0) Gecko/20100101 Firefox/156.0"
LINUX_FF = "Mozilla/5.0 (X11; Linux x86_64; rv:155.0) Gecko/20100101 Firefox/155.0"
GROK = "Mozilla/5.0 (compatible; GrokBot/1.0; +https://x.ai)"
CENSYS = "Mozilla/5.0 (compatible; CensysInspect/1.1; +https://about.censys.io/)"
XPANSE = "Hello from Palo Alto Networks, find out more about our scans in https://docs-cortex.paloaltonetworks.com/r/1/Cortex-Xpanse/Scanning-activity"
SECRES = "Mozilla/5.0 (compatible; SecurityResearch/1.0)"
CF = "172.71.118.247"  # a Cloudflare edge, as every pre-fix log line shows

OS, FR, HA, PLEX = "opensprinkler", "frigate", "ha", "media"

# (site, method, scheme, uri, upstream, status, length, client, ua, expected labels/metadata)
CASES = [
    # --- attacks ---
    (OS, "GET", "https", "/fetch?path=http%3A%2F%2F169.254.169.254%2Flatest%2Fmeta-data%2Fiam%2Fsecurity-credentials%2F", "404", "404", 33, CF, CHROME,
     dict(category="ssrf", outcome="not_found", actor="attacker", country="unknown")),
    (OS, "GET", "https", "/out?url=http%3A%2F%2F169.254.169.254%2Flatest%2Fmeta-data%2F", "404", "404", 33, CF, GROK,
     dict(category="ssrf", outcome="not_found", actor="attacker")),
    (OS, "GET", "https", "/read?url=file:///root/.azure/credentials", "404", "404", 33, CF, CHROME,
     dict(category="ssrf", actor="attacker")),
    (FR, "GET", "https", "/index.php/apps/app_api/proxy/flow/api/w/_/jobs_u/get_log_file/..%25252F..%25252Fetc%25252Fpasswd", "200", "200", 2643, CF, CHROME,
     dict(category="traversal", outcome="default_page", actor="attacker")),
    (FR, "GET", "https", "/api/../../etc/passwd", "200", "200", 5000, CF, CHROME,
     dict(category="traversal", outcome="ok", actor="attacker")),  # the "got through" shape
    (OS, "GET", "http", "/@fs/etc/passwd?raw??", "-", "301", 166, CF, CHROME,
     dict(category="vite_fileread", outcome="redirect", actor="attacker")),
    (FR, "GET", "https", "/__vite_rsc_findSourceMapURL?filename=file:///proc/self/environ&environmentName=rsc", "-", "403", 111, CF, GROK,
     dict(category="vite_fileread", outcome="blocked_proxy", actor="attacker")),
    (FR, "GET", "https", "/.env", "200", "200", 2643, CF, CHROME,
     dict(category="secrets", outcome="default_page", actor="attacker")),
    (OS, "GET", "https", "/.git/config", "404", "404", 33, CF, CHROME,
     dict(category="secrets", outcome="not_found")),
    (OS, "GET", "https", "/@fs/home/debian/.aws/credentials", "413", "413", 25, CF, CHROME,
     dict(category="vite_fileread", outcome="rejected")),
    (OS, "POST", "https", "/wp/wp-json/batch/v1", "413", "413", 25, CF, "WordPress/6.4.3",
     dict(category="wordpress", outcome="rejected", actor="attacker")),
    (FR, "POST", "https", "/wordpress", "405", "405", 157, CF, CHROME,
     dict(category="wordpress", outcome="rejected")),
    (OS, "GET", "https", "/?phpinfo=1", "200", "200", 200, CF, CHROME,
     dict(category="php", outcome="default_page", actor="attacker")),
    (FR, "GET", "https", "/livewire/update", "200", "200", 2643, CF, "Mozilla/5.0",
     dict(category="php", outcome="default_page")),
    (OS, "GET", "https", "/db.sql", "404", "404", 33, CF, "-",
     dict(category="backup_dump", outcome="not_found", client_family="Other · No UA")),
    (FR, "GET", "https", "/admin", "200", "200", 2643, CF, CHROME,
     dict(category="admin_panel", outcome="default_page", actor="attacker")),
    (OS, "GET", "https", "/cgi-bin/luci/;stok=/locale", "404", "404", 33, CF, CHROME,
     dict(category="iot_exploit", actor="attacker")),
    # --- recon, crawlers, odds and ends ---
    (FR, "GET", "https", "/robots.txt", "200", "200", 2643, CF, CHROME,
     dict(category="recon", outcome="default_page", actor="anonymous")),
    (FR, "GET", "https", "/api-docs", "200", "200", 2703, CF, "python-httpx/0.28.1",
     dict(category="recon", client_family="Other · Script")),
    (OS, "GET", "https", "/", "200", "200", 200, CF, CENSYS,
     dict(category="app", outcome="default_page", actor="crawler")),
    (OS, "GET", "http", "/", "-", "301", 166, CF, XPANSE,
     dict(category="app", outcome="redirect", actor="crawler")),
    (FR, "GET", "https", "/api/config", "401", "401", 13, CF, SECRES,
     dict(category="app", outcome="auth_required", actor="crawler")),
    (OS, "GET", "https", "/foo", "404", "404", 33, CF, CHROME,
     dict(category="other", outcome="not_found", actor="anonymous")),
    (OS, "POST", "https", "/", "200", "200", 200, CF, CHROME,
     dict(category="app", outcome="default_page", actor="anonymous")),
    # --- owner / authenticated traffic ---
    (OS, "GET", "https", f"/ja?pw={OWNER_PW}&_=1790987770709", "200", "200", 2201, CF, OS_APP,
     dict(category="app", outcome="ok", actor="authenticated", os_auth="owner", client_family="Android · WebView")),
    (OS, "GET", "https", f"/cm?pw={OWNER_PW}&sid=3&en=1&t=600&_=1", "200", "200", 22, CF, OS_APP,
     dict(category="app", outcome="ok", actor="authenticated", os_auth="owner")),
    (OS, "GET", "https", f"/jp?pw={OWNER_PW}&_=1790987747592", "413", "413", 25, CF, LINUX_FF,
     dict(category="app", outcome="rejected", actor="authenticated", os_auth="owner", client_family="Linux · Firefox")),
    (OS, "GET", "https", f"/sp?pw={OTHER_PW}&npw={OTHER_PW}&cpw={OTHER_PW}&_=1", "200", "200", 22, CF, LINUX_FF,
     dict(category="app", outcome="ok", actor="unrecognized", os_auth="other")),
    (OS, "GET", "https", "/sp?pw=hunter2plaintext&npw=hunter2plaintext&cpw=hunter2plaintext&_=2", "200", "200", 22, CF, LINUX_FF,
     dict(actor="unrecognized", os_auth="other")),
    (FR, "POST", "https", "/api/login", "200", "200", 2, CF, ANDROID,
     dict(category="app", outcome="ok", actor="authenticated", os_auth="none", client_family="Android · Chrome")),
    (FR, "POST", "https", "/api/login", "401", "401", 46, CF, CHROME,
     dict(category="app", outcome="auth_required", actor="anonymous")),
    (FR, "GET", "https", "/api/auth/first_time_login", "200", "200", 32, CF, CHROME,
     dict(category="app", outcome="ok", actor="anonymous")),
    (FR, "GET", "https", "/live/webrtc/api/ws?src=Driveway", "101", "101", 0, CF, ANDROID,
     dict(category="app", outcome="upgraded", actor="authenticated")),
    (FR, "GET", "https", "/api/Basement/latest.webp?height=277", "200", "200", 18000, CF, MAC_FF,
     dict(category="app", outcome="ok", actor="authenticated", client_family="Mac · Firefox")),
    (FR, "GET", "https", "/assets/extends-CF3RwP-h.js", "200", "200", 232, CF, CHROME,
     dict(category="app", outcome="ok", actor="anonymous")),
    (FR, "GET", "https", "/ws", "502", "502", 150, CF, LINUX_FF,
     dict(category="app", outcome="error")),
    (FR, "GET", "https", "/api/events?token=abc123secret&limit=5", "200", "200", 900, CF, ANDROID,
     dict(category="app", outcome="ok", actor="authenticated", uri="/api/events?token=REDACTED&limit=5")),
    # --- Home Assistant and Plex (media) ---
    (HA, "POST", "https", "/api/webhook/abcd1234secretwebhookid", "200", "200", 2, CF, OS_APP,
     dict(category="app", outcome="ok", actor="anonymous", uri="/api/webhook/REDACTED")),
    (HA, "GET", "https", "/api/hls/hlssecrettoken99/master_playlist.m3u8", "200", "200", 300, CF, ANDROID,
     dict(category="app", outcome="ok", actor="authenticated", uri="/api/hls/REDACTED/master_playlist.m3u8")),
    (HA, "GET", "https", "/api/camera_proxy/camera.garage?token=camsecret42", "200", "200", 40000, CF, ANDROID,
     dict(category="app", outcome="ok", actor="authenticated", uri="/api/camera_proxy/camera.garage?token=REDACTED")),
    (HA, "POST", "https", "/auth/token", "200", "200", 400, CF, OS_APP,
     dict(category="app", outcome="ok", actor="authenticated")),
    (HA, "POST", "https", "/auth/token", "400", "400", 60, CF, CHROME,
     dict(category="app", outcome="rejected", actor="anonymous")),
    (HA, "GET", "https", "/api/websocket", "101", "101", 0, CF, ANDROID,
     dict(category="app", outcome="upgraded", actor="anonymous")),
    (HA, "POST", "https", "/", "405", "405", 0, CF, CHROME,
     dict(category="app", outcome="rejected", actor="anonymous")),
    (HA, "GET", "https", "/lovelace-life", "200", "200", 5000, CF, LINUX_FF,
     dict(category="app", outcome="ok", actor="anonymous")),
    (PLEX, "GET", "https", "/", "401", "401", 157, CF, CHROME,
     dict(category="app", outcome="auth_required", actor="anonymous")),
    (PLEX, "GET", "https", "/library/sections?X-Plex-Token=plexsecret123&x=1", "200", "200", 3000, CF, ANDROID,
     dict(category="app", outcome="ok", actor="authenticated", uri="/library/sections?X-Plex-Token=REDACTED&x=1")),
    (PLEX, "POST", "https", "/wordpress/", "403", "403", 100, CF, CHROME,
     dict(category="wordpress", outcome="forbidden", actor="attacker")),
    # --- false positives found against the real September logs ---
    (FR, "GET", "https", "/API/.env", "200", "200", 2643, CF, CHROME,
     dict(category="secrets", outcome="default_page", actor="attacker")),
    (FR, "GET", "https", "/live/.env", "200", "200", 2643, CF, CHROME,
     dict(category="secrets", outcome="default_page")),
    (FR, "GET", "https", "/assets/shell-osqRiq1b.js", "200", "200", 900, CF, ANDROID,
     dict(category="app", outcome="ok")),
    (HA, "GET", "https", "/api/brands/integration/shelly/icon.png?token=brandtok", "200", "200", 5000, CF, ANDROID,
     dict(category="app", outcome="ok", actor="authenticated")),
    (HA, "GET", "https", "/auth/authorize?response_type=code&redirect_uri=https%3A%2F%2Fha.tacoman.us%2F%3Fauth_callback%3D1&client_id=https%3A%2F%2Fha.tacoman.us%2F", "200", "200", 900, CF, ANDROID,
     dict(category="app", outcome="ok")),
    (FR, "GET", "https", "/assets/../../etc/passwd", "200", "200", 2643, CF, CHROME,
     dict(category="traversal")),
    (OS, "GET", "https", "/key.json", "404", "404", 33, CF, CHROME, dict(category="secrets")),
    (FR, "GET", "https", "/_environment", "200", "200", 2643, CF, CHROME, dict(category="secrets", outcome="default_page")),
    (OS, "GET", "https", "/aws.env", "404", "404", 33, CF, CHROME, dict(category="secrets")),
    (PLEX, "GET", "https", "/api/graphql", "404", "404", 33, CF, CHROME, dict(category="recon")),
    (HA, "GET", "https", "/lovelace-recordings/recordings", "200", "200", 5000, CF, ANDROID, dict(category="app")),
    (HA, "GET", "https", "/unknown/node_modules/@webcomponents/scoped-custom-element-registry/src/x.ts", "404", "404", 33, CF, ANDROID, dict(category="app")),
    # --- geo, once real client IPs are logged ---
    (FR, "GET", "https", "/.env", "200", "200", 2643, "8.8.8.8", CHROME,
     dict(country="US", asn_org_contains="google")),
    (FR, "GET", "https", "/.env", "200", "200", 2643, "1.1.1.1", CHROME,
     dict(country="unknown", asn_org=None)),
    (FR, "GET", "https", "/", "200", "200", 2643, "10.0.0.50", CHROME,
     dict(country="LAN")),
    (FR, "GET", "https", "/.env", "200", "200", 2643, "81.2.69.142", CHROME,
     dict(country="GB")),
]

# Recent timestamps: Loki serves unflushed (in-memory) data only for recent query ranges.
START = datetime.fromtimestamp(int(os.environ.get("FIXTURE_START", "1789905600")), timezone.utc)


def lines():
    for i, (site, method, scheme, uri, up, status, length, client, ua, _exp) in enumerate(CASES):
        t = (START + timedelta(seconds=i)).strftime("%d/%b/%Y:%H:%M:%S +0000")
        yield i, (f'[{t}] - {up} {status} - {method} {scheme} {site}.tacoman.us "{uri}" '
                  f'[Client {client}] [Length {length}] [Gzip -] [Sent-to 10.0.0.1] "{ua}" "-"')


def owner_digest():
    # Alloy's Sha2Hash(input, salt) is sha256(input + salt).
    return hashlib.sha256((OWNER_PW + SALT).encode()).hexdigest()


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "fixtures":
        # One file per site, like NPM's per-host logs.
        out = {}
        for i, line in lines():
            out.setdefault(CASES[i][0], []).append(line)
        for site, ls in out.items():
            with open(f"{sys.argv[2]}/proxy-host-{site}_access.log", "w") as f:
                f.write("\n".join(ls) + "\n")
    elif cmd == "digest":
        print(owner_digest())
    elif cmd == "expect":
        print(json.dumps({str(int((START + timedelta(seconds=i)).timestamp())): c[9]
                          for i, c in enumerate(CASES)}))
