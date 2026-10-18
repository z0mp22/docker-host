# ADR 0009: Cloudflare edge: filter at Cloudflare, show what it stopped, one-tap travel and lockdown

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Cody
- **Tags:** security, cloudflare, network-panel

## Context

Four hosts are public through Cloudflare → NPM (frigate, ha, media, opensprinkler). The UDM only
accepts 80/443 from Cloudflare's ranges, but nothing checked *who* was asking, so every scanner
reached each app's login page. On 2026-10-17 the "Exploit got through" alert fired (it turned out
to be Cody's own browser loading HA's ONVIF icon; the classifier fix is separate). Cloudflare
Access, a VPN and NPM access lists were all rejected as too much friction. The zone is on the
Free plan.

## Decision

- **Filter at Cloudflare with custom WAF rules nobody has to log into:** the existing
  "Block non-US traffic"; "Challenge hosting networks" (managed challenge for cloud/VPS ASNs,
  exempting `/.well-known/acme-challenge/` because Let's Encrypt validates from AWS); "Block junk
  paths" (dotfiles, `.php`, `/wp-`, `/cgi-bin`, ...). Before shipping they were replayed against
  30 days of NPM logs: 822 of 826 attack lines caught, none of Cody's traffic. Bot Fight Mode is
  off on purpose: on Free it can't be bypassed and it challenges the HA app and Plex.
- **Lockdown is an ASN allowlist, not an IP one:** Fort Collins Connexion (AS397142) and T-Mobile
  (AS21928), the only networks Cody signed in from in 30 days. An IP allowlist would cut off the
  phone on cellular and break when the home IP changes, and the phone is also how you'd unlock.
- **The panel shows only exact counts.** Each Cloudflare security event is one stopped request;
  NPM's lines in Loki are what reached the house. Cloudflare's per-host request analytics are
  sampled on Free (they disagreed with the events by ~190 in 24 h), so they're not shown.
- **Rules are found by description**, in HA's scripts, the collector and the panel, so a rule
  recreated in the dashboard keeps working. Cloudflare's rule PATCH replaces the whole rule, so
  HA sends the current description/action/expression back with the new `enabled`.
- **State is Cloudflare's.** Switches read `sensor.cloudflare_edge_rules` (refreshed after every
  change); a tap stays "Updating…" until Cloudflare shows the new state. Travel mode adds only
  an end time (`input_boolean` + `input_datetime`) so it can turn US-only back on by itself.
- **One token, one copy on the Pi:** `cloudflare_api_auth` in HA's `secrets.yaml`, also read by
  `scripts/cloudflare-edge.py` (cron, 5 min → retained MQTT `home/cloudflare/edge`).

## Consequences

- A commercial VPN (PIA exits via M247/Leaseweb) fails the hosting challenge in the HA app.
- Lockdown blocks everyone else too: Plex friends, other carriers, Tiffany's phone off Wi-Fi.
- Free keeps about 7 days of events; the summary covers 24 h and there's no long history yet.
- Rolling the token means updating `secrets.yaml` on docker-host (and `~/.config/cloudflare`
  on the workstation).
