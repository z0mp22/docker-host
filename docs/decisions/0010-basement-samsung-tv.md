# ADR 0010: Basement Samsung TV: local control only, input guessed from the active device

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Cody
- **Tags:** homeassistant, basement, tv

## Context

The basement TV is a Samsung UN70TU700D (2020 TU7000, Tizen) on Wi-Fi, with the PS5 on HDMI 1
and the basement Roku on HDMI 2. HA only knew about it through the Roku (CEC). Cody wanted to
control it from HA, starting with: turn it off when nothing's on, End workout turning it off
for sure, and a one-tap movie setup.

Options:

- **Core `samsungtv` integration (LAN websocket, port 8002):** on/off, volume, mute, remote keys,
  paired once with Allow on the TV. It can't read the HDMI input. Turning on needs Wake-on-LAN
  ("Power On with Mobile"), which is patchy over Wi-Fi.
- **SmartThings (core or the ha-samsungtv-smart fork):** reads and sets the input, picture and
  sound mode, but needs the TV online. The UDM's "Block TV" rule keeps it offline on purpose, and
  Samsung's API access was reported to be getting stricter in 2026 (24 h personal tokens, paid tiers).
- **HDMI-CEC from the sources:** the Roku and PS5 already turn the TV on and switch it to
  themselves when they wake.

## Decision

- **Local only:** `samsungtv`, entities renamed to `media_player.basement_tv` and
  `remote.basement_tv`. The TV stays blocked from the internet; it has a fixed IP (10.0.0.243) on the UDM.
- **Inputs:** "watch the Roku" wakes the Roku (CEC) and, if the TV was already on, sends
  `KEY_HDMI2`. "Switch to the PS5" sends `KEY_HDMI1`; HA can't wake the PS5 (no Remote Play
  pairing), so the panel asks for the controller's PS button when it's off.
- **Which input is showing** is a guess: the PS5 while it's on and the Roku isn't playing (the
  panel's existing gaming rule), else the Roku while it's awake. The panel says it's a guess.
- **Auto-off** (`automation.basement_tv_off_after_30_min_with_nothing_on`): TV on for 30 min with
  `binary_sensor.basement_tv_in_use` off (PS5 off; Roku/Plex not playing, a pause counting for
  2 h). Turns the TV off and the Roku too, so the Roku doesn't wake it again. Toggle on the panel.
- **End workout** turns the TV off directly as well as the Roku.
- **Movie** (`script.basement_movie`): lights 10%, TV on the Roku, Plex (app 13535) open.
- **TV panel:** a Basement · TV card (state, inputs, Movie, auto-off switch, time on today); the
  remote's volume goes to the TV and shows its level while the TV is on.

## Consequences

- No input readback. If the guess is wrong (e.g. someone switched inputs with the TV remote), the
  card shows the wrong source until a device changes state.
- **Tested with Cody at the TV, 2026-10-22, after pairing:** `KEY_HDMI1` and `KEY_HDMI2` switch inputs;
  `script.basement_tv_watch_roku` lands on the Roku home screen; turn off works, and Wake-on-LAN
  over Wi-Fi brings it back (network up in about 2 s, screen on, HA reports on in about 6 s).
- **No volume from HA.** The sound is a Samsung HW-T550 soundbar on optical, which only takes IR
  (it answers the TV remote's codes). The TV's network volume keys only change its built-in speakers
  (always 0), and the Roku's volume keys don't reach it either. The Basement room shows a note
  instead of volume buttons (`volume:` in the panel config). An IR blaster in HA would be the way to
  add it later.
- Before pairing, everything is a no-op: conditions need the TV on, and actions on missing
  entities only log a warning. The panel shows pairing steps.
