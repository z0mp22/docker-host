#!/usr/bin/env python3
"""Fail deploy when Home Assistant config is invalid or recovery mode is active."""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

import requests

HA_URL = os.environ.get("HA_URL", "http://127.0.0.1:8123")
SECRETS = Path("/docker/homeassistant/secrets.yaml")
RECORDER_DB = Path("/docker/homeassistant/home-assistant_v2.db")
MAX_WAIT_S = 180
# ThermoPro BLE thermometers advertise intermittently; allow a generous freshness window.
BT_TEMP_MAX_AGE_S = int(os.environ.get("BT_TEMP_MAX_AGE_S", "1800"))
REQUIRED_BT_TEMP_SENSORS = (
    "sensor.tp358s_f429_temperature",  # Basement Thermometer
    "sensor.tp358s_1c99_temperature",  # Master Bedroom Thermometer
)


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


def docker_exec_json(command: str) -> dict | list | None:
    result = subprocess.run(
        ["docker", "exec", "homeassistant", "python3", "-c", command],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        log(f"docker exec failed: {result.stderr.strip()}")
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return None


def check_config_via_docker() -> bool:
    for cmd in (
        ["docker", "exec", "homeassistant", "ha", "core", "check"],
        ["docker", "exec", "homeassistant", "python3", "-m", "homeassistant", "--script", "check_config", "-c", "/config"],
    ):
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if result.returncode == 0:
            log("OK config check via docker")
            return True
        log(f"docker config check attempt failed ({cmd[3]}): {result.stderr.strip() or result.stdout.strip()}")
    return False


def recovery_mode_via_docker() -> bool | None:
    payload = docker_exec_json(
        "import json; print(json.dumps(json.load(open('/config/.storage/core.config'))['data'].get('recovery_mode')))"
    )
    if payload is None:
        return None
    return bool(payload)


def get_token() -> str | None:
    token = os.environ.get("HA_TOKEN") or read_secret("ha_long_lived_access_token")
    if token:
        return token

    username = os.environ.get("HA_USERNAME") or read_secret("ha_username")
    password = os.environ.get("HA_PASSWORD") or read_secret("ha_password")
    if not username or not password:
        return None

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


def wait_for_api(headers: dict[str, str] | None) -> None:
    deadline = time.time() + MAX_WAIT_S
    while time.time() < deadline:
        try:
            kwargs = {"timeout": 5}
            if headers:
                kwargs["headers"] = headers
            resp = requests.get(f"{HA_URL}/api/", **kwargs)
            if resp.status_code in {200, 401}:
                return
        except requests.RequestException:
            pass
        time.sleep(5)
    raise RuntimeError(f"home assistant API not reachable at {HA_URL} within {MAX_WAIT_S}s")


def validate_via_api(headers: dict[str, str]) -> int:
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
    return validate_entities(items)


def validate_entities(items: list[dict]) -> int:
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
        "automation.front_yard_lights_off_at_21_00",
        *REQUIRED_BT_TEMP_SENSORS,
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
        log(f"FAIL degraded entities: {', '.join(bad)}")
        return 1
    log("OK required dashboard entities present")
    return validate_bluetooth_temp_sensors()


def latest_recorder_state(entity_id: str) -> tuple[str, float] | None:
    """Return (state, last_updated_ts) from the HA recorder DB, if present."""
    if not RECORDER_DB.exists():
        return None
    import sqlite3

    con = sqlite3.connect(f"file:{RECORDER_DB}?mode=ro", uri=True)
    try:
        row = con.execute(
            "SELECT states.state, states.last_updated_ts "
            "FROM states "
            "JOIN states_meta ON states.metadata_id = states_meta.metadata_id "
            "WHERE states_meta.entity_id = ? "
            "ORDER BY states.last_updated_ts DESC LIMIT 1",
            (entity_id,),
        ).fetchone()
    finally:
        con.close()
    if not row:
        return None
    state, ts = row
    return str(state), float(ts or 0)


def validate_bluetooth_temp_sensors() -> int:
    """Hard gate: ThermoPro BLE temperature sensors must be present and fresh."""
    now = time.time()
    failures: list[str] = []
    for entity_id in REQUIRED_BT_TEMP_SENSORS:
        latest = latest_recorder_state(entity_id)
        if latest is None:
            failures.append(f"{entity_id} (no recorder history)")
            continue
        state, ts = latest
        age = now - ts if ts else float("inf")
        if state in {"unavailable", "unknown", ""}:
            failures.append(f"{entity_id} state={state}")
            continue
        if age > BT_TEMP_MAX_AGE_S:
            failures.append(f"{entity_id} stale ({int(age)}s old, state={state})")
            continue
        log(f"OK bluetooth temp {entity_id}={state} ({int(age)}s old)")
    if failures:
        log("FAIL bluetooth temperature sensors: " + "; ".join(failures))
        return 1
    log("OK bluetooth temperature sensors reading")
    return 0


def validate_via_docker() -> int:
    if not check_config_via_docker():
        return 1
    recovery = recovery_mode_via_docker()
    if recovery is None:
        log("WARN could not read recovery_mode from container storage")
    elif recovery:
        log("FAIL homeassistant is in recovery mode")
        return 1
    else:
        log("OK recovery_mode=false (docker storage)")

    token = get_token()
    if token:
        return validate_via_api({"Authorization": f"Bearer {token}"})

    log("WARN skipping API entity checks (no HA API credentials on host)")
    # Still enforce bluetooth temp gate via recorder — credentials are optional for this.
    return validate_bluetooth_temp_sensors()


def main() -> int:
    if not subprocess.run(["docker", "ps", "--format", "{{.Names}}"], capture_output=True, text=True).stdout.splitlines():
        log("FAIL docker not available")
        return 1
    if "homeassistant" not in subprocess.run(
        ["docker", "ps", "--format", "{{.Names}}"], capture_output=True, text=True
    ).stdout:
        log("FAIL homeassistant container not running")
        return 1

    token = get_token()
    if token:
        log("validating via Home Assistant API")
        return validate_via_api({"Authorization": f"Bearer {token}"})

    log("validating via docker (no API credentials configured on host)")
    return validate_via_docker()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        log(f"FAIL {exc}")
        raise SystemExit(1) from exc
