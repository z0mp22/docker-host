"""Print the PS5's power state as JSON for sensor.ps5_power (packages/ps5.yaml).

The PS5 answers Sony's device discovery protocol (DDP) on UDP 9302 without any pairing:
"200 Ok" while on, "620 Server Standby" in rest mode. No reply means it's fully off, unplugged, or
in rest mode with "Stay connected to the internet" turned off.

Where to ask: a broadcast alone isn't enough, because the PS5 on Wi-Fi often ignores broadcasts
while still answering a direct ask (2026-10-17: broadcast timed out, direct got "200 Ok"). So the
search also goes straight to the IP that last answered (cached in LAST_IP) and to any address in
the ARP table with Sony Interactive's MAC prefix, which covers a new DHCP address. Nothing that
identifies this console is in this (public) repo: the first reply with host-type PS5 wins, and
there is one PS5 in the house.
"""
import json
import socket
import time
from datetime import datetime, timezone

PORT = 9302
SEARCH = b"SRCH * HTTP/1.1\ndevice-discovery-protocol-version:00030010\n"
STATES = {"200": "on", "620": "standby"}
LAST_IP = "/config/.ps5_last_ip"
SONY_PREFIXES = ("b4:1f:4d:",)  # Sony Interactive Entertainment (PS5)


def targets():
    ips = ["255.255.255.255"]
    try:
        with open(LAST_IP) as f:
            ips.append(f.read().strip())
    except OSError:
        pass
    try:
        with open("/proc/net/arp") as f:
            for line in list(f)[1:]:
                cols = line.split()
                if len(cols) > 3 and cols[3].lower().startswith(SONY_PREFIXES):
                    ips.append(cols[0])
    except OSError:
        pass
    return list(dict.fromkeys(ip for ip in ips if ip))


def search(timeout):
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        s.bind(("", 0))
        for ip in targets():
            try:
                s.sendto(SEARCH, (ip, PORT))
            except OSError:
                pass
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
if result["ip"]:
    try:
        with open(LAST_IP, "w") as f:
            f.write(result["ip"])
    except OSError:
        pass
result["checked_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
print(json.dumps(result))
