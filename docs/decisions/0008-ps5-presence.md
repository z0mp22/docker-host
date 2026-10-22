# ADR 0008: Basement PS5: LAN power check for presence, PSN only for game titles

- **Status:** Accepted
- **Date:** 2026-10-17
- **Deciders:** Cody
- **Tags:** homeassistant, basement, presence

## Context

The basement lights automation (`packages/basement_lights.yaml`) turns the lights off at night
after an hour with no person on the Basement camera. Frigate misses people sitting still, so the
basement Roku playing already counts as someone being there. Gaming on the PS5 leaves the Roku
idle, so a gaming session could have the lights cut. Cody also wanted the PS5 on the TV panel,
how long it's on per day and week, and which games are played.

Options for knowing whether the PS5 is on:

- **UDM client list or traffic:** Wi-Fi association says nothing about rest mode vs on, and UDM
  history only starts after its last reboot.
- **Samsung TV input:** the local API has power only; the HDMI input needs SmartThings cloud.
- **PlayStation Network:** knows the game, but it's cloud polling, tied to one account, and the
  token expires about every two months. It reports the account's presence, not the console's.
- **Sony's discovery protocol (DDP) on the LAN:** UDP 9302, no pairing. The PS5 answers
  `200 Ok` when on and `620 Server Standby` in rest mode. Tested 2026-10-11 and again from
  inside the HA container (host network) on 2026-10-17.

## Decision

- **Power comes from DDP.** `shell/ps5_status.py` broadcasts the search (one retry) and keeps
  the first reply with `host-type: PS5`. `sensor.ps5_power` (command_line, 30 s) is
  on / standby / off. Nothing identifying the console is in the repo, and it needs no fixed IP.
- **`binary_sensor.ps5_on`** waits a minute before going off, to ride out one lost reply.
  `history_stats` gives `sensor.ps5_on_today` and `sensor.ps5_on_last_7_days`.
- **The basement lights** treat `binary_sensor.ps5_on` like the Roku playing, and recheck 15
  minutes after the PS5 goes off.
- **PSN (the built-in `playstation_network` integration, Cody's account) only supplies the
  game:** the TV panel shows its title and art and adds up per-game time from recorder history
  of the Now playing sensor. Without PSN, everything else still works; the panel says titles
  need PSN.
- **Left-on push:** if the PS5 has been on for 2 h with nobody on camera and no game running, push
  once (tag `ps5-left-on`), and clear the push when it goes off.

## Consequences

- "Off" also covers rest mode with "Stay connected to the internet" turned off. The lights and the
  push only need "on", so that ambiguity doesn't matter.
- A paused game counts as playing, so a console left mid-game doesn't trigger the left-on push.
- A PS5 left on keeps the basement lights on, the same as a paused Roku does. The left-on push is
  the backstop.
- When the PSN token expires, HA shows a repair notice and titles go blank. There's no push for it
  (Cody's choice).
- Waking from rest mode was added on 2026-10-22 (see ADR 0010). docker-host is linked as a Remote
  Play device, and `shell/ps5_wake.py` sends DDP `WAKEUP` with that credential (kept in
  `/config/.ps5_credential`, outside the repo). Putting it back into rest mode still isn't built:
  that needs a full Remote Play session.
