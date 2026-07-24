# ADR 0001: Plex recordings observability via MQTT bridge + HA alerts

- **Status:** Accepted
- **Date:** 2026-07-24
- **Deciders:** Cody
- **Tags:** plex, homeassistant, mqtt
- **Related:** [plex_recordings ADRs](https://github.com/czampino/plex_recordings/tree/main/docs/decisions)

## Context

`media-laptop` runs GitOps DVR sync ([czampino/plex_recordings](https://github.com/czampino/plex_recordings)). A movie-library misconfiguration left playable recordings invisible for weeks while HA showed **on disk, awaiting Plex index**. Operators need an early, noisy signal when disk and Plex visibility diverge — without making HA scrape Plex directly.

## Decision

1. **MQTT contract** from media-laptop (retained `home/plex_recordings/status` plus plain-text state topics) includes:
   - `recent_recordings[]` with `in_plex` / `path`
   - `health` (`ok`, `library_type`, `issues`, `awaiting_index`)
   - `awaiting_index_count`, `library_healthy`
2. **Bridge on this host:** `scripts/plex-mqtt-bridge.sh` (minutely cron) writes `/docker/homeassistant/plex_recordings_state.json`.
3. **HA sensors:** `homeassistant/config/command_line.yaml` exposes status + sync meta (including health attrs).
4. **Dashboard:** `homeassistant/config/dashboards/recordings.yaml` — recently landed, DVR queue, last sync, **Library OK / UNHEALTHY** chip.
5. **Alerts:** automations for scheduled/completed (mobile) and for unhealthy library (persistent + `script.notify_mobile_recording`).

## Consequences

- **Positive:** Wrong library type or orphaned on-disk files page a phone; dashboard matches the MQTT truth after each sync.
- **Negative:** Bridge is eventually consistent (~1 minute); if mosquitto or cron dies, HA goes stale.
- **Dependency:** Health fields only appear after plex_recordings publishes them — keep both repos deployed together after DVR health changes.

## Do not

- Re-add a storage-mode-only Recordings UI without updating the YAML dashboard in git
- Drop `health` / `awaiting_index_count` from the bridge or `json_attributes` when editing sensors
- Silence “awaiting Plex index” in the UI without fixing library type on media-laptop
