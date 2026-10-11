# ADR 0007: Tuner Signal: per-tuner live view, per-channel trend sensors

- **Status:** Accepted (amends [0002](0002-hdhomerun-signal-mqtt-bridge.md))
- **Date:** 2026-10-11
- **Deciders:** Cody
- **Tags:** homeassistant, mqtt, hdhomerun
- **Related:** [plex_recordings ADR 0012](https://github.com/czampino/plex_recordings/blob/main/docs/decisions/0012-nbc-on-kgwn-repin-and-settling-samples.md)

## Context

The Tuner Signal dashboard appeared to show signal dropping on a regular
schedule. Three weeks of raw samples showed that this came from how the
dashboard was built, not from the antenna:

- `sensor.hdhomerun_signal_*` held whichever channel was tuned. Going from
  22.1 (99%) to 4.1 (72%) looked like a 27-point drop, but those are two
  different transmitters. Tuners are only used on game days, so the "schedule"
  was the recording schedule.
- When both tuners were in use, the bridge kept only `readings[0]`, so tuner1
  was never graphed.
- The MQTT message was retained and the poller stayed silent while idle, so
  the sensors held the last channel's numbers indefinitely.
- The trend graph plotted the daily min, and the first reading of every
  session shows symbol quality 0 while the tuner locks on. As a result, every
  recording day had a drop.

## Decision

- **Bridge** (`scripts/hdhomerun-mqtt-bridge.sh`) writes `tuners` (one entry
  per tuned tuner, with `settling` on the lock-on minute) and `channels`
  (settled readings keyed by channel; if both tuners are on one channel, the
  worse reading wins). An empty or unreadable topic leaves the file as it is,
  so a dead poller shows as stale rather than idle.
- **HA:** one `command_line` sensor, `sensor.hdhomerun_tuners` (state `Idle` /
  `N in use` / `No data` after 5 min without a publish), replaces the four
  `hdhomerun_signal_*` sensors. Eight template sensors,
  `sensor.tuner_quality_<channel>_<call>_<network>`, one per channel
  plex_recordings books from, carry **signal quality** with
  `state_class: measurement`. Each is unavailable unless its channel is tuned
  and the reading is less than 3 min old, so long-term statistics only cover
  real samples and never mix channels.
- **Dashboard:** status line, two tuner cards (channel, quality, signal,
  errors; red for errors, amber under 70% quality), and two per-channel daily
  graphs: **worst minute** (min), which shows dropouts, and **daily average**
  (mean). Signal *strength* is no longer graphed per channel because it hardly
  varies. Quality and symbol errors are what predict a damaged recording.

## Consequences

- Graphs start empty and fill on recording days only.
- The old sensors' long-term statistics are orphaned. HA's statistics repair
  ("no longer provided") can delete them.
- Adding a channel to plex_recordings `channels` means adding a template
  sensor here and an entity row on the dashboard.
- Live per-tuner channel display on the Recordings panel still comes from the
  HACS HDHomeRun integration's `sensor.tuner0`/`sensor.tuner1`. This ADR
  doesn't touch it.
