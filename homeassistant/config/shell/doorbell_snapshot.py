"""Save one live frame of the Eufy doorbell to /config/doorbell/ring.jpg.

Eufy often has no new event picture for a press, so the doorbell alert grabs a frame from
eufy-bridge's go2rtc (loopback only) while the doorbell is still awake from the press.
"""
import json
import os
import sys
import urllib.parse
import urllib.request

API = "http://127.0.0.1:1984/api"
OUT = "/config/doorbell/ring.jpg"

streams = json.load(urllib.request.urlopen(f"{API}/streams", timeout=5))
# The bridge publishes one go2rtc stream per Eufy camera, named by serial; there is only the doorbell.
if len(streams) != 1:
    sys.exit(f"expected exactly 1 eufy-bridge stream, found {len(streams)}")
name = next(iter(streams))
data = urllib.request.urlopen(f"{API}/frame.jpeg?src={urllib.parse.quote(name)}", timeout=30).read()
if data[:2] != b"\xff\xd8":
    sys.exit("go2rtc did not return a JPEG")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT + ".tmp", "wb") as f:
    f.write(data)
os.replace(OUT + ".tmp", OUT)
print(len(data))
