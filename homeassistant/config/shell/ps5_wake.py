"""Wake the basement PS5 from rest mode (shell_command.ps5_wake, packages/ps5.yaml).

Sony's discovery protocol (DDP) has a WAKEUP message next to the search that ps5_status.py sends.
The PS5 only obeys it with the credential from a Remote Play device link: docker-host was linked on
2026-10-22 (PS5: Settings > System > Remote Play > Link Device, registered with pyremoteplay), and
the credential is in CREDENTIAL, outside this public repo. Needs, on the PS5, "Stay connected to
the internet" and "Enable turning on PS5 from network" (Power Saving > Features available in rest
mode). Re-linking (e.g. after a factory reset) means a new credential in that file.

Sent to the same places ps5_status.py asks, since the PS5 on Wi-Fi often ignores broadcasts: the
last IP that answered, any Sony address in the ARP table, and the broadcast address. Fire and forget:
sensor.ps5_power shows whether it worked.
"""
import socket
import sys

PORT = 9302
CREDENTIAL = "/config/.ps5_credential"
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


try:
    with open(CREDENTIAL) as f:
        credential = f.read().strip()
except OSError:
    sys.exit(f"No PS5 wake credential at {CREDENTIAL}")

msg = (
    "WAKEUP * HTTP/1.1\n"
    f"user-credential:{credential}\n"
    "client-type:vr\nauth-type:R\nmodel:w\napp-type:r\n"
    "device-discovery-protocol-version:00030010\n"
).encode()

sent = 0
with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
    s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    for ip in targets():
        try:
            s.sendto(msg, (ip, PORT))
            sent += 1
        except OSError:
            pass
if not sent:
    sys.exit("Couldn't send the wake to any address")
