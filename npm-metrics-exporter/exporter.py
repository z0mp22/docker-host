#!/usr/bin/env python3
"""Prometheus exporter for Nginx Proxy Manager config and access logs."""

from __future__ import annotations

import json
import os
import re
import sqlite3
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, generate_latest

DB_PATH = os.environ.get("DB_PATH", "/data/database.sqlite")
LOG_DIR = os.environ.get("LOG_DIR", "/data/logs")
LISTEN_ADDR = os.environ.get("LISTEN_ADDR", "0.0.0.0")
LISTEN_PORT = int(os.environ.get("LISTEN_PORT", "9114"))

ACCESS_RE = re.compile(
    r"\] - (?P<status>\d{3}) \d{3} - (?P<method>\S+) (?P<scheme>\S+) (?P<domain>\S+)"
)

proxy_hosts_total = Gauge(
    "npm_proxy_hosts_total",
    "Total proxy hosts configured in NPM",
)
proxy_hosts_enabled = Gauge(
    "npm_proxy_hosts_enabled",
    "Enabled proxy hosts in NPM",
)
proxy_host_info = Gauge(
    "npm_proxy_host_info",
    "NPM proxy host configuration",
    ["host_id", "domain", "forward_host", "forward_port", "enabled", "ssl_forced"],
)
certificate_expiry_timestamp = Gauge(
    "npm_certificate_expiry_timestamp_seconds",
    "Certificate expiry as Unix timestamp from NPM database",
    ["cert_id", "domain", "provider"],
)
certificate_expired = Gauge(
    "npm_certificate_expired",
    "Whether the NPM certificate is past expiry (1=expired)",
    ["cert_id", "domain"],
)
certificates_total = Gauge(
    "npm_certificates_total",
    "Total certificates in NPM",
)
http_requests_total = Counter(
    "npm_http_requests_total",
    "HTTP requests seen in NPM per-host access logs",
    ["host_id", "domain", "status", "method", "scheme"],
)
exporter_scrape_success = Gauge(
    "npm_metrics_exporter_scrape_success",
    "Whether the last NPM metrics scrape succeeded",
)
exporter_scrape_duration = Gauge(
    "npm_metrics_exporter_scrape_duration_seconds",
    "Duration of the last NPM metrics scrape",
)

_log_offsets: dict[str, int] = {}
_log_lock = threading.Lock()


def parse_domains(raw: str) -> str:
    try:
        domains = json.loads(raw)
        if isinstance(domains, list) and domains:
            return domains[0]
    except json.JSONDecodeError:
        pass
    return raw.strip("[]\" ")


def parse_expiry(raw: str | None) -> float | None:
    if not raw:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc).timestamp()
        except ValueError:
            continue
    return None


def collect_db_metrics() -> None:
    proxy_host_info.clear()
    certificate_expiry_timestamp.clear()
    certificate_expired.clear()

    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute(
        "SELECT id, domain_names, forward_host, forward_port, ssl_forced, enabled "
        "FROM proxy_host"
    )
    rows = cur.fetchall()
    enabled = 0
    for row in rows:
        domain = parse_domains(row["domain_names"])
        is_enabled = int(row["enabled"] or 0)
        enabled += is_enabled
        proxy_host_info.labels(
            host_id=str(row["id"]),
            domain=domain,
            forward_host=str(row["forward_host"]),
            forward_port=str(row["forward_port"]),
            enabled=str(is_enabled),
            ssl_forced=str(int(row["ssl_forced"] or 0)),
        ).set(1)

    proxy_hosts_total.set(len(rows))
    proxy_hosts_enabled.set(enabled)

    cur.execute("SELECT id, nice_name, provider, expires_on FROM certificate")
    certs = cur.fetchall()
    certificates_total.set(len(certs))
    now = time.time()
    for cert in certs:
        domain = cert["nice_name"] or f"cert-{cert['id']}"
        provider = cert["provider"] or "unknown"
        expiry = parse_expiry(cert["expires_on"])
        labels = dict(cert_id=str(cert["id"]), domain=domain, provider=provider)
        if expiry is not None:
            certificate_expiry_timestamp.labels(**labels).set(expiry)
            certificate_expired.labels(cert_id=str(cert["id"]), domain=domain).set(
                1 if expiry < now else 0
            )
        else:
            certificate_expired.labels(cert_id=str(cert["id"]), domain=domain).set(0)

    conn.close()


def collect_log_metrics() -> None:
    log_dir = Path(LOG_DIR)
    if not log_dir.is_dir():
        return

    with _log_lock:
        for path in sorted(log_dir.glob("proxy-host-*_access.log")):
            host_id = path.stem.replace("proxy-host-", "").replace("_access", "")
            offset = _log_offsets.get(str(path), 0)
            try:
                size = path.stat().st_size
                if size < offset:
                    offset = 0
                with path.open("r", encoding="utf-8", errors="replace") as handle:
                    handle.seek(offset)
                    for line in handle:
                        match = ACCESS_RE.search(line)
                        if not match:
                            continue
                        http_requests_total.labels(
                            host_id=host_id,
                            domain=match.group("domain"),
                            status=match.group("status"),
                            method=match.group("method"),
                            scheme=match.group("scheme"),
                        ).inc()
                    _log_offsets[str(path)] = handle.tell()
            except OSError:
                continue


def collect_metrics() -> None:
    start = time.perf_counter()
    try:
        collect_db_metrics()
        collect_log_metrics()
        exporter_scrape_success.set(1)
    except Exception:
        exporter_scrape_success.set(0)
        raise
    finally:
        exporter_scrape_duration.set(time.perf_counter() - start)


class MetricsHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path not in ("/", "/metrics"):
            self.send_error(404)
            return
        collect_metrics()
        payload = generate_latest()
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPE_LATEST)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, _format: str, *_args: object) -> None:
        return


def main() -> None:
    server = HTTPServer((LISTEN_ADDR, LISTEN_PORT), MetricsHandler)
    server.serve_forever()


if __name__ == "__main__":
    main()
