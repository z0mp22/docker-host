// Irrigation panel: a dependency-free web component registered via panel_custom.
// HA hands it the `hass` object, so there is no token handling or build step.

const ICONS = {
  mdiSprinklerVariant: "M10 10H14V22H10V10M7 9H9V7H7V9M4 8H6V6H4V8M4 11H6V9H4V11M1 13H3V11H1V13M1 7H3V5H1V7M1 10H3V8H1V10M18 11H20V9H18V11M21 10H23V8H21V10M21 5V7H23V5H21M21 13H23V11H21V13M15 9H17V7H15V9M18 8H20V6H18V8M10 7H10.33L11 9H13L13.67 7H14V6H10V7Z",
  mdiGrass: "M12 20H2V18H7.75C7 15.19 4.81 13 2 12.26C2.64 12.1 3.31 12 4 12C8.42 12 12 15.58 12 20M22 12.26C21.36 12.1 20.69 12 20 12C17.07 12 14.5 13.58 13.12 15.93C13.41 16.59 13.65 17.28 13.79 18C13.92 18.65 14 19.32 14 20H22V18H16.24C17 15.19 19.19 13 22 12.26M15.64 11C16.42 8.93 17.87 7.18 19.73 6C15.44 6.16 12 9.67 12 14V14C12.95 12.75 14.2 11.72 15.64 11M11.42 8.85C10.58 6.66 8.88 4.89 6.7 4C8.14 5.86 9 8.18 9 10.71C9 10.92 8.97 11.12 8.96 11.32C9.39 11.56 9.79 11.84 10.18 12.14C10.39 10.96 10.83 9.85 11.42 8.85Z",
  mdiFlower: "M3,13A9,9 0 0,0 12,22C12,17 7.97,13 3,13M12,5.5A2.5,2.5 0 0,1 14.5,8A2.5,2.5 0 0,1 12,10.5A2.5,2.5 0 0,1 9.5,8A2.5,2.5 0 0,1 12,5.5M5.6,10.25A2.5,2.5 0 0,0 8.1,12.75C8.63,12.75 9.12,12.58 9.5,12.31C9.5,12.37 9.5,12.43 9.5,12.5A2.5,2.5 0 0,0 12,15A2.5,2.5 0 0,0 14.5,12.5C14.5,12.43 14.5,12.37 14.5,12.31C14.88,12.58 15.37,12.75 15.9,12.75C17.28,12.75 18.4,11.63 18.4,10.25C18.4,9.25 17.81,8.4 16.97,8C17.81,7.6 18.4,6.74 18.4,5.75C18.4,4.37 17.28,3.25 15.9,3.25C15.37,3.25 14.88,3.41 14.5,3.69C14.5,3.63 14.5,3.56 14.5,3.5A2.5,2.5 0 0,0 12,1A2.5,2.5 0 0,0 9.5,3.5C9.5,3.56 9.5,3.63 9.5,3.69C9.12,3.41 8.63,3.25 8.1,3.25A2.5,2.5 0 0,0 5.6,5.75C5.6,6.74 6.19,7.6 7.03,8C6.19,8.4 5.6,9.25 5.6,10.25M12,22A9,9 0 0,0 21,13C16,13 12,17 12,22Z",
  mdiWaterOutline: "M12,3.77L11.25,4.61C11.25,4.61 9.97,6.06 8.68,7.94C7.39,9.82 6,12.07 6,14.23A6,6 0 0,0 12,20.23A6,6 0 0,0 18,14.23C18,12.07 16.61,9.82 15.32,7.94C14.03,6.06 12.75,4.61 12.75,4.61L12,3.77M12,6.9C12.44,7.42 12.84,7.85 13.68,9.07C14.89,10.83 16,13.07 16,14.23C16,16.45 14.22,18.23 12,18.23C9.78,18.23 8,16.45 8,14.23C8,13.07 9.11,10.83 10.32,9.07C11.16,7.85 11.56,7.42 12,6.9Z",
  mdiSprout: "M2,22V20C2,20 7,18 12,18C17,18 22,20 22,20V22H2M11.3,9.1C10.1,5.2 4,6.1 4,6.1C4,6.1 4.2,13.9 9.9,12.7C9.5,9.8 8,9 8,9C10.8,9 11,12.4 11,12.4V17C11.3,17 11.7,17 12,17C12.3,17 12.7,17 13,17V12.8C13,12.8 13,8.9 16,7.9C16,7.9 14,10.9 14,12.9C21,13.6 21,4 21,4C21,4 12.1,3 11.3,9.1Z",
  mdiWeatherPartlyRainy: "M12.75,4.47C15.1,5.5 16.35,8.03 15.92,10.46C17.19,11.56 18,13.19 18,15V15.17C18.31,15.06 18.65,15 19,15A3,3 0 0,1 22,18A3,3 0 0,1 19,21H17C17,21 16,21 16,20C16,19 17,19 17,19H19A1,1 0 0,0 20,18A1,1 0 0,0 19,17H16V15A4,4 0 0,0 12,11A4,4 0 0,0 8,15H6A2,2 0 0,0 4,17A2,2 0 0,0 6,19H7C7,19 8,19 8,20C8,21 7,21 7,21H6A4,4 0 0,1 2,17A4,4 0 0,1 6,13H6.27C5,11.45 4.6,9.24 5.5,7.25C6.72,4.5 9.97,3.24 12.75,4.47M11.93,6.3C10.16,5.5 8.09,6.31 7.31,8.07C6.85,9.09 6.93,10.22 7.41,11.13C8.5,9.83 10.16,9 12,9C12.7,9 13.38,9.12 14,9.34C13.94,8.06 13.18,6.86 11.93,6.3M13.55,2.63C13,2.4 12.45,2.23 11.88,2.12L14.37,0.82L15.27,3.71C14.76,3.29 14.19,2.93 13.55,2.63M6.09,3.44C5.6,3.79 5.17,4.19 4.8,4.63L4.91,1.82L7.87,2.5C7.25,2.71 6.65,3.03 6.09,3.44M18,8.71C17.91,8.12 17.78,7.55 17.59,7L19.97,8.5L17.92,10.73C18.03,10.08 18.05,9.4 18,8.71M3.04,10.3C3.11,10.9 3.25,11.47 3.43,12L1.06,10.5L3.1,8.28C3,8.93 2.97,9.61 3.04,10.3M12,18.91C12.59,19.82 13,20.63 13,21A1,1 0 0,1 12,22A1,1 0 0,1 11,21C11,20.63 11.41,19.82 12,18.91M12,15.62C12,15.62 9,19 9,21A3,3 0 0,0 12,24A3,3 0 0,0 15,21C15,19 12,15.62 12,15.62Z",
  mdiWeatherSunny: "M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z",
  mdiUmbrellaOutline: "M12,4C8.9,4 6.18,6.03 5.3,9H18.7C17.82,6.04 15.09,4 12,4M12,2A9,9 0 0,1 21,11H13V19A3,3 0 0,1 10,22A3,3 0 0,1 7,19V18H9V19A1,1 0 0,0 10,20A1,1 0 0,0 11,19V11H3A9,9 0 0,1 12,2Z",
  mdiPlay: "M8,5.14V19.14L19,12.14L8,5.14Z",
  mdiStop: "M18,18H6V6H18V18Z",
  mdiCalendarClock: "M15,13H16.5V15.82L18.94,17.23L18.19,18.53L15,16.69V13M19,8H5V19H9.67C9.24,18.09 9,17.07 9,16A7,7 0 0,1 16,9C17.07,9 18.09,9.24 19,9.67V8M5,21C3.89,21 3,20.1 3,19V5C3,3.89 3.89,3 5,3H6V1H8V3H16V1H18V3H19A2,2 0 0,1 21,5V11.1C22.24,12.36 23,14.09 23,16A7,7 0 0,1 16,23C14.09,23 12.36,22.24 11.1,21H5M16,11.15A4.85,4.85 0 0,0 11.15,16C11.15,18.68 13.32,20.85 16,20.85A4.85,4.85 0 0,0 20.85,16C20.85,13.32 18.68,11.15 16,11.15Z",
  mdiMenu: "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",
  mdiPower: "M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13",
  mdiMinus: "M19,13H5V11H19V13Z",
  mdiPlus: "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z",
  mdiCheck: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
  mdiAlertCircleOutline: "M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z",
};

const PLAN_ENTITY = "input_text.irrigation_plan";
const WEATHER_ENTITY = "weather.home";
const HISTORY_DAYS = 10;
const RAIN_CONDITIONS = new Set(["rainy", "pouring", "lightning-rainy", "snowy-rainy", "hail"]);
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_MINUTES = 120;

const svg = (name, cls = "") =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ""}"/></svg>`;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function zoneIcon(name) {
  const n = name.toLowerCase();
  if (n.includes("drip")) return "mdiWaterOutline";
  if (n.includes("flower")) return "mdiFlower";
  if (n.includes("grass") || n.includes("lawn")) return "mdiGrass";
  return "mdiSprout";
}

function stepUp(v) {
  return Math.min(MAX_MINUTES, v < 10 ? v + 1 : v + 5 - (v % 5));
}

function stepDown(v) {
  if (v <= 10) return Math.max(1, v - 1);
  return v % 5 ? v - (v % 5) : v - 5;
}

function fmtDuration(min) {
  min = Math.round(min);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function readModel(states) {
  const stations = [];
  const programs = new Map();
  const programEntities = [];
  let controller = null;
  let nextRun = null;

  for (const [id, st] of Object.entries(states)) {
    const a = st.attributes || {};
    const type = a.opensprinkler_type;
    if (type === "controller" && id.startsWith("switch.")) {
      controller = { id, state: st.state, stationDelay: Number(a.station_delay) || 0 };
    } else if (type === "station" && id.startsWith("binary_sensor.") && id.endsWith("_station_running") && !a.is_master) {
      // Entity ids come from the station names at setup time and no longer match
      // the current names, so everything is keyed by index/slug, not by id text.
      const slug = id.slice("binary_sensor.".length, -"_station_running".length);
      stations.push({
        idx: a.index,
        name: String(a.name || "").trim() || slug,
        slug,
        entity: id,
        running: st.state === "on",
        enabled: states[`switch.${slug}_station_enabled`]?.state !== "off",
        start: a.start_time ? Date.parse(a.start_time) : null,
        end: a.end_time ? Date.parse(a.end_time) : null,
      });
    } else if (type === "program") {
      programEntities.push([id, st]);
    } else if (a.next_run_program_name !== undefined && st.state && !["unknown", "unavailable"].includes(st.state)) {
      nextRun = { at: Date.parse(st.state), program: String(a.next_run_program_name || "").trim() };
    }
  }
  stations.sort((x, y) => x.idx - y.idx);

  const slugsLongestFirst = stations.map((s) => s.slug).sort((x, y) => y.length - x.length);
  for (const [id, st] of programEntities) {
    const a = st.attributes;
    let p = programs.get(a.index);
    if (!p) {
      p = { idx: a.index, name: String(a.name || "").trim(), durations: {} };
      programs.set(a.index, p);
    }
    const [domain, obj] = id.split(".");
    if (domain === "switch" && obj.endsWith("_program_enabled")) {
      p.enabledEntity = id;
      p.enabled = st.state === "on";
    } else if (domain === "binary_sensor" && obj.endsWith("_program_running")) {
      p.running = st.state === "on";
    } else if (domain === "time" && obj.endsWith("_start_time")) {
      p.startTime = st.state;
    } else if (domain === "select" && obj.endsWith("_start_time_offset_type")) {
      p.startType = st.state;
    } else if (domain === "select" && obj.endsWith("_type") && !obj.endsWith("_start_time_type")) {
      p.type = st.state;
    } else if (domain === "number" && obj.endsWith("_station_duration")) {
      const rest = obj.slice(0, -"_station_duration".length);
      const slug = slugsLongestFirst.find((sl) => rest.endsWith(`_${sl}`));
      if (slug) {
        let v = parseFloat(st.state) || 0;
        if (a.unit_of_measurement === "s") v /= 60;
        p.durations[slug] = v;
      }
    } else if (domain === "number" && (obj.endsWith("_day_of_month") || obj.endsWith("_starting_in_days"))) {
      // Both expose the program's raw days0 field; for weekly programs it is a Mon..Sun bitmask.
      p.days0 = parseInt(st.state, 10);
    } else if (domain === "number" && obj.endsWith("_interval_days")) {
      p.interval = parseInt(st.state, 10);
    }
  }

  for (const p of programs.values()) {
    p.totalMinutes = stations.reduce((sum, s) => sum + (s.enabled ? p.durations[s.slug] || 0 : 0), 0);
  }

  const on = (id) => states[id]?.state === "on";
  const rainStop = states["sensor.opensprinkler_rain_delay_stop_time"]?.state;
  const pauseEnd = states["sensor.opensprinkler_pause_end_time"]?.state;
  const lastRun = states["sensor.opensprinkler_last_run"]?.state;
  return {
    controller,
    stations,
    programs: [...programs.values()].sort((x, y) => x.idx - y.idx),
    nextRun,
    paused: on("binary_sensor.opensprinkler_paused"),
    pauseEnd: pauseEnd && !["unknown", "unavailable"].includes(pauseEnd) ? Date.parse(pauseEnd) : null,
    rainDelay: on("binary_sensor.opensprinkler_rain_delay_active"),
    rainStop: rainStop && !["unknown", "unavailable"].includes(rainStop) ? Date.parse(rainStop) : null,
    lastRun: lastRun && !["unknown", "unavailable"].includes(lastRun) ? Date.parse(lastRun) : null,
    waterLevel: states["sensor.opensprinkler_water_level"]?.state,
  };
}

function defaultPlan(model) {
  const program = model.programs.find((p) => p.enabled) || model.programs[0];
  const m = {};
  const on = new Set();
  for (const s of model.stations) {
    const d = Math.round(program?.durations?.[s.slug] || 0);
    m[s.idx] = d > 0 ? d : 10;
    if (d > 0 && s.enabled) on.add(s.idx);
  }
  return { m, on };
}

function parsePlan(raw) {
  try {
    const p = JSON.parse(raw);
    if (p && typeof p.m === "object" && Array.isArray(p.on)) return { m: { ...p.m }, on: new Set(p.on) };
  } catch (_) {
    /* fall through to default */
  }
  return null;
}

const CSS = `
:host {
  --bg: #080d17;
  --card: #0f1624;
  --card-2: #141d2e;
  --line: rgba(148, 170, 200, 0.12);
  --text: #eef3fa;
  --muted: #8593a8;
  --accent: #4cc3ff;
  --accent-2: #1d8fe8;
  --green: #22c55e;
  --amber: #f5b041;
  --red: #f0616d;
  display: block;
  height: 100%;
  overflow-y: auto;
  container-type: inline-size;
  background:
    radial-gradient(1200px 600px at 10% -10%, rgba(40, 110, 190, 0.18), transparent 60%),
    radial-gradient(900px 500px at 110% 110%, rgba(30, 150, 170, 0.10), transparent 60%),
    var(--bg);
  color: var(--text);
  font-family: "Outfit", "SF Pro Display", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
* { box-sizing: border-box; }
button { font: inherit; color: inherit; border: 0; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; }
button:disabled { cursor: default; }
.ic { width: 24px; height: 24px; fill: currentColor; flex: none; }
.muted { color: var(--muted); }

.app { max-width: 1480px; margin: 0 auto; padding: 28px 28px 40px; }

.top { display: flex; align-items: center; gap: 18px; margin-bottom: 26px; }
.brand { width: 76px; height: 76px; border-radius: 22px; display: grid; place-items: center; flex: none;
  background: linear-gradient(160deg, #86dcff, #37a4ef); color: #fff;
  box-shadow: 0 10px 30px rgba(55, 164, 239, 0.35), inset 0 1px 0 rgba(255,255,255,0.35); }
.brand .ic { width: 38px; height: 38px; }
.titles { flex: 1 1 0; min-width: 0; }
h1 { margin: 0; font-size: 34px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.1; }
.status { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 18px; white-space: nowrap; overflow: hidden; }
.status b { font-weight: 600; }
.status .detail { overflow: hidden; text-overflow: ellipsis; }
.dot { width: 12px; height: 12px; border-radius: 50%; background: var(--green); box-shadow: 0 0 10px currentColor; color: var(--green); flex: none; }
.dot.blue { background: var(--accent); color: var(--accent); animation: pulse 1.6s ease-in-out infinite; }
.dot.amber { background: var(--amber); color: var(--amber); }
.dot.grey { background: #64748b; color: transparent; }
@keyframes pulse { 50% { opacity: 0.35; } }
.spacer { flex: 1; }
.chip { display: flex; align-items: center; gap: 10px; height: 54px; padding: 0 22px; border-radius: 20px;
  background: var(--card-2); border: 1px solid var(--line); font-weight: 600; font-size: 17px; white-space: nowrap; }
.chip .ic { color: #f5c542; }
.chip.info .ic { color: var(--accent); }
.icon-btn { width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; background: var(--card-2); border: 1px solid var(--line); flex: none; }

.banner { margin: -8px 0 20px; padding: 14px 18px; border-radius: 16px; display: flex; gap: 10px; align-items: center;
  background: rgba(240, 97, 109, 0.12); border: 1px solid rgba(240, 97, 109, 0.35); color: #ffd3d7; }

.grid { display: grid; gap: 22px; grid-template-columns: minmax(300px, 0.85fr) 1.5fr;
  grid-template-areas: "ring zones" "order zones" "sched zones"; grid-template-rows: auto auto 1fr; align-items: start; }
.card { background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line); border-radius: 30px; }
.ring-card { grid-area: ring; padding: 30px 24px 26px; text-align: center; }
.order-card { grid-area: order; padding: 22px 26px; }
.sched-card { grid-area: sched; padding: 18px 20px; }
.zones-card { grid-area: zones; padding: 28px 30px 0; display: flex; flex-direction: column; }

.ring { position: relative; width: min(100%, 270px); aspect-ratio: 1; margin: 0 auto; }
.ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.ring .track { fill: none; stroke: #16273c; stroke-width: 16; }
.ring .prog { fill: none; stroke: url(#ringGrad); stroke-width: 16; stroke-linecap: round; filter: drop-shadow(0 0 8px rgba(76,195,255,0.55)); }
.ring .prog.paused { stroke: var(--amber); filter: none; }
.ring-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ring-num { font-size: 84px; font-weight: 700; line-height: 1; letter-spacing: -0.03em; }
.ring-label { margin-top: 6px; font-size: 18px; color: #c3cedd; }
.ring-sub { margin-top: 22px; font-size: 18px; color: #c3cedd; }
.ring-sub b { color: var(--text); font-weight: 600; }

.card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.eyebrow { font-size: 13px; letter-spacing: 0.12em; font-weight: 600; color: var(--muted); text-transform: uppercase; }
.note { font-size: 13px; color: var(--muted); margin-top: 4px; }
.order { list-style: none; margin: 14px 0 0; padding: 0; position: relative; }
.order li { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto auto; align-items: center; gap: 14px; padding: 10px 0; position: relative; font-size: 18px; }
.order li:not(:last-child)::after { content: ""; position: absolute; left: 17px; top: 42px; height: calc(100% - 26px); width: 2px; background: #1b283a; }
.order .num { width: 36px; height: 36px; border-radius: 50%; border: 2px solid #253247; display: grid; place-items: center; font-size: 14px; color: var(--muted); background: var(--card); z-index: 1; }
.order .name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.order .min { color: var(--muted); font-size: 16px; text-align: right; }
.order .time { font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; min-width: 64px; }
.order li.now .num { border-color: var(--accent); color: var(--accent); box-shadow: 0 0 12px rgba(76,195,255,0.45); }
.order li.now .name { color: var(--accent); }
.order li.done { opacity: 0.45; }
.order li.done .num { color: var(--green); border-color: rgba(34,197,94,0.5); }
.order li.done .num .ic { width: 18px; height: 18px; }
.empty { margin-top: 14px; color: var(--muted); font-size: 16px; }

.sched-row { display: flex; align-items: center; gap: 14px; padding: 10px 8px; }
.sched-row + .sched-row { border-top: 1px solid var(--line); }
.sched-ic { width: 46px; height: 46px; border-radius: 14px; background: #1b2638; display: grid; place-items: center; color: #aeb9c9; flex: none; }
.sched-row.on .sched-ic { color: var(--accent); }
.sched-text { flex: 1; min-width: 0; }
.sched-name { font-weight: 600; font-size: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sched-desc { color: var(--muted); font-size: 15px; margin-top: 2px; }
.toggle { width: 64px; height: 38px; border-radius: 19px; background: #253145; position: relative; flex: none; transition: background 0.2s; }
.toggle::after { content: ""; position: absolute; top: 4px; left: 4px; width: 30px; height: 30px; border-radius: 50%; background: #fff; transition: transform 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.35); }
.toggle.on { background: linear-gradient(90deg, var(--accent-2), var(--accent)); }
.toggle.on::after { transform: translateX(26px); }
.more { display: block; width: 100%; padding: 12px 8px 4px; text-align: left; color: var(--accent); font-weight: 600; font-size: 15px; border-top: 1px solid var(--line); }
.next { font-size: 14px; color: var(--muted); padding: 2px 8px 8px; }

.zones-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
h2 { margin: 0; font-size: 26px; font-weight: 600; }
.zones-head p { margin: 6px 0 0; font-size: 17px; }
.pill-btn { height: 50px; padding: 0 22px; border-radius: 18px; background: #172234; border: 1px solid var(--line); color: var(--accent); font-weight: 600; font-size: 18px; flex: none; }
.zones { display: flex; flex-direction: column; gap: 14px; }

.zone { position: relative; display: flex; align-items: center; gap: 22px; min-height: 118px; padding: 16px 16px 16px 24px; border-radius: 26px;
  background: #121a28; border: 1.5px solid rgba(148,170,200,0.10); overflow: hidden; cursor: pointer; transition: border-color 0.2s, background 0.2s; }
.zone.on { border-color: rgba(76,195,255,0.35); background: #131f30; }
.zone .fill { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, rgba(76,195,255,0.10), rgba(76,195,255,0.05)); border-right: 1.5px solid rgba(76,195,255,0.35); pointer-events: none; transition: width 0.3s; }
.zone.running .fill { background: linear-gradient(90deg, rgba(76,195,255,0.28), rgba(76,195,255,0.12)); border-right-color: var(--accent); }
.zone:not(.on) .fill { display: none; }
.zic { position: relative; width: 68px; height: 68px; border-radius: 18px; display: grid; place-items: center; flex: none; color: #fff;
  background: #243246; transition: background 0.2s, box-shadow 0.2s; }
.zone.on .zic { background: linear-gradient(160deg, #86dcff, #37a4ef); box-shadow: 0 8px 22px rgba(55,164,239,0.35); }
.zone.running .zic { animation: glow 1.8s ease-in-out infinite; }
@keyframes glow { 50% { box-shadow: 0 0 0 6px rgba(76,195,255,0.18), 0 8px 22px rgba(55,164,239,0.45); } }
.zic .ic { width: 32px; height: 32px; }
.badge { position: absolute; right: -6px; bottom: -6px; width: 22px; height: 22px; border-radius: 50%; font-size: 11px; font-weight: 600;
  display: grid; place-items: center; background: #121a28; border: 1.5px solid #3a4a61; color: #b8c4d4; }
.zone.on .badge { border-color: var(--accent); color: var(--accent); background: #131f30; }
.zt { position: relative; flex: 1; min-width: 0; }
.zn { font-size: 24px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.zs { margin-top: 4px; font-size: 17px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.zone.running .zs { color: var(--accent); }
.zone:not(.on) .zn { color: #aab5c5; }
.zone.disabled { cursor: default; opacity: 0.5; min-height: 0; padding-top: 12px; padding-bottom: 12px; }
.zone.disabled .zic { width: 44px; height: 44px; border-radius: 14px; }
.zone.disabled .zic .ic { width: 22px; height: 22px; }
.zone.disabled .zn { font-size: 18px; }
.zone.disabled .zs { font-size: 14px; margin-top: 2px; }

.stepper { position: relative; display: flex; align-items: center; gap: 4px; padding: 7px; border-radius: 22px; background: #1a2435; border: 1px solid var(--line); flex: none; }
.stepper button { width: 62px; height: 62px; border-radius: 17px; background: #243044; display: grid; place-items: center; transition: background 0.15s; }
.stepper button:not(:disabled):active { background: #2f3d55; }
.stepper button:disabled { opacity: 0.35; }
.val { width: 104px; text-align: center; font-variant-numeric: tabular-nums; }
.val b { font-size: 44px; font-weight: 600; color: var(--accent); letter-spacing: -0.02em; }
.val span { font-size: 17px; color: var(--muted); margin-left: 4px; }
.zone:not(.on) .val b { color: #6f7d92; }

.foot { position: sticky; bottom: 0; margin: 24px -30px 0; padding: 22px 30px calc(22px + env(safe-area-inset-bottom)); display: flex; align-items: center; gap: 20px;
  border-top: 1px solid var(--line); background: linear-gradient(180deg, rgba(15,22,36,0.92), var(--card)); backdrop-filter: blur(10px); border-radius: 0 0 30px 30px; }
.foot-text { flex: 1; min-width: 0; }
.foot-main { font-size: 24px; font-weight: 600; margin-top: 4px; }
.foot-sub { color: var(--muted); font-size: 17px; margin-top: 2px; }
.cta { height: 70px; padding: 0 38px; border-radius: 26px; display: flex; align-items: center; gap: 14px; font-size: 22px; font-weight: 600; color: #fff; flex: none;
  background: linear-gradient(180deg, #3fb6ff, #1b82e0); box-shadow: 0 10px 30px rgba(29,143,232,0.45), inset 0 1px 0 rgba(255,255,255,0.3); }
.cta .ic { width: 26px; height: 26px; }
.cta.stop { background: linear-gradient(180deg, #ff7a85, #d9434f); box-shadow: 0 10px 30px rgba(217,67,79,0.4), inset 0 1px 0 rgba(255,255,255,0.25); }
.cta:disabled { background: #243044; box-shadow: none; color: #6f7d92; }
.cta.busy { opacity: 0.7; }

.toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); padding: 14px 20px; border-radius: 14px; background: #3a1d24; border: 1px solid rgba(240,97,109,0.5); color: #ffd3d7; z-index: 10; max-width: 90vw; }

@container (max-width: 980px) {
  .grid { grid-template-columns: minmax(0, 1fr); grid-template-areas: "ring" "zones" "order" "sched"; grid-template-rows: none; }
  .ring-card { display: flex; align-items: center; gap: 22px; text-align: left; padding: 20px 22px; }
  .ring { width: 150px; margin: 0; flex: none; }
  .ring .track, .ring .prog { stroke-width: 18; }
  .ring-num { font-size: 46px; }
  .ring-label { font-size: 14px; margin-top: 2px; }
  .ring-sub { margin-top: 0; font-size: 17px; }
}
@container (max-width: 640px) {
  .app { padding: 14px 14px 24px; }
  .top { gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .brand { width: 44px; height: 44px; border-radius: 14px; }
  .brand .ic { width: 24px; height: 24px; }
  .spacer { display: none; }
  .icon-btn { width: 44px; height: 44px; border-radius: 14px; }
  h1 { font-size: 22px; }
  .status { font-size: 15px; margin-top: 3px; }
  .dot { width: 10px; height: 10px; }
  .chip { order: 5; width: 100%; height: 44px; font-size: 15px; padding: 0 16px; border-radius: 16px; }
  .grid { gap: 14px; }
  .card { border-radius: 24px; }
  .ring-card { padding: 16px; gap: 16px; }
  .ring { width: 116px; }
  .ring-num { font-size: 38px; }
  .ring-label { font-size: 13px; }
  .ring-sub { font-size: 15px; }
  .zones-card { padding: 18px 14px 0; }
  .zones-head { margin-bottom: 14px; }
  h2 { font-size: 21px; }
  .zones-head p { font-size: 14px; }
  .pill-btn { height: 40px; padding: 0 14px; font-size: 15px; border-radius: 14px; }
  .zones { gap: 10px; }
  .zone { min-height: 76px; gap: 10px; padding: 10px 8px 10px 10px; border-radius: 20px; }
  .zic { width: 40px; height: 40px; border-radius: 12px; }
  .zic .ic { width: 22px; height: 22px; }
  .badge { width: 17px; height: 17px; font-size: 10px; right: -5px; bottom: -5px; }
  .zn { font-size: 16px; }
  .zs { font-size: 12.5px; margin-top: 2px; }
  .stepper { padding: 3px; gap: 0; border-radius: 14px; }
  .stepper button { width: 34px; height: 42px; border-radius: 11px; }
  .stepper .ic { width: 18px; height: 18px; }
  .val { width: 40px; }
  .val b { font-size: 22px; }
  .val span { display: block; font-size: 11px; margin: -2px 0 0; }
  .foot { margin: 16px -14px 0; padding: 14px 14px calc(14px + env(safe-area-inset-bottom)); gap: 12px; border-radius: 0 0 24px 24px; }
  .foot .eyebrow { font-size: 11px; }
  .foot-main { font-size: 17px; margin-top: 2px; }
  .foot-sub { font-size: 13px; }
  .cta { height: 54px; padding: 0 20px; font-size: 17px; border-radius: 18px; gap: 8px; }
  .cta .ic { width: 22px; height: 22px; }
  .order-card { padding: 18px 16px; }
  .order li { grid-template-columns: 30px minmax(0, 1fr) auto auto; gap: 10px; font-size: 16px; padding: 8px 0; }
  .order .num { width: 30px; height: 30px; font-size: 12px; }
  .order li:not(:last-child)::after { left: 14px; top: 36px; }
  .order .min { font-size: 14px; }
  .sched-card { padding: 10px 12px; }
  .sched-name { font-size: 16px; }
  .sched-desc { font-size: 13px; }
  .sched-ic { width: 40px; height: 40px; }
  .toggle { width: 56px; height: 34px; }
  .toggle::after { width: 26px; height: 26px; }
  .toggle.on::after { transform: translateX(22px); }
}
`;

class IrrigationPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._plan = null;
    this._planRaw = undefined;
    this._planDirty = false;
    this._lastWatered = {};
    this._runSeen = new Map();
    this._forecast = null;
    this._showAllPrograms = false;
    this._busy = false;
    this._toast = "";
    this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
    this.shadowRoot.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches?.(".zone")) {
        e.preventDefault();
        this._onClick(e);
      }
    });
  }

  set hass(hass) {
    this._hass = hass;
    this._ensureSubscriptions();
    this._scheduleRender();
  }

  get hass() {
    return this._hass;
  }

  set narrow(v) {
    this._narrow = v;
    this._scheduleRender();
  }

  connectedCallback() {
    loadFont();
    this._ensureSubscriptions();
    this._tick = setInterval(() => this._render(), 5000);
    this._historyTimer = setInterval(() => this._loadHistory(), 15 * 60 * 1000);
    this._scheduleRender();
  }

  disconnectedCallback() {
    clearInterval(this._tick);
    clearInterval(this._historyTimer);
    this._unsubForecast?.();
    this._unsubForecast = null;
    this._subscribing = false;
    this._historyLoaded = false;
  }

  _ensureSubscriptions() {
    if (!this._hass || !this.isConnected) return;
    if (!this._historyLoaded) {
      this._historyLoaded = true;
      this._loadHistory();
    }
    if (!this._unsubForecast && !this._subscribing && this._hass.states[WEATHER_ENTITY]) {
      this._subscribing = true;
      this._hass.connection
        .subscribeMessage(
          (msg) => {
            this._forecast = msg.forecast || [];
            this._scheduleRender();
          },
          { type: "weather/subscribe_forecast", forecast_type: "daily", entity_id: WEATHER_ENTITY },
        )
        .then((unsub) => {
          if (this._subscribing) this._unsubForecast = unsub;
          else unsub();
        })
        .catch(() => {})
        .finally(() => {
          this._subscribing = false;
        });
    }
  }

  async _loadHistory() {
    if (!this._hass) return;
    const model = readModel(this._hass.states);
    const ids = model.stations.map((s) => s.entity);
    if (!ids.length) return;
    try {
      const res = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: new Date(Date.now() - HISTORY_DAYS * 864e5).toISOString(),
        entity_ids: ids,
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      });
      const last = {};
      for (const [id, rows] of Object.entries(res || {})) {
        rows.forEach((row, i) => {
          if (row.s !== "on") return;
          const next = rows[i + 1];
          last[id] = { at: (row.lc ?? row.lu) * 1000, end: next ? (next.lc ?? next.lu) * 1000 : null };
        });
      }
      this._lastWatered = last;
      this._scheduleRender();
    } catch (_) {
      /* history is decorative; keep the previous values */
    }
  }

  _scheduleRender() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this._render();
    });
  }

  _syncPlan(model) {
    const raw = this._hass.states[PLAN_ENTITY]?.state;
    if (this._planDirty) return;
    if (this._plan && raw === this._planRaw) return;
    this._planRaw = raw;
    this._plan = parsePlan(raw) || this._plan || defaultPlan(model);
    for (const s of model.stations) if (!this._plan.m[s.idx]) this._plan.m[s.idx] = 10;
  }

  _savePlan() {
    this._planDirty = true;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      const value = JSON.stringify({ m: this._plan.m, on: [...this._plan.on].sort((a, b) => a - b) });
      this._planRaw = value;
      try {
        if (this._hass.states[PLAN_ENTITY]) {
          await this._hass.callService("input_text", "set_value", { entity_id: PLAN_ENTITY, value });
        }
      } catch (err) {
        this._showToast(`Couldn't save the plan: ${err.message || err}`);
      } finally {
        this._planDirty = false;
      }
    }, 600);
  }

  _showToast(msg) {
    this._toast = msg;
    this._render();
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this._toast = "";
      this._render();
    }, 5000);
  }

  async _call(domain, service, data) {
    this._busy = true;
    this._render();
    try {
      await this._hass.callService(domain, service, data);
    } catch (err) {
      this._showToast(`${domain}.${service} failed: ${err.message || err}`);
    } finally {
      this._busy = false;
      this._render();
    }
  }

  _onClick(e) {
    const el = e.target.closest?.("[data-action]");
    if (!el || !this._hass) return;
    const model = this._model;
    if (!model) return;
    const action = el.dataset.action;
    const idx = el.dataset.idx !== undefined ? Number(el.dataset.idx) : null;
    const station = idx !== null ? model.stations.find((s) => s.idx === idx) : null;
    const plan = this._plan;

    switch (action) {
      case "menu":
        this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
        return;
      case "toggle":
        if (!station || !station.enabled || this._active) return;
        plan.on.has(idx) ? plan.on.delete(idx) : plan.on.add(idx);
        break;
      case "inc":
      case "dec":
        if (!station || this._active) return;
        plan.m[idx] = action === "inc" ? stepUp(plan.m[idx] || 10) : stepDown(plan.m[idx] || 10);
        if (station.enabled) plan.on.add(idx);
        break;
      case "all": {
        const usable = model.stations.filter((s) => s.enabled);
        if (usable.some((s) => plan.on.has(s.idx))) plan.on.clear();
        else usable.forEach((s) => plan.on.add(s.idx));
        break;
      }
      case "start": {
        const run = {};
        for (const s of model.stations) if (s.enabled && plan.on.has(s.idx)) run[s.idx] = Math.round(plan.m[s.idx] * 60);
        if (!Object.keys(run).length || !model.controller) return;
        this._call("opensprinkler", "run_once", { entity_id: model.controller.id, run_seconds: run });
        return;
      }
      case "stop":
        if (model.controller) this._call("opensprinkler", "stop", { entity_id: model.controller.id });
        return;
      case "program": {
        const p = model.programs.find((x) => x.idx === Number(el.dataset.program));
        if (p?.enabledEntity) this._call("switch", p.enabled ? "turn_off" : "turn_on", { entity_id: p.enabledEntity });
        return;
      }
      case "controller": {
        const c = model.controller;
        if (!c) return;
        if (c.state === "on" && !window.confirm("Turn off the OpenSprinkler controller? No watering will run, scheduled or manual, until it's turned back on.")) return;
        this._call("switch", c.state === "on" ? "turn_off" : "turn_on", { entity_id: c.id });
        return;
      }
      case "more":
        this._showAllPrograms = !this._showAllPrograms;
        this._render();
        return;
      default:
        return;
    }
    this._savePlan();
    this._render();
  }

  _fmtTime(ms) {
    const tf = this._hass?.locale?.time_format;
    const hour12 = tf === "12" ? true : tf === "24" ? false : undefined;
    return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12 });
  }

  _fmtDay(ms) {
    const d = new Date(ms);
    const today = new Date();
    const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date(today).setHours(0, 0, 0, 0)) / 864e5);
    if (diff === 0) return "today";
    if (diff === 1) return "tomorrow";
    if (diff > 1 && diff < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  _daysAgo(ms) {
    const diff = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(ms).setHours(0, 0, 0, 0)) / 864e5);
    if (diff <= 0) return "Watered today";
    if (diff === 1) return "Watered yesterday";
    return `Last watered ${diff} days ago`;
  }

  _clock(hms) {
    const [h, m] = String(hms || "").split(":").map(Number);
    if (!Number.isFinite(h)) return "";
    const d = new Date();
    d.setHours(h, m || 0, 0, 0);
    return this._fmtTime(d.getTime());
  }

  _describeProgram(p) {
    let when = p.type || "";
    if (p.type === "Weekly" && Number.isFinite(p.days0)) {
      const days = DAY_NAMES.filter((_, i) => p.days0 & (1 << i));
      if (days.length === 7) when = "Every day";
      else if ((p.days0 & 127) === 31) when = "Weekdays";
      else if ((p.days0 & 127) === 96) when = "Weekends";
      else when = days.join(", ") || "No days";
    } else if (p.type === "Interval") {
      when = p.interval ? `Every ${plural(p.interval, "day")}` : "Interval";
    } else if (p.type === "Single-run") {
      when = "One time";
    }
    const at = p.startType && p.startType !== "Midnight" ? p.startType.toLowerCase() : this._clock(p.startTime);
    return `${when} at ${at} · ${fmtDuration(p.totalMinutes)}`;
  }

  _rainChip(model) {
    if (model.rainDelay) {
      const until = model.rainStop ? ` until ${this._fmtDay(model.rainStop)} ${this._fmtTime(model.rainStop)}` : "";
      return { icon: "mdiUmbrellaOutline", text: `Rain delay${until}`, cls: "info" };
    }
    if (!this._forecast || !this._forecast.length) return null;
    const today = new Date().setHours(0, 0, 0, 0);
    for (const day of this._forecast.slice(0, 7)) {
      const rainy = RAIN_CONDITIONS.has(day.condition) || (day.precipitation_probability ?? 0) >= 50;
      if (!rainy) continue;
      const n = Math.round((new Date(day.datetime).setHours(0, 0, 0, 0) - today) / 864e5);
      if (n < 0) continue;
      const text = n === 0 ? "Rain today" : n === 1 ? "Rain tomorrow" : `Rain in ${n} days`;
      return { icon: "mdiWeatherPartlyRainy", text, cls: "" };
    }
    return { icon: "mdiWeatherSunny", text: "No rain this week", cls: "" };
  }

  _render() {
    if (!this._hass) return;
    const now = Date.now();
    const model = readModel(this._hass.states);
    this._model = model;
    this._syncPlan(model);
    const plan = this._plan;
    const ctrl = model.controller;
    const online = ctrl && !["unavailable", "unknown"].includes(ctrl.state);
    const ctrlOn = online && ctrl.state === "on";
    const delayMs = (ctrl?.stationDelay || 0) * 1000;

    // Current run: every station with a scheduled end still ahead of us.
    const queue = model.stations.filter((s) => s.end && s.end > now - 2000);
    const active = queue.length > 0;
    if (this._active && !active) this._loadHistory();
    this._active = active;
    if (active) for (const s of queue) this._runSeen.set(s.idx, { start: s.start, end: s.end });
    else this._runSeen.clear();
    const runRows = [...this._runSeen.entries()]
      .map(([idx, t]) => ({ ...model.stations.find((s) => s.idx === idx), start: t.start, end: t.end }))
      .filter((r) => r.name)
      .sort((a, b) => a.start - b.start);
    const current = queue.find((s) => s.running) || null;

    // Planned run (idle): stations run in index order with the controller's station delay between them.
    const selected = model.stations.filter((s) => s.enabled && plan.on.has(s.idx));
    let cursor = now;
    const planRows = selected.map((s, i) => {
      if (i > 0) cursor += delayMs;
      const start = cursor;
      cursor += plan.m[s.idx] * 60000;
      return { ...s, minutes: plan.m[s.idx], start };
    });
    const plannedMinutes = selected.reduce((sum, s) => sum + plan.m[s.idx], 0);
    const plannedEnd = cursor;

    // Header status
    let status = { dot: "", label: "Ready", detail: `${plural(selected.length, "zone")} set to water` };
    if (!online) status = { dot: "grey", label: "Offline", detail: "OpenSprinkler is unavailable" };
    else if (!ctrlOn) status = { dot: "grey", label: "Off", detail: "Controller is turned off" };
    else if (model.paused) status = { dot: "amber", label: "Paused", detail: model.pauseEnd ? `until ${this._fmtTime(model.pauseEnd)}` : "Watering is paused" };
    else if (active) {
      const left = Math.max(1, Math.ceil((Math.max(...queue.map((s) => s.end)) - now) / 60000));
      status = { dot: "blue", label: "Watering", detail: current ? `${current.name} · ${fmtDuration(left)} left` : `Next zone starting · ${fmtDuration(left)} left` };
    } else if (model.rainDelay) status = { dot: "amber", label: "Rain delay", detail: model.rainStop ? `until ${this._fmtDay(model.rainStop)} ${this._fmtTime(model.rainStop)}` : "Rain delay active" };

    const chip = this._rainChip(model);

    // Ring
    let ringNum, ringLabel, ringSub, progress = 0;
    if (active) {
      const t0 = Math.min(...runRows.map((r) => r.start));
      const t1 = Math.max(...runRows.map((r) => r.end));
      progress = Math.min(1, Math.max(0, (now - t0) / Math.max(1, t1 - t0)));
      ringNum = Math.max(0, Math.ceil((t1 - now) / 60000));
      ringLabel = ringNum === 1 ? "minute left" : "minutes left";
      ringSub = current
        ? `Watering <b>${esc(current.name)}</b> · done at <b>${this._fmtTime(t1)}</b>`
        : `Between zones · done at <b>${this._fmtTime(t1)}</b>`;
    } else {
      ringNum = Math.round(plannedMinutes);
      ringLabel = ringNum === 1 ? "minute planned" : "minutes planned";
      ringSub = selected.length
        ? `Start now and it's done at <b>${this._fmtTime(plannedEnd)}</b>`
        : "Pick a zone to get started";
    }
    const R = 92;
    const C = 2 * Math.PI * R;
    const ring = `
      <div class="ring">
        <svg viewBox="0 0 220 220">
          <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8ee0ff"/><stop offset="1" stop-color="#1d8fe8"/></linearGradient></defs>
          <circle class="track" cx="110" cy="110" r="${R}"/>
          ${progress > 0 ? `<circle class="prog ${model.paused ? "paused" : ""}" cx="110" cy="110" r="${R}" stroke-dasharray="${(C * progress).toFixed(1)} ${C.toFixed(1)}"/>` : ""}
        </svg>
        <div class="ring-center"><div class="ring-num">${ringNum}</div><div class="ring-label">${ringLabel}</div></div>
      </div>`;

    // Watering order
    const lastRunText = model.lastRun ? `Last run ${this._daysAgo(model.lastRun).replace(/^(Last watered|Watered) /, "")}` : "";
    let orderList;
    if (active) {
      orderList = runRows
        .map((r, i) => {
          const done = r.end <= now;
          const isNow = !done && r.start <= now;
          const mins = Math.round((r.end - r.start) / 60000);
          const num = done ? svg("mdiCheck") : i + 1;
          return `<li class="${done ? "done" : isNow ? "now" : ""}"><span class="num">${num}</span><span class="name">${esc(r.name)}</span><span class="min">${mins} min</span><span class="time">${this._fmtTime(r.start)}</span></li>`;
        })
        .join("");
    } else {
      orderList = planRows
        .map((r, i) => `<li><span class="num">${i + 1}</span><span class="name">${esc(r.name)}</span><span class="min">${r.minutes} min</span><span class="time">${this._fmtTime(r.start)}</span></li>`)
        .join("");
    }
    const delayNote = delayMs && (active ? runRows.length : planRows.length) > 1 ? `<div class="note">${fmtDuration(delayMs / 60000)} pause between zones</div>` : "";
    const order = `
      <div class="card order-card">
        <div class="card-head"><span class="eyebrow">${active ? "Now watering" : "Watering order"}</span><span class="muted">${esc(lastRunText)}</span></div>
        ${delayNote}
        ${orderList ? `<ol class="order">${orderList}</ol>` : `<div class="empty">No zones selected.</div>`}
      </div>`;

    // Schedules
    const programs = [...model.programs].sort((a, b) => (b.enabled ? 1 : 0) - (a.enabled ? 1 : 0) || a.idx - b.idx);
    const shown = this._showAllPrograms ? programs : programs.filter((p) => p.enabled);
    const hiddenCount = programs.length - shown.length;
    const nextRun =
      ctrlOn && model.nextRun && model.nextRun.at > now
        ? `<div class="next">Next: ${esc(model.nextRun.program)} · ${this._fmtDay(model.nextRun.at)} ${this._fmtTime(model.nextRun.at)}</div>`
        : "";
    const sched = `
      <div class="card sched-card">
        ${nextRun}
        ${shown
          .map(
            (p) => `
          <div class="sched-row ${p.enabled ? "on" : ""}">
            <div class="sched-ic">${svg("mdiCalendarClock")}</div>
            <div class="sched-text"><div class="sched-name">${esc(p.name)}</div><div class="sched-desc">${p.enabled ? "On" : "Off"} · ${esc(this._describeProgram(p))}</div></div>
            <button class="toggle ${p.enabled ? "on" : ""}" data-action="program" data-program="${p.idx}" aria-pressed="${p.enabled}" aria-label="${esc(p.name)} schedule"></button>
          </div>`,
          )
          .join("")}
        ${
          programs.length > 1 && (hiddenCount || this._showAllPrograms)
            ? `<button class="more" data-action="more">${this._showAllPrograms ? "Show active schedules only" : `Show ${plural(hiddenCount, "more schedule")}`}</button>`
            : ""
        }
        <div class="sched-row ${ctrlOn ? "on" : ""}">
          <div class="sched-ic">${svg("mdiPower")}</div>
          <div class="sched-text"><div class="sched-name">Controller</div><div class="sched-desc">${
            !online ? "Unavailable" : ctrlOn ? `On · water level ${esc(model.waterLevel ?? "—")}%` : "Off · no watering will run"
          }</div></div>
          <button class="toggle ${ctrlOn ? "on" : ""}" data-action="controller" aria-pressed="${ctrlOn}" aria-label="Controller" ${online ? "" : "disabled"}></button>
        </div>
      </div>`;

    // Zones
    const usable = model.stations.filter((s) => s.enabled);
    const anyOn = usable.some((s) => plan.on.has(s.idx));
    const zoneRows = [...model.stations.filter((s) => s.enabled), ...model.stations.filter((s) => !s.enabled)]
      .map((s) => {
        const on = s.enabled && (active ? !!s.end && s.end > now : plan.on.has(s.idx));
        const minutes = plan.m[s.idx];
        let sub;
        // Idle: bar length shows planned time (30 min = full). Running: bar shows progress.
        let fill = active ? 0 : (Math.min(minutes, 30) / 30) * 100;
        if (!s.enabled) sub = "Disabled on the controller";
        else if (s.running && s.end) {
          sub = `Watering · ${fmtDuration(Math.max(1, Math.ceil((s.end - now) / 60000)))} left`;
          fill = s.start ? Math.min(100, ((now - s.start) / Math.max(1, s.end - s.start)) * 100) : 0;
        } else if (active && s.end && s.start > now) sub = `Up next · starts ${this._fmtTime(s.start)}`;
        else {
          const last = this._lastWatered[s.entity];
          sub = last ? this._daysAgo(last.at) : "Not watered recently";
        }
        const shownMinutes = active && s.end && s.start ? Math.round((s.end - s.start) / 60000) : minutes;
        const lockSteppers = active || !s.enabled;
        return `
        <div class="zone ${on ? "on" : ""} ${s.running ? "running" : ""} ${s.enabled ? "" : "disabled"}" data-action="toggle" data-idx="${s.idx}" role="button" tabindex="0" aria-pressed="${on}">
          <div class="fill" style="width:${fill.toFixed(1)}%"></div>
          <div class="zic">${svg(zoneIcon(s.name))}<span class="badge">${s.idx + 1}</span></div>
          <div class="zt"><div class="zn">${esc(s.name)}</div><div class="zs">${esc(sub)}</div></div>
          ${
            s.enabled
              ? `<div class="stepper" data-action="noop">
            <button data-action="dec" data-idx="${s.idx}" aria-label="Less time for ${esc(s.name)}" ${lockSteppers || minutes <= 1 ? "disabled" : ""}>${svg("mdiMinus")}</button>
            <div class="val"><b>${shownMinutes}</b><span>min</span></div>
            <button data-action="inc" data-idx="${s.idx}" aria-label="More time for ${esc(s.name)}" ${lockSteppers || minutes >= MAX_MINUTES ? "disabled" : ""}>${svg("mdiPlus")}</button>
          </div>`
              : ""
          }
        </div>`;
      })
      .join("");

    let foot;
    if (active) {
      const t1 = Math.max(...queue.map((s) => s.end));
      const left = queue.filter((s) => s.end > now).length;
      foot = `
        <div class="foot-text"><div class="eyebrow">Watering now</div><div class="foot-main">${plural(left, "zone")} left · ${fmtDuration(Math.max(1, Math.ceil((t1 - now) / 60000)))}</div><div class="foot-sub">Done at about ${this._fmtTime(t1)}</div></div>
        <button class="cta stop ${this._busy ? "busy" : ""}" data-action="stop" ${this._busy ? "disabled" : ""}>${svg("mdiStop")} Stop</button>`;
    } else {
      const canStart = ctrlOn && !model.paused && selected.length > 0 && !this._busy;
      const why = !ctrlOn ? "Turn the controller on to water" : model.paused ? "Watering is paused" : selected.length ? `Done at about ${this._fmtTime(plannedEnd)}` : "Tap a zone to add it";
      foot = `
        <div class="foot-text"><div class="eyebrow">Ready to water</div><div class="foot-main">${plural(selected.length, "zone")} · ${fmtDuration(plannedMinutes)}</div><div class="foot-sub">${esc(why)}</div></div>
        <button class="cta ${this._busy ? "busy" : ""}" data-action="start" ${canStart ? "" : "disabled"}>${svg("mdiPlay")} Start watering</button>`;
    }

    const html = `
      <style>${CSS}</style>
      <div class="app">
        <header class="top">
          ${this._narrow ? `<button class="icon-btn" data-action="menu" aria-label="Menu">${svg("mdiMenu")}</button>` : ""}
          <div class="brand">${svg("mdiSprinklerVariant")}</div>
          <div class="titles">
            <h1>Garden Irrigation</h1>
            <div class="status"><span class="dot ${status.dot}"></span><b>${status.label}</b><span class="muted">·</span><span class="muted detail">${esc(status.detail)}</span></div>
          </div>
          <div class="spacer"></div>
          ${chip ? `<div class="chip ${chip.cls}">${svg(chip.icon)}<span>${esc(chip.text)}</span></div>` : ""}
        </header>
        ${!online ? `<div class="banner">${svg("mdiAlertCircleOutline")}<span>Can't reach OpenSprinkler right now — showing the last known state.</span></div>` : ""}
        <main class="grid">
          <div class="card ring-card">${ring}<div class="ring-sub">${ringSub}</div></div>
          <section class="card zones-card">
            <div class="zones-head">
              <div><h2>Zones</h2><p class="muted">${active ? "Watering in progress — stop to make changes." : "Tap a zone to include it. Use − and + to change its time."}</p></div>
              ${active ? "" : `<button class="pill-btn" data-action="all">${anyOn ? "All off" : "All on"}</button>`}
            </div>
            <div class="zones">${zoneRows}</div>
            <div class="foot">${foot}</div>
          </section>
          ${order}
          ${sched}
        </main>
        ${this._toast ? `<div class="toast" role="alert">${esc(this._toast)}</div>` : ""}
      </div>`;

    if (html !== this._html) {
      this._html = html;
      this.shadowRoot.innerHTML = html;
    }
  }
}

function loadFont() {
  if (document.getElementById("irrigation-panel-font")) return;
  const link = document.createElement("link");
  link.id = "irrigation-panel-font";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

if (!customElements.get("irrigation-panel")) customElements.define("irrigation-panel", IrrigationPanel);
