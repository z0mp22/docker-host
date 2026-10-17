"""Print the PS5's power state as JSON for sensor.ps5_power (packages/ps5.yaml).

The PS5 answers Sony's device discovery protocol (DDP) on UDP 9302 without any pairing:
"200 Ok" while on, "620 Server Standby" in rest mode. No reply means it's fully off, unplugged, or
in rest mode with "Stay connected to the internet" turned off. The search is broadcast, so the
PS5 needs no fixed IP, and nothing identifying it lives in this (public) repo: the first reply
with host-type PS5 wins, and there is one PS5 in the house.
"""
import json
import socket
import time
from datetime import datetime, timezone

PORT = 9302
SEARCH = b"SRCH * HTTP/1.1\ndevice-discovery-protocol-version:00030010\n"
STATES = {"200": "on", "620": "standby"}


def search(timeout):
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        s.bind(("", 0))
        s.sendto(SEARCH, ("255.255.255.255", PORT))
        deadline = time.monotonic() + timeout
        while (left := deadline - time.monotonic()) > 0:
            s.settimeout(left)
            try:
                data, (ip, _) = s.recvfrom(2048)
            except socket.timeout:
                return None
            lines = data.decode("utf-8", "replace").splitlines()
            fields = dict(line.split(":", 1) for line in lines[1:] if ":" in line)
            if fields.get("host-type") != "PS5" or not lines[0].startswith("HTTP/1.1 "):
                continue
            code = lines[0].split()[1]
            return {"state": STATES.get(code, "unknown"), "host_name": fields.get("host-name"), "ip": ip}
    return None


# A UDP reply can get lost on Wi-Fi; one retry before calling it off.
result = search(1.5) or search(1.5) or {"state": "off", "host_name": None, "ip": None}
result["checked_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
print(json.dumps(result))
