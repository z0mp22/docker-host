# Dashboard design playbook

Lessons from building the Irrigation panel (`homeassistant/config/www/irrigation/`) and cleaning up
the Overview dashboard (`homeassistant/config/ui-lovelace.yaml`), written so the next dashboard
starts from these decisions instead of rediscovering them.

## 1. Start from the job, not the entities

Every dashboard problem so far has been the same one. The integration exposes everything it can,
and the default UI shows all of it.

| Surface | Entities available | Concepts actually shown |
|---|---|---|
| Overview (auto-generated) | ~1,000 | 7 controls + 2 climate readouts |
| OpenSprinkler integration | ~190 | 8 zones, 1 status, 1 plan, 1 action, a few schedules |

**Write the job down before drawing anything.** Irrigation's job:

> "Water the yard the way I want, right now, and know that it's handled."

That sentence gives the screen its two modes and its one primary action:

- **Plan mode (idle):** choose zones and minutes, see the consequence, press Start.
- **Monitor mode (running):** what is watering, how long is left, and a way to stop it.

Everything that doesn't serve one of those modes (station delay config, weather adjustment
knobs, day-of-week switches, per-program date ranges) stays out and can be reached
elsewhere.

**Apply elsewhere:** for any new dashboard, write the one-sentence job, list the modes
(usually "normal" and "something is happening"), and name the single primary action for each
mode. If you can't name it, the screen is a status board, which is fine, but then it has no
big button.

**Primary context is the phone, in hand, probably outside.** Design for 390 px wide first,
make sure the answer can be read in about 2 seconds, and make sure the main action can be
reached with a thumb.

## 2. Principles

### 2.1 Status must describe what is physically happening, in plain words

The first Overview irrigation card showed `switch.opensprinkler_enabled` as "on", and you
reasonably read that as "it's watering". The switch only means the controller is armed.

- Derive status from the physical signal (the per-station `*_station_running` sensors), not
  from a config flag that happens to be a boolean.
- Label status with a state a person would say: **Watering**, **Ready**, **Paused**,
  **Rain delay**, **Off**, **Offline**.
- Resolve competing states with an explicit priority order and show exactly one:
  `Offline > Off > Paused > Watering > Rain delay > Ready`.
- Pair the status word with one detail that answers "so what?", e.g.
  "Watering · Front North Grass · 1 h 2 min left".

### 2.2 Answer the next question before it's asked

Each number on screen is there because it's the obvious follow-up question:

| User thinks... | Screen answers |
|---|---|
| "How long will this take?" | 34 minutes planned |
| "When will it be done?" | Start now and it's done at 8:44 AM |
| "In what order, and when does my zone start?" | Watering order with start times |
| "Does this zone even need it?" | Last watered 2 days ago |
| "Should I bother, or will it rain?" | Rain in 3 days |

**Computed answers must be correct, or they cost trust.** The finish time includes the
controller's 10-minute station delay, and that value was checked against a real run log
before it was shown. A finish time that is off by 40 minutes is worse than none.

### 2.3 One layout, two modes

The layout does not change between modes, but its contents do:

- The ring shows *minutes planned* when idle and *minutes left* plus progress while running.
- Each zone's fill bar shows *planned length* when idle (30 min = full) and *progress* while running.
- The primary button is **Start watering** (blue) when idle and **Stop** (red) while running.
- While running, editing controls are **disabled with an explanation**
  ("Watering in progress — stop to make changes"), not hidden. Hiding them makes people
  wonder where they went.

### 2.4 One primary action, always within reach

- The action bar is sticky at the bottom of the zones card. It restates what will happen
  ("6 zones · 34 min · Done at about 8:44 AM") next to the button that does it.
- When the button is disabled, the text beside it says why ("Turn the controller on to water",
  "Tap a zone to add it"). A disabled button with no reason given looks like a bug.

### 2.5 Friction matches consequence and reversibility

| Action | Friction | Why |
|---|---|---|
| Start watering | One tap | Easily undone with Stop |
| Stop | One tap, no confirm | Stopping is always the safe direction |
| Toggle a program | One tap | Visible and easy to undo |
| Turn the controller off | Confirmation dialog | Silently stops *all* watering, including schedules, possibly for weeks |

### 2.6 Good defaults and no empty first screen

On first open the plan is taken from the active program's durations, so the screen shows a
sensible, ready-to-run plan rather than eight zeros. Defaults should come from how you
already use the system.

### 2.7 State that matters across devices lives in HA

The zone plan is stored in `input_text.irrigation_plan` (small JSON), not in browser storage,
so the phone and the desktop always agree. Writes are debounced (600 ms) so tapping + five
times results in one update.

Rule of thumb: if you would be surprised to see a different value on another device, keep it
in HA. Pure view preferences (like "show all schedules") can stay local.

### 2.8 Progressive disclosure

- Zones disabled on the controller are grey, compact, and placed **at the bottom**.
- Only enabled schedules are listed; the others sit behind "Show 5 more schedules".
- The rare, risky control (controller on/off) comes last, after the schedules.

### 2.9 Robust to messy real-world data

- **Key on attributes, not entity IDs.** OpenSprinkler entity IDs were generated from old
  station names, so `back_step_wildflower` is now "Back North Grass". The panel reads
  `index` and `name` from attributes, which is why it is correct while the old Yard dashboard
  labeled zones wrong.
- Read units from `unit_of_measurement` instead of assuming them.
- When the integration is unavailable, show a banner and the last-known state instead of
  a blank or broken screen.

### 2.10 Show config surprises literally

The program named "Tues / Thurs / Sat Grass" actually runs Tue, Thu and Sun at 12:00 AM.
The panel shows what the controller will actually do, not what the name says. The
dashboard should reveal what's true, not repeat the labels.

## 3. Visual system (parameters)

### Color tokens (dark)

| Token | Value | Meaning |
|---|---|---|
| `--bg` | `#080d17` + two soft radial glows | Page |
| `--card` / `--card-2` | `#0f1624` / `#141d2e` | Surfaces (vertical gradient between them) |
| `--line` | `rgba(148,170,200,.12)` | Hairline borders |
| `--text` | `#eef3fa` | Primary text |
| `--muted` | `#8593a8` | Secondary text |
| `--accent` → `--accent-2` | `#4cc3ff` → `#1d8fe8` | Water / selected / active |
| `--green` | `#22c55e` | Ready |
| `--amber` | `#f5b041` | Paused, rain delay |
| `--red` | `#f0616d` | Stop, errors |
| grey | `#64748b` | Off, disabled |

**Color carries meaning and is never decoration.** Blue means water or "included", and nothing
else is blue. An unselected zone loses its color entirely, so you can scan the list for
which zones are in the run.

### Type

Font: **Outfit** (geometric, with tabular numbers for times), falling back to system UI.

| Role | Desktop | Phone |
|---|---|---|
| Hero number (ring) | 84 px / 700 | 38 px |
| Page title | 34 px / 700 | 22 px |
| Zone name | 24 px / 600 | 16 px |
| Zone minutes | 44 px / 600, accent | 22 px |
| Body / secondary | 17–18 px | 12.5–15 px |
| Eyebrow labels | 13 px, uppercase, 0.12em tracking | 11 px |

Times use `font-variant-numeric: tabular-nums` so columns don't shift as digits change.

### Shape and spacing

| Element | Desktop | Phone |
|---|---|---|
| Card radius | 30 px | 24 px |
| Zone row radius / min height | 26 px / 118 px | 20 px / 76 px |
| Zone icon tile | 68 px, 18 px radius | 40 px, 12 px radius |
| Stepper buttons | 62 × 62 px | 34 × 42 px |
| Primary button height | 70 px | 54 px |
| Grid gap | 22 px | 14 px |

### Layout

- **Use container queries, not media queries.** The HA sidebar changes the available width,
  so the viewport size gives the wrong answer. `:host` is the query container.
- Breakpoints: **980 px** (two columns become one; the ring card turns horizontal) and
  **640 px** (phone sizing).
- **Content order changes on phone**: ring → zones (the action) → watering order → schedules.
  On desktop the order and schedules sit on the left because there's room for them.
- The single-column grid uses `minmax(0, 1fr)`, not `1fr`. Without it, long zone names push
  the column past the screen edge. That bug turned up in testing (see §5).

### Motion

Only live state moves: the status dot pulses and the running zone's icon glows **while
watering**. Nothing animates at rest, so any motion means something is happening.

### Accessibility (measured, WCAG contrast)

| Pair | Ratio | Verdict |
|---|---|---|
| Text on card | 16.2:1 | Pass |
| Muted on card / on zone row | 5.8:1 / 5.6:1 | Pass (AA) |
| Accent on zone row | 8.8:1 | Pass |
| Unselected minutes (`#6f7d92`) | 4.2:1 | Passes only as large text (22–44 px) |
| White on primary button's darker bottom | 4.0:1 | **Gap** at phone size (17 px) |
| White on Stop button's darker bottom | 4.3:1 | **Gap** at phone size |

Zones are keyboard-focusable with `role="button"` / `aria-pressed`. Stepper and toggle
buttons have labels.

## 4. Architecture choice

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Lovelace YAML + Mushroom cards | Quick, lives in the repo, familiar | Can't compute the watering order or do multi-step interaction; card-grid look | Fine for status boards (Overview) |
| Standalone HTML page on `/local/` over the WebSocket API | Full control; works on kiosks | Handles its own auth tokens; awkward in the phone app | Consider for wall kiosks |
| **`panel_custom` vanilla web component** | Full control; HA passes in `hass` (no auth code); works in the phone app; gets its own sidebar entry | You own all the UI code; changing it needs a deploy | **Chosen for task-focused tools** |

Implementation choices worth reusing:

- **No framework, no build step.** One JS file with inline CSS and embedded MDI icon paths.
  Nothing needs to be installed or updated to keep it running.
- **Rendering:** build the HTML as a string, skip the DOM swap if it's unchanged, batch
  `hass` updates per animation frame, and tick every 5 s for countdowns. HA calls the `hass`
  setter on *every* state change in the house, so the unchanged-HTML check matters.
- **Events:** delegated listeners on the shadow root with `data-action` attributes. Re-rendering
  never loses a listener. Nested actions (e.g. the stepper inside a tappable row) swallow
  clicks with `data-action="noop"`.
- **Phone app:** in narrow layout, show a menu button that fires `hass-toggle-menu`. Without it
  a full-screen panel leaves the user with no way to open the sidebar.

## 5. How it's verified

Every change was tested in a **mocked preview before deploy**:

1. Snapshot real entity states and attributes from the recorder DB into `mock_states.json`.
2. Build a fake `hass` (`states`, `callService`, `callWS`, `connection.subscribeMessage`)
   with fake history and forecast data.
3. Render in headless Chromium at **1440 px** and **390 px**, in each state
   (**idle / running / controller off**), and look at the screenshots.
4. Script the interactions and **assert the exact service calls**, e.g. +/− steps,
   "stepper background doesn't toggle the row", "disabled zone ignores taps",
   "one debounced plan write", and "`run_once` sends exactly the selected zones in seconds".
5. Run HA `check_config` against a scratch copy of the live config, then deploy through CI.

The phone overflow bug (§3 Layout) was caught at step 3. It would have shipped otherwise.

## 6. Checklist for the next dashboard

- [ ] Job sentence, modes, and one primary action per mode written down
- [ ] Status derived from physical signals, with plain words and an explicit priority order
- [ ] Every number answers a "so what?" question, and computed values are checked against reality
- [ ] Controls disabled with a reason rather than hidden; the primary button explains why it's disabled
- [ ] Friction matches consequence (confirm only irreversible or wide-impact actions)
- [ ] Defaults come from existing config; the first screen is never empty
- [ ] State shared across devices is stored in HA
- [ ] Rare, risky, or disabled items pushed down or behind "show more"
- [ ] Entities matched by attributes, not ID text; units read from attributes; unavailable handled
- [ ] Color only for meaning; motion only for live state
- [ ] Container queries; phone-first content order; `minmax(0, 1fr)` grids
- [ ] Mocked preview at 1440/390 × each mode, with service calls asserted, before deploy

## 7. Known gaps / backlog

- **Contrast:** darken the button gradients' bottom stops (or brighten their text weight/size)
  to reach 4.5:1 at phone size.
- **Touch targets:** the phone stepper buttons are 34 px wide, under the 44 px guideline. This
  was traded for zone names that aren't truncated. Consider a two-line zone row on phone.
- **Cache busting is manual:** `?v=` in `configuration.yaml` must be bumped when the JS changes.
  Could be automated in `deploy.sh` with a content hash.
- **Dark only.** The tokens are variables, so a light theme is mostly a second token set
  (switched from `hass.themes.darkMode`).
- **"Last watered"** only covers the recorder window (10 days by default); anything older
  shows "Not watered recently".
- **No kiosk auto-reload.** If a wall tablet is added, adopt the build-hash +
  `input_text` push pattern from the post the design was taken from.
