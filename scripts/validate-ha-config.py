#!/usr/bin/env python3
"""Fail deploy when Home Assistant config is invalid or recovery mode is active."""
from __future__ import annotations

import re
import sys
import time
from pathlib import Path

import requests

HA_URL = "http://127.0.0.1:8123"
SECRETS = Path("/docker/homeassistant/secrets.yaml")
MAX_WAIT_S = 180


def log(message: str) -> None:
    print(f"[validate-ha] {message}")


def read_secret(key: str) -> str | None:
    if not SECRETS.exists():
        return None
    pattern = re.compile(rf"^{re.escape(key)}:\s*(.+?)\s*$")
    for line in SECRETS.read_text().splitlines():
        match = pattern.match(line.strip())
        if match:
            value = match.group(1).strip().strip("'\"")
            if value and not value.startswith("your_"):
                return value
    return None


def get_token() -> str:
    import os

    token = os.environ.get("HA_TOKEN") or read_secret("ha_long_lived_access_token")
    if token:
        return token
    username = os.environ.get("HA_USERNAME") or read_secret("ha_username")
    password = os.environ.get("HA_PASSWORD") or read_secret("ha_password")
    if not username or not password:
        raise RuntimeError(
            "missing ha credentials in /docker/homeassistant/secrets.yaml "
            "(ha_long_lived_access_token or ha_username/ha_password)"
        )
    client = f"{HA_URL}/"
    session = requests.Session()
    flow = session.post(
        f"{HA_URL}/auth/login_flow",
        json={"client_id": client, "handler": ["homeassistant", None], "redirect_uri": client},
        timeout=15,
    )
    flow.raise_for_status()
    flow_id = flow.json()["flow_id"]
    login = session.post(
        f"{HA_URL}/auth/login_flow/{flow_id}",
        json={"client_id": client, "username": username, "password": password},
        timeout=15,
    )
    login.raise_for_status()
    code = login.json()["result"]
    token_resp = requests.post(
        f"{HA_URL}/auth/token",
        data={"grant_type": "authorization_code", "code": code, "client_id": client},
        timeout=15,
    )
    token_resp.raise_for_status()
    return token_resp.json()["access_token"]


def wait_for_api(headers: dict[str, str]) -> None:
    deadline = time.time() + MAX_WAIT_S
    while time.time() < deadline:
        try:
            resp = requests.get(f"{HA_URL}/api/", headers=headers, timeout=5)
            if resp.status_code in {200, 401}:
                return
        except requests.RequestException:
            pass
        time.sleep(5)
    raise RuntimeError(f"home assistant API not reachable at {HA_URL} within {MAX_WAIT_S}s")


def main() -> int:
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    log("waiting for homeassistant API")
    wait_for_api(headers)

    check = requests.post(f"{HA_URL}/api/config/core/check_config", headers=headers, timeout=60)
    check.raise_for_status()
    body = check.json()
    if body.get("result") != "valid":
        log(f"FAIL config check: {body.get('errors')}")
        return 1
    log("OK config check: valid")

    config = requests.get(f"{HA_URL}/api/config", headers=headers, timeout=15)
    config.raise_for_status()
    cfg = config.json()
    if cfg.get("recovery_mode"):
        log("FAIL homeassistant is in recovery mode")
        return 1
    log(f"OK recovery_mode=false (version {cfg.get('version')})")

    states = requests.get(f"{HA_URL}/api/states", headers=headers, timeout=30)
    states.raise_for_status()
    items = states.json()
    available = [item for item in items if item.get("state") not in {"unavailable", "unknown"}]
    if len(available) < 50:
        log(
            f"FAIL only {len(available)} entities are available "
            f"(total {len(items)}); integrations likely did not load"
        )
        return 1
    log(f"OK {len(available)}/{len(items)} entities available")

    required = [
        "weather.home",
        "sensor.irrigation_next_run",
        "sensor.living_room_now_playing",
        "sensor.plex_recordings_status",
        "automation.front_yard_lights_off_at_23_00",
    ]
    by_id = {item["entity_id"]: item for item in items}
    missing = [entity_id for entity_id in required if entity_id not in by_id]
    bad = [
        entity_id
        for entity_id in required
        if entity_id in by_id and by_id[entity_id]["state"] in {"unavailable", "unknown"}
    ]
    if missing:
        log(f"FAIL missing entities: {', '.join(missing)}")
        return 1
    if bad:
        log(f"WARN degraded entities: {', '.join(bad)}")
    else:
        log("OK required dashboard entities present")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        log(f"FAIL {exc}")
        raise SystemExit(1) from exc
