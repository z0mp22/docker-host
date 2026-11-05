# ADR 0013: Home Assistant runs the heating schedule; monthly rules-based advice

- **Status:** Accepted
- **Date:** 2026-11-04
- **Deciders:** Cody
- **Tags:** homeassistant, hvac, climate-panel

## Context

A month of data (Oct 3 – Nov 4 2026: furnace runtime, the thermostat, bedroom and basement
sensors, hourly weather) showed:

- The house loses heat slowly: about 2–3 °F overnight. Its time constant is ~55 h and its heat
  loss ~400 BTU/h per °F of gas input, so the 63° night setting was reached on 2 of 26 nights.
  Simulated over Nov–Apr, lower night settings or later warm-ups save only $0–6 a season.
- The Honeywell program warmed the house to 67° by ~4:00 every day, weekends included, though
  Cody gets up around 6 on weekends.
- The fan ran "on" 22–24 h a day. At the assumed 0.5 kW blower that costs ~$1.10–1.50 a day,
  about as much as the gas heat. Cody keeps it on to even out a cold basement and a warm top
  floor (10 ft ceilings); there was no fan-off data to test that.
- Furnace burns averaged ~3.5 min at ~3.5 cycles/h, which is inefficient.
- The bedroom averaged 66–72° overnight, warmer than Cody likes, and the setback can't change
  that because the house never cools down to it.

Gas is flat-priced, so the Fort Collins time-of-day rates only matter for the blower.

## Decision

1. **HA runs the schedule** (`packages/hvac_schedule.yaml`).
   - The thermostat is held in permanent hold, and HA moves the setpoint at the setback time and
     at the warm-up.
   - Warm-up timing replaces Honeywell's adaptive recovery: start = gap ÷ learned rate + 15 min
     before the "warm by" time, capped at 3 h. The rate is learned after every warm-up as
     EWMA α=0.3, clamped to 0.5–8 °F/h.
   - Separate weekday and weekend times.
   - Manual changes hold until the next transition. Turning the schedule off hands control back
     to the thermostat's own program.
2. **Fan trial**: 14 days alternating Auto and On by day, so both see the same weather. The
   advisor compares the floor spread (bedroom − basement), bedroom overnight temperature, gas per
   degree-day and fan cost. Afterwards the fan returns to On and a push gives the verdict:
   - Auto, if the spread grows by < 1.5°;
   - Auto 5–9 pm on weekdays only, if it grows by < 3°;
   - otherwise keep it On.
3. **Monthly advisor** (`shell/hvac_advisor.py`): fixed rules on recorder data, run inside HA
   (read-only SQLite, so no token) at 07:00 on the 1st. Results go to the /hvac panel, and
   actionable items go to the phone.
   - Suggestions that map to a helper or fan mode get a one-tap Apply button. The panel
     whitelists those services.
   - Nothing is applied automatically except the warm-up rate.
4. Long-term statistics for outdoor temperature and the setpoint, so later analyses don't need
   outside weather data.

## Consequences

- If HA is down, the thermostat stays at the last setpoint (63° or 67°), which is safe. A missed
  transition is caught up after a restart.
- Cycle rate (CPH) is an installer setting HA can't reach; the advisor can only suggest it.
- Dollar figures still use the default equipment numbers (80k BTU/h, 0.5 kW blower) until the
  furnace rating plate is entered. The advisor says so until it is.
- Not chosen: ToD pre-heating (gas is flat-priced) and deeper night setbacks (no measurable
  saving in this house).
