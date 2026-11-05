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
- The fan ran "on" 22–24 h a day. Cody keeps it on to even out a cold basement and a warm top
  floor (10 ft ceilings), and because the whole-house humidifier (Healthy Climate, bypass type)
  only adds moisture while the blower runs. There was no fan-off data to test either.
- The furnace is a Trane XV95: two-stage, 95% AFUE, with a variable-speed (ECM) blower. On
  continuous fan that blower draws roughly 0.1–0.2 kW, not the 0.5 kW first assumed, so the fan
  costs about $10/month rather than ~$40. The burns are short enough that it stays on low fire.
- With the fan on, the bedroom held 34–41% RH. On dry days indoor air carried ~3 g/kg more
  moisture than outdoor air, most of it plausibly from the humidifier. On Auto the humidifier
  would only run during heat calls; the estimate is 8–10 RH points drier.
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
   advisor compares the floor spread (bedroom − basement), bedroom humidity (as moisture above
   outdoor air, so the weather doesn't decide it), gas per degree-day and fan cost. A push gives
   the verdict: the smart fan if Auto days were ≥ 2 RH points drier or ≥ 1.5° less even,
   otherwise plain Auto.
3. **Smart fan**: the fan is On while the bedroom RH is below a target or the bedroom runs more
   than a set limit over the basement (default 6 °F), and Auto otherwise.
   - The RH target defaults to 35% and is capped by outdoor temperature using the usual
     window-condensation chart (40% at 20–40 °F, 35% at 10–20 °F, 30% at 0–10 °F, …).
   - Hysteresis is ±1% RH / 0.5 °F, with 10 min on and 15 min off delays.
   - The humidity rule applies only in heat mode.
   - It replaces an earlier "Auto during on-peak" option, which an ECM blower makes worth only
     ~$2/month.
4. **Monthly advisor** (`shell/hvac_advisor.py`): fixed rules on recorder data, run inside HA
   (read-only SQLite, so no token) at 07:00 on the 1st. Results go to the /hvac panel, and
   actionable items go to the phone.
   - Suggestions that map to a helper or fan mode get a one-tap Apply button. The panel
     whitelists those services.
   - Nothing is applied automatically except the warm-up rate.
   Its humidity rules flag dry air despite the fan (check the humidifier), dry air on Auto
   (suggest the smart fan), and RH above the window-condensation cap.
5. Long-term statistics for outdoor temperature and the setpoint, so later analyses don't need
   outside weather data.

## Consequences

- If HA or Honeywell's cloud is down, the thermostat stays at the last setpoint (63° or 67°),
  which is safe. A missed transition, or a fan change the cloud dropped, is caught up after a
  restart or two minutes after the thermostat comes back online. The cloud was down for an
  evening on 2026-11-04.
- Cycle rate (CPH) is an installer setting HA can't reach; the advisor can only suggest it.
- Fan-only cost uses its own number (0.15 kW default, an estimate for the ECM blower). Gas still
  uses the default 80k BTU/h until the furnace rating plate (inside the blower door) is read, and
  the advisor says so until then. On low fire a two-stage furnace burns ~65% of nameplate.
- Not chosen: the Climate Advisor HACS integration. It has no humidity logic and only one wake
  time, and most of its value is in cooling season. Worth revisiting in observe-only mode for
  next summer's pre-cooling.
- Not chosen: ToD pre-heating (gas is flat-priced) and deeper night setbacks (no measurable
  saving in this house).
