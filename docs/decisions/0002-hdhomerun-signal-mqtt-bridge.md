# ADR 0002: HDHomeRun signal-strength bridge + trend dashboard

- **Status:** Accepted
- **Date:** 2026-09-13
- **Deciders:** Cody
- **Tags:** homeassistant, mqtt, hdhomerun
- **Related:** [plex_recordings ADR 0007](https://github.com/z0mp22/plex_recordings/blob/main/docs/decisions/0007-hdhomerun-signal-weather-logging.md)

## Context

Wanted a dashboard trending HDHomeRun tuner signal strength, to eventually
correlate against weather (does a given OTA channel degrade in rain/wind?).
This is the same "don't make HA scrape a remote host directly" shape as
ADR 0001 — the sampler has to run on media-laptop's LAN segment next to the
tuner, not on this Pi.

## Decision

Reuse the ADR 0001 shape exactly, on a new topic:

1. `plex_recordings` (media-laptop) publishes retained JSON to
   `home/hdhomerun_signal/status` — see its ADR 0007 for why sampling is
   opportunistic (only while a tuner is actively in use) rather than an
   active poll.
2. **Bridge on this host:** `scripts/hdhomerun-mqtt-bridge.sh` (minutely
   cron via `cron/hdhomerun-mqtt-bridge`, installed by
   `deploy.sh:install_hdhomerun_signal_bridge`) writes
   `/docker/homeassistant/hdhomerun_signal_state.json`.
3. **HA sensors:** `homeassistant/config/command_line.yaml` — three numeric
   sensors (`HDHomeRun Signal Strength/Quality`, `Symbol Quality`, all
   `state_class: measurement` so HA's long-term statistics keep them past
   the recorder's short `states`/`history` purge window) plus one
   attributes sensor (`HDHomeRun Signal Meta`: current channel, weather at
   last sample, full recent readings).
4. **Dashboard:** `homeassistant/config/dashboards/tuner_signal.yaml` —
   current-reading chips, gauges, and a `statistics-graph` card for the
   long-term trend.

## Consequences

- **Positive:** Trend survives HA's default history purge because it rides
  the `statistics` tables, not `history`/`logbook`.
- **Negative:** Same as ADR 0001 — eventually consistent (~1 minute), and
  goes stale silently if mosquitto/cron dies on either host.
- **Deliberately not here:** the actual weather-correlation analysis (mean
  signal per channel per weather condition). HA's statistics tables only
  keep numeric aggregates, not the weather condition a sample was tagged
  with — that join only exists in `plex_recordings`' own
  `logs/hdhomerun_signal.jsonl`. This dashboard is a live/recent monitoring
  view; run `./scripts/analyze_signal_weather.py` on media-laptop for the
  real correlation.

## Do not

- Add active tuner-cycling here or in `plex_recordings` to get denser
  samples without first checking the recording schedule (see that repo's
  ADR 0007) — only 2 tuners, some needed for scheduled DVR recordings.
- Drop `state_class: measurement` from the numeric sensors — that's what
  keeps the trend graph alive past the recorder purge window.
