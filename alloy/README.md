# Alloy: NPM access logs → Loki

Tails Nginx Proxy Manager's per-host access logs (`/docker/npm/data/logs/proxy-host-*_access.log`,
read-only), classifies every request, and ships it to Loki on minipc (`10.0.0.6:3100`). Feeds the
Grafana **Internet Exposure** dashboard (`npm-exposure`), its phone alerts, and the HA Network
panel's exposure card.

## What each line gets

| Label | Values |
|---|---|
| `site` | first label of the hostname (`opensprinkler`, `frigate`, …) |
| `category` | `ssrf`, `vite_fileread`, `traversal`, `secrets`, `wordpress`, `php`, `backup_dump`, `admin_panel`, `iot_exploit` (the **exploit** set), plus `recon`, `app` (the site's real paths), `other` |
| `outcome` | `ok` (real content), `default_page` (Frigate's login shell / OpenSprinkler's `/`, served for any path), `upgraded`, `redirect`, `auth_required`, `blocked_proxy` (NPM answered itself, e.g. block-exploits or an access list), `forbidden`, `not_found`, `rejected` (400/405/413), `error` |
| `actor` | `authenticated` (owner's OpenSprinkler password, or a Frigate session), `unrecognized` (an OpenSprinkler password that isn't the owner's), `attacker` (exploit category), `crawler` (known scanner/bot UA), `anonymous` |
| `os_auth` | `owner`, `other`, `none`, `unchecked` (no fingerprint configured) |
| `country` | ISO code from db-ip; `LAN`; `unknown` (no match, or a Cloudflare edge from before the real-IP fix) |
| `status`, `job=npm`, `backfill` (history import only) | |

Structured metadata: `uri` (redacted), `client_ip`, `ua`, `client_family` (e.g. `Android · WebView`,
no versions), `method`, `length`, `upstream`, `asn_org`.

"Got through" = exploit category **and** `outcome="ok"`. The classifier is tuned so that this is
empty for everything seen so far (Frigate's login shell and OpenSprinkler's `/` are `default_page`).

## Secrets

OpenSprinkler clients send `md5(password)` as `?pw=`. Alloy compares `sha256(pw + "npm-exposure")`
with `OS_PW_SHA256` from `.env` to set `os_auth`, then redacts `pw`, `npw`, `cpw`, `token`,
`password`, … from the stored line and the `uri` field. Set or rotate the fingerprint with:

```bash
/docker/alloy/scripts/set-owner-pw.sh              # prompts for the OpenSprinkler password
/docker/alloy/scripts/set-owner-pw.sh --from-logs  # or: the hash the app has been sending
```

## Changing the rules

Edit `config.alloy`, add a case to `tests/cases.py`, then on the Pi:

```bash
bash alloy/tests/run.sh   # throwaway Loki + Alloy containers; asserts every case and no leaks
```

## History import

```bash
/docker/alloy/scripts/backfill.sh          # stage rotated logs; Alloy ingests them in seconds
/docker/alloy/scripts/backfill.sh --clean  # afterwards
```

## GeoIP

`scripts/update-geoip.sh` downloads db-ip's free country and ASN "lite" databases into
`/docker/alloy/geo/` (deploy does it on first run, `cron/alloy-geoip` refreshes monthly).
IP geolocation by [DB-IP](https://db-ip.com), licensed CC BY 4.0.

## Real client IPs

Requires `npm/nginx/custom/server_proxy.conf` (`real_ip_header CF-Connecting-IP`). Without it,
every public request shows a Cloudflare edge address.
