#!/usr/bin/env python3
"""UDM syslog fixtures for config.alloy's loki.process "udm" (lines captured from the real UDM).

  udm_cases.py send HOST PORT   send every fixture line over UDP
  udm_cases.py check LOKI_ADDR  query {job="udm"} and check each line's labels; dropped lines must be absent
"""
import json
import socket
import sys
import time
import urllib.parse
import urllib.request

# (raw line, marker that identifies it in Loki, expected labels/metadata; None = must be dropped)
CASES = [
    ('<13>Oct 11 09:56:41 ZsDM ZsDM [LAN_WAN-A-10008] DESCR="LG laundry: log connections" IN=br0 OUT=eth4 '
     'MAC=68:d7:9a:33:40:62:f4:14:bf:2a:0f:3c:08:00 SRC=10.0.0.238 DST=44.245.77.98 LEN=44 TOS=00 PREC=0x00 '
     'TTL=254 ID=246 PROTO=TCP SPT=49156 DPT=8883 SEQ=12769 ACK=0 WINDOW=32120 SYN URGP=0 MARK=1a0000 ',
     "DST=44.245.77.98",
     {"kind": "firewall", "fw_chain": "LAN_WAN", "fw_action": "A", "fw_rule": "10008",
      "descr": "LG laundry: log connections", "src": "10.0.0.238", "dst": "44.245.77.98",
      "proto": "TCP", "dpt": "8883", "src_mac": "f4:14:bf:2a:0f:3c", "cef_name": None}),
    ('<13>Oct 11 10:02:11 ZsDM ZsDM [LAN_WAN-D-10003] DESCR="Cameras no internet" IN=br0 OUT=eth4 '
     'MAC=68:d7:9a:33:40:62:e8:ab:fa:52:10:ae:08:00 SRC=10.0.0.225 DST=3.3.3.3 LEN=76 TOS=00 PREC=0x00 '
     'TTL=63 ID=1 PROTO=UDP SPT=40000 DPT=32100 LEN=56 MARK=1a0000 ',
     "DST=3.3.3.3",
     {"kind": "firewall", "fw_action": "D", "fw_rule": "10003", "proto": "UDP", "dpt": "32100",
      "src_mac": "e8:ab:fa:52:10:ae"}),
    ('Oct 11 09:56:12 ZsDM CEF:0|Ubiquiti|UniFi Network|10.6.106|545|Config Created|5|UNIFIcategory=Audit '
     'UNIFIhost=ZsDM UNIFIsettingsChanges=action: ALLOW',
     "Config Created",
     {"kind": "event", "cef_category": "Audit", "cef_name": "Config Created", "fw_chain": None}),
    ('Oct 11 09:58:02 ZsDM CEF:0|Ubiquiti|UniFi Network|10.6.106|400|WiFi Client Connected|1|'
     'UNIFIcategory=Client UNIFIsubCategory=WiFi UNIFIclientMac=f0:57:a6:04:c3:24',
     "WiFi Client Connected",
     {"kind": "event", "cef_category": "Client", "cef_name": "WiFi Client Connected"}),
    ('<30>Oct 11 09:56:24 ZsDM ZsDM dnsmasq-dhcp[5454]: DHCPACK(br0) 10.0.0.252 f0:57:a6:04:c3:24 cody-ThinkPad',
     "DHCPACK(br0) 10.0.0.252",
     {"kind": "dhcp", "program": "dnsmasq-dhcp"}),
    ('<14>Oct 11 09:56:18 ZsDM ZsDM ubios-udapi-server[3596]: service:  *  [firewall/filter]: configuring',
     "[firewall/filter]: configuring",
     {"kind": "system", "program": "ubios-udapi-server"}),
    ('<4>Oct 11 09:56:23 ZsDM ZsDM kernel: ra0:[recv auth_req] TA:[e8:ab:fa:52:10:ae], RA:[68:d7:9a:33:40:62] '
     'machdr_seq=1591, auth algo=0, seq=1, status=0, rssi=-34', "recv auth_req", None),
    ('<14>Oct 11 09:56:23 ZsDM ZsDM hostapd[4770]: ra0: STA e8:ab:fa:52:10:ae IEEE 802.11: associated',
     "IEEE 802.11: associated", None),
    ('<30>Oct 11 09:56:24 ZsDM ZsDM stahtd[3576]: [info ] {"op":"event","message_type":"STA_ASSOC_TRACKER"}',
     "STA_ASSOC_TRACKER", None),
    ('<30>Oct 11 09:56:24 ZsDM ZsDM dnsmasq[5269]: inotify: flushed 27 names read from leases',
     "flushed 27 names", None),
]


def send(host: str, port: int) -> None:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    for line, _, _ in CASES:
        s.sendto(line.encode(), (host, port))
        time.sleep(0.05)


def check(loki: str) -> int:
    q = urllib.parse.urlencode({"query": '{job="udm"}', "since": "1h", "limit": "1000"})
    rows = []
    want = sum(1 for c in CASES if c[2] is not None)
    for _ in range(30):
        try:
            with urllib.request.urlopen(f"http://{loki}/loki/api/v1/query_range?{q}", timeout=10) as r:
                data = json.load(r)["data"]["result"]
            rows = [(s["stream"], v[1]) for s in data for v in s["values"]]
        except Exception:
            rows = []
        if len(rows) >= want:
            break
        time.sleep(2)
    fail = 0
    for _, marker, exp in CASES:
        hits = [(labels, line) for labels, line in rows if marker in line]
        if exp is None:
            if hits:
                print(f"UDM NOT DROPPED: {marker}"); fail += 1
            continue
        if not hits:
            print(f"UDM MISSING: {marker}"); fail += 1; continue
        labels, line = hits[0]
        if line.startswith(("<", "Oct")):
            print(f"UDM header not stripped: {line[:60]}"); fail += 1
        for k, v in exp.items():
            ok = not labels.get(k) if v is None else labels.get(k) == v
            if not ok:
                print(f"UDM FAIL {marker}: {k}={labels.get(k)!r}, want {v!r}"); fail += 1
    print(f"udm: {len(rows)} lines ingested, {len(CASES)} cases, {fail} failures")
    return fail


if __name__ == "__main__":
    if sys.argv[1] == "send":
        send(sys.argv[2], int(sys.argv[3]))
    else:
        sys.exit(1 if check(sys.argv[2]) else 0)
