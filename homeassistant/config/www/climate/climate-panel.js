// Climate panel: Honeywell thermostat state plus what the HVAC is costing at Fort Collins ToD rates.
// Cost sensors come from packages/hvac_cost.yaml; prices from custom_templates/fc_tod.jinja.

const ICONS = {
  mdiThermostat: "M16.95,16.95L14.83,14.83C15.55,14.1 16,13.1 16,12C16,11.26 15.79,10.57 15.43,10L17.6,7.81C18.5,9 19,10.43 19,12C19,13.93 18.22,15.68 16.95,16.95M12,5C13.57,5 15,5.5 16.19,6.4L14,8.56C13.43,8.21 12.74,8 12,8A4,4 0 0,0 8,12C8,13.1 8.45,14.1 9.17,14.83L7.05,16.95C5.78,15.68 5,13.93 5,12A7,7 0 0,1 12,5M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12C22,6.47 17.5,2 12,2Z",
  mdiFire: "M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2M14.5 17.5C14.22 17.74 13.76 18 13.4 18.1C12.28 18.5 11.16 17.94 10.5 17.28C11.69 17 12.4 16.12 12.61 15.23C12.78 14.43 12.46 13.77 12.33 13C12.21 12.26 12.23 11.63 12.5 10.94C12.69 11.32 12.89 11.7 13.13 12C13.9 13 15.11 13.44 15.37 14.8C15.41 14.94 15.43 15.08 15.43 15.23C15.46 16.05 15.1 16.95 14.5 17.5H14.5Z",
  mdiSnowflake: "M20.79,13.95L18.46,14.57L16.46,13.44V10.56L18.46,9.43L20.79,10.05L21.31,8.12L19.54,7.65L20,5.88L18.07,5.36L17.45,7.69L15.45,8.82L13,7.38V5.12L14.71,3.41L13.29,2L12,3.29L10.71,2L9.29,3.41L11,5.12V7.38L8.5,8.82L6.5,7.69L5.92,5.36L4,5.88L4.47,7.65L2.7,8.12L3.22,10.05L5.55,9.43L7.55,10.56V13.45L5.55,14.58L3.22,13.96L2.7,15.89L4.47,16.36L4,18.12L5.93,18.64L6.55,16.31L8.55,15.18L11,16.62V18.88L9.29,20.59L10.71,22L12,20.71L13.29,22L14.7,20.59L13,18.88V16.62L15.5,15.17L17.5,16.3L18.12,18.63L20,18.12L19.53,16.35L21.3,15.88L20.79,13.95M9.5,10.56L12,9.11L14.5,10.56V13.44L12,14.89L9.5,13.44V10.56Z",
  mdiFan: "M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12.5,2C17,2 17.11,5.57 14.75,6.75C13.76,7.24 13.32,8.29 13.13,9.22C13.61,9.42 14.03,9.73 14.35,10.13C18.05,8.13 22.03,8.92 22.03,12.5C22.03,17 18.46,17.1 17.28,14.73C16.78,13.74 15.72,13.3 14.79,13.11C14.59,13.59 14.28,14 13.88,14.34C15.87,18.03 15.08,22 11.5,22C7,22 6.91,18.42 9.27,17.24C10.25,16.75 10.69,15.71 10.89,14.79C10.4,14.59 9.97,14.27 9.65,13.87C5.96,15.85 2,15.07 2,11.5C2,7 5.56,6.89 6.74,9.26C7.24,10.25 8.29,10.68 9.22,10.87C9.41,10.39 9.73,9.97 10.14,9.65C8.15,5.96 8.94,2 12.5,2Z",
  mdiPower: "M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13",
  mdiAutorenew: "M12,6V9L16,5L12,1V4A8,8 0 0,0 4,12C4,13.57 4.46,15.03 5.24,16.26L6.7,14.8C6.25,13.97 6,13 6,12A6,6 0 0,1 12,6M18.76,7.74L17.3,9.2C17.74,10.04 18,11 18,12A6,6 0 0,1 12,18V15L8,19L12,23V20A8,8 0 0,0 20,12C20,10.43 19.54,8.97 18.76,7.74Z",
  mdiMenu: "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",
  mdiMinus: "M19,13H5V11H19V13Z",
  mdiPlus: "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z",
  mdiAlertCircleOutline: "M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z",
  mdiChevronDown: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  mdiChevronUp: "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z",
  mdiFlash: "M7,2V13H10V22L17,10H13L17,2H7Z",
  mdiInformationOutline: "M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z",
  mdiClockOutline: "M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z",
  mdiLinkVariantOff: "M2,5.27L3.28,4L20,20.72L18.73,22L13.9,17.17L11.29,19.78C9.34,21.73 6.17,21.73 4.22,19.78C2.27,17.83 2.27,14.66 4.22,12.71L5.71,11.22C5.7,12.04 5.83,12.86 6.11,13.65L5.64,14.12C4.46,15.29 4.46,17.19 5.64,18.36C6.81,19.54 8.71,19.54 9.88,18.36L12.5,15.76L10.88,14.15C10.87,14.39 10.77,14.64 10.59,14.83C10.2,15.22 9.56,15.22 9.17,14.83C8.12,13.77 7.63,12.37 7.72,11L2,5.27M12.71,4.22C14.66,2.27 17.83,2.27 19.78,4.22C21.73,6.17 21.73,9.34 19.78,11.29L18.29,12.78C18.3,11.96 18.17,11.14 17.89,10.36L18.36,9.88C19.54,8.71 19.54,6.81 18.36,5.64C17.19,4.46 15.29,4.46 14.12,5.64L10.79,8.97L9.38,7.55L12.71,4.22M13.41,9.17C13.8,8.78 14.44,8.78 14.83,9.17C16.2,10.54 16.61,12.5 16.06,14.23L14.28,12.46C14.23,11.78 13.94,11.11 13.41,10.59C13,10.2 13,9.56 13.41,9.17Z",
};

const E = {
  tariff: "sensor.fc_electric_tariff",
  elecRate: "sensor.hvac_electric_cost_rate",
  gasRate: "sensor.hvac_gas_cost_rate",
  elecOn: "sensor.hvac_electric_cost_monthly_on_peak",
  elecOff: "sensor.hvac_electric_cost_monthly_off_peak",
  kwhOn: "sensor.hvac_energy_monthly_on_peak",
  kwhOff: "sensor.hvac_energy_monthly_off_peak",
  gasCost: "sensor.hvac_gas_cost_monthly",
  therms: "sensor.hvac_gas_usage_monthly",
  heatH: "sensor.hvac_heating_runtime_monthly",
  coolH: "sensor.hvac_cooling_runtime_monthly",
  fanH: "sensor.hvac_fan_runtime_monthly",
  activity: "sensor.hvac_activity",
};
const STAT_IDS = [E.gasCost, E.elecOn, E.elecOff, E.therms, E.kwhOn, E.kwhOff];

const ASSUMPTIONS = [
  { entity: "input_number.hvac_ac_kw", label: "AC condenser", unit: "kW", step: 0.1, digits: 1, help: "Condenser nameplate: RLA × 240 V ÷ 1000" },
  { entity: "input_number.hvac_blower_kw", label: "Furnace blower", unit: "kW", step: 0.05, digits: 2, help: "Runs whenever heating, cooling or fan-only is on" },
  { entity: "input_number.hvac_furnace_btuh", label: "Furnace gas input", unit: "BTU/h", step: 5000, digits: 0, help: "“Input” on the furnace rating plate" },
  { entity: "input_number.hvac_gas_usd_per_therm", label: "Gas price, all-in", unit: "$/therm", step: 0.01, digits: 2, help: "Last Xcel bill: total gas charges ÷ therms" },
];

const MODE_META = {
  heat: { label: "Heat", icon: "mdiFire" },
  cool: { label: "Cool", icon: "mdiSnowflake" },
  heat_cool: { label: "Auto", icon: "mdiAutorenew" },
  auto: { label: "Auto", icon: "mdiAutorenew" },
  fan_only: { label: "Fan", icon: "mdiFan" },
  off: { label: "Off", icon: "mdiPower" },
};
const MODE_ORDER = ["heat", "cool", "heat_cool", "auto", "fan_only", "off"];
const ACTIVITY_LABEL = { heating: "Heating", cooling: "Cooling", fan: "Fan only" };
const DAYS = 7;
const BAD = new Set(["unavailable", "unknown"]);
const PLOT_H = 170;

const svg = (name, cls = "") =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ""}"/></svg>`;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function num(st) {
  if (!st || BAD.has(st.state)) return null;
  const v = parseFloat(st.state);
  return Number.isFinite(v) ? v : null;
}

function money(v) {
  if (v == null) return "—";
  return v >= 100 ? `$${Math.round(v).toLocaleString()}` : `$${v.toFixed(2)}`;
}

const dollars = (v) => `$${Math.round(v).toLocaleString()}`;

function fmtNum(v, digits) {
  if (v == null) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtHours(h) {
  if (h == null) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(1)} h`;
}

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

const monthKey = (d) => `${d.getFullYear()}-${d.getMonth()}`;

// Same rules as the hvac_activity template sensor, read straight from the thermostat.
function activityOf(cl) {
  if (!cl || BAD.has(cl.state)) return null;
  const a = cl.attributes || {};
  if (a.hvac_action === "cooling") return "cooling";
  if (a.hvac_action === "heating") return "heating";
  if (a.hvac_action === "fan" || a.fan_action === "running") return "fan";
  if (cl.state === "off") return "off";
  return "idle";
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
  --green: #22c55e;
  --amber: #f5b041;
  --red: #f0616d;
  --heat: #d95926;
  --cool: #3987e5;
  --offpk: #199e70;
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
.num { font-variant-numeric: tabular-nums; }

.app { max-width: 1480px; margin: 0 auto; padding: 28px 28px 40px; }

.top { display: flex; align-items: center; gap: 18px; margin-bottom: 26px; }
.brand { width: 76px; height: 76px; border-radius: 22px; display: grid; place-items: center; flex: none;
  background: linear-gradient(160deg, #ffb08a, #d95926); color: #fff;
  box-shadow: 0 10px 30px rgba(217, 89, 38, 0.30), inset 0 1px 0 rgba(255,255,255,0.35); }
.brand.cool { background: linear-gradient(160deg, #8fc0ff, #3987e5); box-shadow: 0 10px 30px rgba(57, 135, 229, 0.35), inset 0 1px 0 rgba(255,255,255,0.35); }
.brand.idle { background: linear-gradient(160deg, #3a4a61, #243246); box-shadow: none; }
.brand .ic { width: 38px; height: 38px; }
.titles { flex: 1 1 0; min-width: 0; }
h1 { margin: 0; font-size: 34px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.1; }
.status { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 18px; white-space: nowrap; overflow: hidden; }
.status b { font-weight: 600; }
.status .detail { overflow: hidden; text-overflow: ellipsis; }
.dot { width: 12px; height: 12px; border-radius: 50%; background: var(--green); flex: none; }
.dot.heat { background: var(--heat); box-shadow: 0 0 10px var(--heat); }
.dot.cool { background: var(--cool); box-shadow: 0 0 10px var(--cool); }
.dot.fan { background: var(--muted); }
.dot.live { animation: pulse 1.6s ease-in-out infinite; }
.dot.grey { background: #64748b; }
@keyframes pulse { 50% { opacity: 0.35; } }
.spacer { flex: 1; }
.chip { display: flex; align-items: center; gap: 10px; height: 54px; padding: 0 22px; border-radius: 20px;
  background: var(--card-2); border: 1px solid var(--line); font-weight: 600; font-size: 17px; white-space: nowrap; }
.chip .ic { color: var(--green); }
.chip.peak { border-color: rgba(245, 176, 65, 0.45); background: rgba(245, 176, 65, 0.10); }
.chip.peak .ic { color: var(--amber); }
.icon-btn { width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; background: var(--card-2); border: 1px solid var(--line); flex: none; }

.banner { margin: -8px 0 20px; padding: 14px 18px; border-radius: 16px; display: flex; gap: 10px; align-items: flex-start;
  background: rgba(240, 97, 109, 0.12); border: 1px solid rgba(240, 97, 109, 0.35); color: #ffd3d7; font-size: 16px; line-height: 1.4; }
.banner.info { background: rgba(76, 195, 255, 0.08); border-color: rgba(76, 195, 255, 0.30); color: #d4efff; }
.banner .ic { margin-top: 1px; }
.banner code { font-size: 14px; background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 6px; }

.grid { display: grid; gap: 22px; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.3fr); align-items: start; }
.col { display: flex; flex-direction: column; gap: 22px; min-width: 0; }
.card { background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line); border-radius: 30px; }
.hero { order: 1; padding: 30px 28px 26px; }
.month { order: 2; padding: 24px 28px; }
.hist { order: 3; padding: 24px 28px; }
.days { order: 4; padding: 24px 28px; }
.assume { order: 5; padding: 8px 12px; }

.card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.eyebrow { font-size: 13px; letter-spacing: 0.12em; font-weight: 600; color: var(--muted); text-transform: uppercase; }
.note { font-size: 14px; color: var(--muted); margin-top: 10px; line-height: 1.45; }
.note.warn { color: #ffe1ad; }
.empty { margin-top: 14px; color: var(--muted); font-size: 16px; line-height: 1.45; }

/* Hero */
.temp-row { display: flex; align-items: flex-end; gap: 16px; }
.temp { font-size: 84px; font-weight: 700; line-height: 0.95; letter-spacing: -0.03em; }
.temp-label { font-size: 18px; color: #c3cedd; padding-bottom: 8px; }
.facts { margin-top: 10px; font-size: 17px; color: var(--muted); }
.divider { height: 1px; background: var(--line); margin: 24px 0; }
.sp-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.sp-row + .sp-row { margin-top: 14px; }
.sp-label { font-size: 20px; font-weight: 600; }
.sp-label small { display: block; font-size: 14px; color: var(--muted); font-weight: 400; margin-top: 2px; }
.stepper { display: flex; align-items: center; gap: 4px; padding: 7px; border-radius: 22px; background: #1a2435; border: 1px solid var(--line); flex: none; }
.stepper button { width: 62px; height: 62px; border-radius: 17px; background: #243044; display: grid; place-items: center; }
.stepper button:not(:disabled):active { background: #2f3d55; }
.stepper button:disabled { opacity: 0.35; }
.val { min-width: 96px; text-align: center; font-variant-numeric: tabular-nums; }
.val b { font-size: 44px; font-weight: 600; letter-spacing: -0.02em; }
.val.pending b { color: var(--accent); }
.stepper.disabled .val b { color: #6f7d92; }
.sp-why { margin-top: 12px; font-size: 15px; color: var(--muted); min-height: 20px; }
.modes { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 8px; margin-top: 20px; }
.mode { height: 54px; border-radius: 16px; background: #1a2435; border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; font-size: 16px; color: #c3cedd; }
.mode .ic { width: 20px; height: 20px; color: #6f7d92; }
.mode.on { color: var(--text); border-color: rgba(238, 243, 250, 0.35); background: #222e42; }
.mode.on.heat .ic { color: var(--heat); }
.mode.on.cool .ic { color: var(--cool); }
.mode.on.heat_cool .ic, .mode.on.auto .ic { color: var(--accent); }
.mode.on.off .ic { color: var(--text); }
.mode:disabled { opacity: 0.45; }
.now-cost { display: flex; gap: 14px; align-items: flex-start; }
.now-ic { width: 46px; height: 46px; border-radius: 14px; background: #1b2638; display: grid; place-items: center; color: #aeb9c9; flex: none; }
.now-main { font-size: 21px; font-weight: 600; }
.now-sub { margin-top: 3px; font-size: 15px; color: var(--muted); line-height: 1.4; }

/* This month */
.mtd { display: flex; align-items: baseline; gap: 18px; flex-wrap: wrap; margin-top: 10px; }
.mtd-total { font-size: 56px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; }
.mtd-proj { font-size: 18px; color: #c3cedd; }
.mtd-proj b { color: var(--text); font-weight: 600; }
.rows { margin-top: 18px; display: flex; flex-direction: column; }
.row { display: grid; grid-template-columns: 14px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px 0; }
.row + .row { border-top: 1px solid var(--line); }
.sw { width: 14px; height: 14px; border-radius: 4px; display: inline-block; flex: none; }
.sw.gas { background: var(--heat); }
.sw.on { background: var(--cool); }
.sw.off { background: var(--offpk); }
.row-name { font-size: 17px; font-weight: 500; }
.row-detail { font-size: 14px; color: var(--muted); margin-top: 2px; }
.row-val { font-size: 20px; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; }
.runtime { margin-top: 6px; font-size: 14px; color: var(--muted); }

/* Monthly history */
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 12px; font-size: 14px; color: #c3cedd; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend .sw { width: 11px; height: 11px; border-radius: 3px; }
.legend .band { width: 14px; height: 11px; border-radius: 3px; background: rgba(245, 176, 65, 0.28); }
.link-btn { color: var(--accent); font-weight: 600; font-size: 15px; padding: 6px 2px; }
.chart { margin-top: 16px; }
.plot { position: relative; height: ${PLOT_H + 26}px; border-bottom: 1px solid rgba(148, 170, 200, 0.35); }
.gl { position: absolute; left: 0; right: 0; border-top: 1px dashed rgba(148, 170, 200, 0.14); }
.gl span { position: absolute; left: 0; top: -9px; font-size: 12px; color: var(--muted); background: var(--card); padding-right: 6px; font-variant-numeric: tabular-nums; }
.cols, .xl { position: absolute; inset: 0 0 0 44px; display: flex; gap: 8px; }
.xl { position: static; padding-left: 44px; margin-top: 8px; }
.bcol { position: relative; flex: 1 1 0; min-width: 0; max-width: 64px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; outline: none; }
.xl > div { flex: 1 1 0; min-width: 0; max-width: 64px; text-align: center; font-size: 13px; color: var(--muted); white-space: nowrap; }
.xl small { display: block; font-size: 11px; }
.bar-total { font-size: 13px; font-weight: 600; margin-bottom: 4px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.stack { width: 100%; max-width: 40px; display: flex; flex-direction: column; gap: 2px; }
.seg { display: block; flex: 1 1 0; min-height: 0; }
.stack > .seg:first-child { border-radius: 4px 4px 0 0; }
.seg.gas { background: var(--heat); }
.seg.on { background: var(--cool); }
.seg.off { background: var(--offpk); }
.bcol:hover .stack, .bcol:focus .stack { filter: brightness(1.15); }
.tip { display: none; position: absolute; bottom: calc(100% - 20px); z-index: 5; width: 230px; padding: 12px 14px; border-radius: 14px;
  background: #1b2638; border: 1px solid rgba(148,170,200,0.25); box-shadow: 0 10px 30px rgba(0,0,0,0.45); font-size: 14px; line-height: 1.6; color: #c3cedd; pointer-events: none; }
.tip b { color: var(--text); font-weight: 600; }
.tip .sw { width: 10px; height: 10px; margin-right: 6px; border-radius: 3px; }
.tip.l { left: 0; } .tip.r { right: 0; }
.bcol:hover .tip, .bcol:focus .tip { display: block; }
table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 15px; font-variant-numeric: tabular-nums; }
th, td { padding: 8px 6px; text-align: right; border-bottom: 1px solid var(--line); }
th:first-child, td:first-child { text-align: left; }
th { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); font-weight: 600; }

/* Last 7 days */
.day { display: grid; grid-template-columns: 64px minmax(0, 1fr) 60px; gap: 12px; align-items: center; padding: 6px 0; }
.day-name { font-size: 15px; color: #c3cedd; }
.day-rt { font-size: 15px; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
.strip { position: relative; height: 26px; border-radius: 7px; background: #1a2435; overflow: hidden; }
.strip i { position: absolute; top: 0; bottom: 0; display: block; }
.strip .pk { background: rgba(245, 176, 65, 0.22); }
.strip .nd { background: repeating-linear-gradient(135deg, rgba(148,170,200,0.10) 0 4px, transparent 4px 8px); }
.strip .heating { background: var(--heat); top: 4px; bottom: 4px; min-width: 2px; border-radius: 2px; }
.strip .cooling { background: var(--cool); top: 4px; bottom: 4px; min-width: 2px; border-radius: 2px; }
.strip .fan { background: #8593a8; top: 10px; bottom: 10px; min-width: 2px; border-radius: 2px; }
.strip .future { background: var(--card); }
.axis { display: grid; grid-template-columns: 64px minmax(0, 1fr) 60px; gap: 12px; margin-top: 4px; }
.ticks { position: relative; height: 16px; font-size: 12px; color: var(--muted); }
.ticks span { position: absolute; transform: translateX(-50%); white-space: nowrap; }
.ticks span:first-child { transform: none; }
.ticks span:last-child { transform: translateX(-100%); }

/* Assumptions */
.disclose { width: 100%; display: flex; align-items: center; gap: 14px; padding: 14px 12px; text-align: left; }
.disclose .txt { flex: 1; min-width: 0; }
.disclose .sub { font-size: 14px; color: var(--muted); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.as-row { display: flex; align-items: center; gap: 14px; padding: 12px; }
.as-row + .as-row { border-top: 1px solid var(--line); }
.as-text { flex: 1; min-width: 0; }
.as-name { font-size: 17px; font-weight: 600; }
.as-help { font-size: 13px; color: var(--muted); margin-top: 2px; }
.stepper.sm { padding: 4px; border-radius: 16px; }
.stepper.sm button { width: 44px; height: 44px; border-radius: 12px; }
.stepper.sm .ic { width: 20px; height: 20px; }
.stepper.sm .val { min-width: 92px; }
.stepper.sm .val b { font-size: 20px; }
.stepper.sm .val span { display: block; font-size: 11px; color: var(--muted); }
.as-foot { padding: 4px 12px 14px; }

.toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); padding: 14px 20px; border-radius: 14px; background: #3a1d24; border: 1px solid rgba(240,97,109,0.5); color: #ffd3d7; z-index: 10; max-width: 90vw; }

@container (max-width: 980px) {
  .grid { display: flex; flex-direction: column; align-items: stretch; }
  .col { display: contents; }
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
  .banner { font-size: 14px; padding: 12px 14px; margin: 0 0 14px; }
  .grid { gap: 14px; }
  .card { border-radius: 24px; }
  .hero { padding: 20px 16px 18px; }
  .month, .hist, .days { padding: 18px 16px; }
  .assume { padding: 4px 4px; }
  .temp { font-size: 52px; }
  .temp-label { font-size: 15px; padding-bottom: 4px; }
  .facts { font-size: 14px; margin-top: 6px; }
  .divider { margin: 16px 0; }
  .sp-label { font-size: 17px; }
  .sp-label small { font-size: 13px; }
  .stepper { padding: 4px; border-radius: 16px; }
  .stepper button { width: 44px; height: 44px; border-radius: 12px; }
  .stepper .ic { width: 20px; height: 20px; }
  .val { min-width: 64px; }
  .val b { font-size: 28px; }
  .sp-why { font-size: 13px; margin-top: 10px; }
  .modes { gap: 6px; margin-top: 16px; }
  .mode { height: 46px; font-size: 14px; gap: 5px; border-radius: 13px; }
  .mode .ic { width: 17px; height: 17px; }
  .now-ic { width: 40px; height: 40px; border-radius: 12px; }
  .now-main { font-size: 17px; }
  .now-sub { font-size: 13px; }
  .eyebrow { font-size: 11px; }
  .mtd-total { font-size: 40px; }
  .mtd-proj { font-size: 15px; }
  .row { padding: 10px 0; gap: 10px; }
  .row-name { font-size: 15px; }
  .row-detail { font-size: 12.5px; }
  .row-val { font-size: 17px; }
  .runtime, .note { font-size: 12.5px; }
  .legend { font-size: 12.5px; gap: 4px 12px; }
  .cols { left: 36px; gap: 4px; }
  .xl { padding-left: 36px; gap: 4px; }
  .xl > div { font-size: 11px; }
  .xl small { font-size: 9.5px; }
  .gl span { font-size: 11px; }
  .bar-total { font-size: 11.5px; }
  .tip { width: 200px; font-size: 13px; }
  .day { grid-template-columns: 44px minmax(0, 1fr) 46px; gap: 8px; }
  .axis { grid-template-columns: 44px minmax(0, 1fr) 46px; gap: 8px; }
  .day-name, .day-rt { font-size: 13px; }
  .strip { height: 22px; }
  .ticks { font-size: 10.5px; }
  .disclose { padding: 12px 10px; }
  .as-row { padding: 10px; gap: 10px; }
  .as-name { font-size: 15px; }
  .as-help { font-size: 12px; }
  .stepper.sm .val { min-width: 70px; }
  .stepper.sm .val b { font-size: 17px; }
  .as-foot { padding: 4px 10px 12px; }
}
`;

class ClimatePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._cfg = {};
    this._pending = null;
    this._assume = {};
    this._showAssumptions = false;
    this._showTable = false;
    this._stats = null;
    this._history = null;
    this._busy = false;
    this._toast = "";
    this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
  }

  set panel(p) {
    this._cfg = p?.config || {};
    this._scheduleRender();
  }

  set hass(hass) {
    this._hass = hass;
    this._ensureLoaded();
    this._scheduleRender();
  }

  get hass() {
    return this._hass;
  }

  set narrow(v) {
    this._narrow = v;
    this._scheduleRender();
  }

  get cfg() {
    return { climate: "climate.thermostat", weather: "weather.home", ...(this._cfg || {}) };
  }

  connectedCallback() {
    loadFont();
    this._ensureLoaded();
    this._tick = setInterval(() => this._render(), 15000);
    this._historyTimer = setInterval(() => this._loadHistory(), 10 * 60 * 1000);
    this._statsTimer = setInterval(() => this._loadStats(), 30 * 60 * 1000);
    this._scheduleRender();
  }

  disconnectedCallback() {
    clearInterval(this._tick);
    clearInterval(this._historyTimer);
    clearInterval(this._statsTimer);
    this._loaded = false;
  }

  _ensureLoaded() {
    if (!this._hass || !this.isConnected || this._loaded) return;
    this._loaded = true;
    this._loadHistory();
    this._loadStats();
  }

  async _loadStats() {
    if (!this._hass) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    try {
      const res = await this._hass.callWS({
        type: "recorder/statistics_during_period",
        start_time: start.toISOString(),
        statistic_ids: STAT_IDS,
        period: "month",
        types: ["change"],
      });
      const months = new Map();
      for (const [id, rows] of Object.entries(res || {})) {
        for (const r of rows || []) {
          // Month buckets start at local midnight in HA's zone; +12 h keeps the month right in nearby browser zones.
          const t = (typeof r.start === "number" ? r.start : Date.parse(r.start)) + 12 * 36e5;
          const k = monthKey(new Date(t));
          if (!months.has(k)) months.set(k, {});
          months.get(k)[id] = r.change ?? 0;
        }
      }
      this._stats = months;
    } catch (_) {
      this._stats = this._stats || new Map();
    }
    this._scheduleRender();
  }

  async _loadHistory() {
    if (!this._hass) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (DAYS - 1));
    try {
      const res = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: start.toISOString(),
        entity_ids: [E.activity, E.tariff],
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      });
      const rows = (id) => (res?.[id] || []).map((r) => ({ s: r.s, t: (r.lc ?? r.lu) * 1000 }));
      this._history = { start: start.getTime(), activity: rows(E.activity), tariff: rows(E.tariff) };
    } catch (_) {
      this._history = this._history || { start: start.getTime(), activity: [], tariff: [] };
    }
    this._scheduleRender();
  }

  _scheduleRender() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this._render();
    });
  }

  _showToast(msg) {
    this._toast = msg;
    this._render();
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this._toast = "";
      this._render();
    }, 6000);
  }

  async _call(domain, service, data) {
    this._busy = true;
    this._render();
    try {
      await this._hass.callService(domain, service, data);
    } catch (err) {
      this._showToast(`Couldn't ${service.replace(/_/g, " ")}: ${err.message || err}`);
    } finally {
      this._busy = false;
      this._render();
    }
  }

  _onClick(e) {
    const el = e.target.closest?.("[data-action]");
    if (!el || !this._hass) return;
    switch (el.dataset.action) {
      case "menu":
        this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
        return;
      case "sp-inc":
      case "sp-dec":
        this._bumpSetpoint(el.dataset.key, el.dataset.action === "sp-inc" ? 1 : -1);
        return;
      case "mode":
        this._setMode(el.dataset.mode);
        return;
      case "as-inc":
      case "as-dec":
        this._bumpAssumption(el.dataset.entity, el.dataset.action === "as-inc" ? 1 : -1);
        return;
      case "assume":
        this._showAssumptions = !this._showAssumptions;
        this._render();
        return;
      case "table":
        this._showTable = !this._showTable;
        this._render();
        return;
      default:
        return;
    }
  }

  // Taps are batched into one set_temperature call: the Honeywell cloud is slow and rate limited.
  _bumpSetpoint(key, dir) {
    const m = this._m;
    if (!m?.online) return;
    const a = m.a;
    const step = Number(a.target_temp_step) || (m.unit.includes("F") ? 1 : 0.5);
    const lo = Number(a.min_temp ?? 40);
    const hi = Number(a.max_temp ?? 95);
    const p = this._pending && !this._pending.sent ? this._pending : { values: {} };
    const base = p.values[key] ?? Number(a[key]);
    if (!Number.isFinite(base)) return;
    p.values[key] = Math.min(hi, Math.max(lo, Math.round((base + dir * step) / step) * step));
    p.sent = false;
    this._pending = p;
    clearTimeout(this._spTimer);
    this._spTimer = setTimeout(() => this._sendSetpoint(), 1200);
    this._render();
  }

  async _sendSetpoint() {
    const p = this._pending;
    if (!p || !this._m) return;
    const a = this._m.a;
    const data = { entity_id: this.cfg.climate };
    if ("temperature" in p.values) data.temperature = p.values.temperature;
    else {
      data.target_temp_low = p.values.target_temp_low ?? a.target_temp_low;
      data.target_temp_high = p.values.target_temp_high ?? a.target_temp_high;
    }
    p.sent = true;
    p.sentAt = Date.now();
    this._render();
    try {
      await this._hass.callService("climate", "set_temperature", data);
    } catch (err) {
      this._pending = null;
      this._showToast(`Couldn't set the temperature: ${err.message || err}`);
    }
  }

  _setMode(mode) {
    const m = this._m;
    if (!m?.online || mode === m.mode || this._busy) return;
    if (mode === "off" && !window.confirm("Turn heating and cooling off? The house won't be heated or cooled until you turn it back on.")) return;
    this._pending = null;
    this._call("climate", "set_hvac_mode", { entity_id: this.cfg.climate, hvac_mode: mode });
  }

  _bumpAssumption(entity, dir) {
    const def = ASSUMPTIONS.find((x) => x.entity === entity);
    const st = this._hass.states[entity];
    if (!def || !st) return;
    const cur = this._assume[entity]?.value ?? num(st);
    if (cur == null) return;
    const min = Number(st.attributes.min ?? 0);
    const max = Number(st.attributes.max ?? Infinity);
    const value = +Math.min(max, Math.max(min, cur + dir * def.step)).toFixed(def.digits);
    this._assume[entity] = { value };
    clearTimeout(this._assume[`${entity}:t`]);
    this._assume[`${entity}:t`] = setTimeout(async () => {
      try {
        await this._hass.callService("input_number", "set_value", { entity_id: entity, value });
      } catch (err) {
        delete this._assume[entity];
        this._showToast(`Couldn't save ${def.label}: ${err.message || err}`);
      }
    }, 700);
    this._render();
  }

  _fmtTime(ms) {
    const tf = this._hass?.locale?.time_format;
    const hour12 = tf === "12" ? true : tf === "24" ? false : undefined;
    const d = new Date(ms);
    const opts = d.getMinutes() ? { hour: "numeric", minute: "2-digit", hour12 } : { hour: "numeric", hour12 };
    return d.toLocaleTimeString([], opts);
  }

  _when(ms) {
    const day = (t) => new Date(t).setHours(0, 0, 0, 0);
    const diff = Math.round((day(ms) - day(Date.now())) / 864e5);
    if (diff === 0) return this._fmtTime(ms);
    if (diff === 1) return `tomorrow ${this._fmtTime(ms)}`;
    return `${new Date(ms).toLocaleDateString([], { weekday: "short" })} ${this._fmtTime(ms)}`;
  }

  _t(v) {
    if (v == null || !Number.isFinite(Number(v))) return "—";
    const n = Number(v);
    return `${Number.isInteger(n) ? n : n.toFixed(1)}°`;
  }

  _model() {
    const s = this._hass.states;
    const c = this.cfg;
    const cl = s[c.climate];
    const a = cl?.attributes || {};
    const tariff = s[E.tariff];
    return {
      cl,
      a,
      connected: !!cl,
      online: !!cl && !BAD.has(cl.state),
      mode: cl?.state,
      activity: activityOf(cl),
      unit: a.temperature_unit || this._hass.config?.unit_system?.temperature || "°F",
      tariff: tariff && !BAD.has(tariff.state) ? tariff.state : null,
      ta: tariff?.attributes || {},
      elecRate: num(s[E.elecRate]),
      gasRate: num(s[E.gasRate]),
      month: {
        elecOn: num(s[E.elecOn]),
        elecOff: num(s[E.elecOff]),
        kwhOn: num(s[E.kwhOn]),
        kwhOff: num(s[E.kwhOff]),
        gas: num(s[E.gasCost]),
        therms: num(s[E.therms]),
        heatH: num(s[E.heatH]),
        coolH: num(s[E.coolH]),
        fanH: num(s[E.fanH]),
        lastReset: s[E.gasCost]?.attributes?.last_reset,
      },
      weather: s[c.weather],
    };
  }

  _targetText(m) {
    const a = m.a;
    if (m.mode === "heat_cool") return a.target_temp_low != null ? `${this._t(a.target_temp_low)}–${this._t(a.target_temp_high)}` : "";
    return a.temperature != null ? this._t(a.temperature) : "";
  }

  _status(m) {
    if (!m.connected) return { dot: "grey", label: "Not connected", detail: "Honeywell thermostat isn't in Home Assistant yet" };
    if (!m.online) return { dot: "grey", label: "Offline", detail: "Honeywell's cloud isn't responding" };
    const inside = m.a.current_temperature != null ? `${this._t(m.a.current_temperature)} inside` : "";
    const target = this._targetText(m);
    const join = (...xs) => xs.filter(Boolean).join(" · ");
    switch (m.activity) {
      case "heating":
        return { dot: "heat live", label: "Heating", detail: join(target && `to ${target}`, inside) };
      case "cooling":
        return { dot: "cool live", label: "Cooling", detail: join(target && `to ${target}`, inside) };
      case "fan":
        return { dot: "fan live", label: "Fan only", detail: join("circulating air", inside) };
      case "off":
        return { dot: "grey", label: "Off", detail: join("heating and cooling are off", inside) };
      default:
        return { dot: "", label: "Idle", detail: join(target && `holding ${target}`, inside) };
    }
  }

  _chip(m) {
    if (!m.tariff) return null;
    const on = m.tariff === "on_peak";
    const rate = Number(m.ta.rate);
    const cents = Number.isFinite(rate) ? ` · ${(rate * 100).toFixed(1)}¢/kWh` : "";
    const next = m.ta.next_change ? Date.parse(m.ta.next_change) : NaN;
    const when = Number.isFinite(next) ? (on ? ` · until ${this._when(next)}` : ` · peak ${this._when(next)}`) : "";
    return { cls: on ? "peak" : "", text: `${on ? "On-peak" : "Off-peak"}${cents}${when}` };
  }

  _costNow(m) {
    if (!m.online) return { main: "Running cost unavailable", sub: "Needs the thermostat to know what's running." };
    const elec = m.elecRate ?? 0;
    const gas = m.gasRate ?? 0;
    const ta = m.ta;
    const ratio = ta.on_peak_rate && ta.off_peak_rate ? ta.on_peak_rate / ta.off_peak_rate : null;
    const next = ta.next_change ? Date.parse(ta.next_change) : NaN;
    if (m.activity === "idle" || m.activity === "off") {
      let sub = "";
      const coolingMode = m.mode === "cool" || m.mode === "heat_cool";
      if (coolingMode && m.tariff === "off_peak" && ta.season === "summer" && Number.isFinite(next) && next - Date.now() < 4 * 36e5) {
        sub = `Peak pricing starts at ${this._fmtTime(next)} — pre-cooling before then is cheaper.`;
      } else if (coolingMode && m.tariff === "on_peak" && ta.season === "summer" && ratio) {
        sub = `Cooling now would cost ${ratio.toFixed(1)}× the off-peak rate.`;
      }
      return { main: "Not running · $0/hr right now", sub };
    }
    const total = elec + gas;
    let sub;
    if (m.activity === "heating") {
      const share = total > 0 ? Math.round((gas / total) * 100) : 0;
      sub = `Gas ${money(gas)} + blower ${money(elec)} · gas is ${share}% of it, so peak hours barely matter for heat.`;
    } else if (m.activity === "cooling") {
      sub = m.tariff === "on_peak" && ratio
        ? `All electric, at the on-peak rate — ${ratio.toFixed(1)}× what it costs off-peak.`
        : `All electric, at the off-peak rate.`;
    } else sub = "Blower only.";
    return { main: `Running now ≈ ${money(total)}/hr`, sub };
  }

  _hero(m) {
    const a = m.a;
    const out = m.weather?.attributes?.temperature;
    const facts = [
      a.current_humidity != null ? `${Math.round(a.current_humidity)}% humidity` : "",
      out != null ? `${Math.round(out)}° outside` : "",
    ].filter(Boolean).join(" · ");

    // Clear a sent setpoint once the thermostat reports it, or after 2 min of cloud lag.
    const p = this._pending;
    if (p?.sent) {
      const matched = Object.entries(p.values).every(([k, v]) => Number(a[k]) === v);
      if (matched || Date.now() - p.sentAt > 120000) this._pending = null;
    }

    const reason = !m.connected
      ? "Connect the thermostat to change the temperature."
      : !m.online
        ? "The thermostat is unavailable right now."
        : m.mode === "off"
          ? "System is off — choose Heat or Cool to set a temperature."
          : m.mode === "fan_only"
            ? "Fan-only mode has no temperature to set."
            : "";
    const keys = m.mode === "heat_cool"
      ? [["target_temp_low", "Heat to", "Furnace comes on below this"], ["target_temp_high", "Cool to", "AC comes on above this"]]
      : [["temperature", m.mode === "cool" ? "Cool to" : m.mode === "heat" ? "Heat to" : "Set to", m.mode === "cool" ? "AC comes on above this" : m.mode === "heat" ? "Furnace comes on below this" : ""]];
    const steppers = keys.map(([k, label, hint]) => {
      const pend = this._pending?.values?.[k];
      const v = pend ?? a[k];
      const disabled = !!reason || v == null;
      const step = Number(a.target_temp_step) || 1;
      const atMin = v != null && Number(v) - step < Number(a.min_temp ?? -Infinity);
      const atMax = v != null && Number(v) + step > Number(a.max_temp ?? Infinity);
      return `
        <div class="sp-row">
          <div class="sp-label">${esc(label)}${hint ? `<small>${esc(hint)}</small>` : ""}</div>
          <div class="stepper ${disabled ? "disabled" : ""}">
            <button data-action="sp-dec" data-key="${k}" aria-label="${esc(label)} lower" ${disabled || atMin ? "disabled" : ""}>${svg("mdiMinus")}</button>
            <div class="val ${pend != null ? "pending" : ""}"><b>${disabled && v == null ? "—" : this._t(v)}</b></div>
            <button data-action="sp-inc" data-key="${k}" aria-label="${esc(label)} higher" ${disabled || atMax ? "disabled" : ""}>${svg("mdiPlus")}</button>
          </div>
        </div>`;
    }).join("");
    let why = reason;
    if (!why && this._pending) why = this._pending.sent ? "Waiting for the thermostat to confirm… (Honeywell's cloud can take a minute)" : "Sending in a moment…";
    else if (!why && a.permanent_hold) why = "Permanent hold — the thermostat's schedule is paused.";

    const modes = MODE_ORDER.filter((x) => (a.hvac_modes || []).includes(x));
    const modeBtns = modes.length
      ? `<div class="modes" role="group" aria-label="Mode">${modes
          .map((x) => `<button class="mode ${x} ${m.mode === x ? "on" : ""}" data-action="mode" data-mode="${x}" aria-pressed="${m.mode === x}" ${!m.online || this._busy ? "disabled" : ""}>${svg(MODE_META[x].icon)}${MODE_META[x].label}</button>`)
          .join("")}</div>`
      : "";

    const now = this._costNow(m);
    const nowIcon = m.activity === "heating" ? "mdiFire" : m.activity === "cooling" ? "mdiSnowflake" : m.activity === "fan" ? "mdiFan" : "mdiFlash";
    return `
      <section class="card hero">
        <div class="eyebrow">Inside now</div>
        <div class="temp-row"><div class="temp num">${this._t(a.current_temperature)}</div><div class="temp-label">${m.connected ? esc(m.a.friendly_name || "Thermostat") : "No thermostat yet"}</div></div>
        ${facts ? `<div class="facts">${esc(facts)}</div>` : ""}
        <div class="divider"></div>
        ${steppers}
        <div class="sp-why">${esc(why)}</div>
        ${modeBtns}
        <div class="divider"></div>
        <div class="now-cost"><div class="now-ic">${svg(nowIcon)}</div><div><div class="now-main">${esc(now.main)}</div>${now.sub ? `<div class="now-sub">${esc(now.sub)}</div>` : ""}</div></div>
      </section>`;
  }

  _monthCard(m) {
    const mo = m.month;
    const parts = [mo.elecOn, mo.elecOff, mo.gas];
    const total = parts.some((v) => v == null) ? null : parts.reduce((s, v) => s + v, 0);
    const now = new Date();
    const ms = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const me = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    const lr = mo.lastReset ? Date.parse(mo.lastReset) : NaN;
    const from = Number.isFinite(lr) && lr > ms ? lr : ms;
    const elapsed = Date.now() - from;
    const monthName = now.toLocaleDateString([], { month: "long" });
    const range = from > ms ? `since ${new Date(from).toLocaleDateString([], { month: "short", day: "numeric" })}` : `${monthName} so far`;
    if (total == null) {
      return `
        <section class="card month">
          <div class="eyebrow">This month</div>
          <div class="empty">Cost tracking isn't reporting yet. It needs <code>packages/hvac_cost.yaml</code> loaded and the thermostat connected.</div>
        </section>`;
    }
    const proj = elapsed >= 2 * 864e5 ? (total * (me - ms)) / elapsed : null;
    const projText = total === 0
      ? "Nothing spent yet"
      : proj != null
        ? `On pace for about <b>${dollars(proj)}</b> in ${esc(monthName)}`
        : "Projection after 2 days of data";
    const rows = [
      ["gas", "Gas heat", mo.gas, `${fmtNum(mo.therms, 1)} therms · ${fmtHours(mo.heatH)} heating`],
      ["on", "Electric, on-peak", mo.elecOn, `${fmtNum(mo.kwhOn, 1)} kWh`],
      ["off", "Electric, off-peak", mo.elecOff, `${fmtNum(mo.kwhOff, 1)} kWh`],
    ];
    const ry = Number(m.ta.rates_year);
    const stale = Number.isFinite(ry) && ry < now.getFullYear()
      ? `<div class="note warn">Using ${ry} electric rates — add ${now.getFullYear()} rates to custom_templates/fc_tod.jinja.</div>`
      : "";
    return `
      <section class="card month">
        <div class="card-head"><span class="eyebrow">This month · ${esc(range)}</span></div>
        <div class="mtd"><div class="mtd-total num">${money(total)}</div><div class="mtd-proj">${projText}</div></div>
        <div class="rows">${rows
          .map(([k, name, v, detail]) => `<div class="row"><span class="sw ${k}"></span><div><div class="row-name">${name}</div><div class="row-detail">${esc(detail)}</div></div><div class="row-val">${money(v)}</div></div>`)
          .join("")}</div>
        <div class="runtime">Runtime: heating ${fmtHours(mo.heatH)} · cooling ${fmtHours(mo.coolH)} · fan only ${fmtHours(mo.fanH)}</div>
        ${stale}
      </section>`;
  }

  _historyRows(m) {
    const now = new Date();
    const cur = monthKey(now);
    const rows = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = monthKey(d);
      let r;
      if (k === cur) {
        const mo = m.month;
        r = { gas: mo.gas, on: mo.elecOn, off: mo.elecOff, therms: mo.therms, kwhOn: mo.kwhOn, kwhOff: mo.kwhOff, current: true };
      } else {
        const s = this._stats?.get(k);
        if (!s) continue;
        r = { gas: s[E.gasCost], on: s[E.elecOn], off: s[E.elecOff], therms: s[E.therms], kwhOn: s[E.kwhOn], kwhOff: s[E.kwhOff] };
      }
      for (const f of ["gas", "on", "off", "therms", "kwhOn", "kwhOff"]) r[f] = Math.max(0, r[f] ?? 0);
      r.total = r.gas + r.on + r.off;
      r.date = d;
      rows.push(r);
    }
    while (rows.length > 1 && !rows[0].current && rows[0].total === 0) rows.shift();
    return rows;
  }

  _histCard(m) {
    const rows = this._historyRows(m);
    const legend = `<div class="legend"><span><i class="sw gas"></i>Gas heat</span><span><i class="sw on"></i>Electric, on-peak</span><span><i class="sw off"></i>Electric, off-peak</span></div>`;
    const head = `<div class="card-head"><span class="eyebrow">Cost by month</span><button class="link-btn" data-action="table">${this._showTable ? "Show chart" : "Show table"}</button></div>`;
    const longName = (r) => `${r.date.toLocaleDateString([], { month: "long", year: "numeric" })}${r.current ? " (so far)" : ""}`;
    const tracked = rows.filter((r) => !r.current).length;
    const note = tracked === 0
      ? `<div class="note">History builds up month by month — each finished month stays here for good.</div>`
      : "";
    if (this._showTable) {
      return `
        <section class="card hist">${head}
          <table>
            <thead><tr><th>Month</th><th>Gas</th><th>On-peak</th><th>Off-peak</th><th>Total</th></tr></thead>
            <tbody>${rows
              .slice()
              .reverse()
              .map((r) => `<tr><td>${esc(longName(r))}</td><td>${money(r.gas)}</td><td>${money(r.on)}</td><td>${money(r.off)}</td><td><b>${money(r.total)}</b></td></tr>`)
              .join("")}</tbody>
          </table>${note}
        </section>`;
    }
    if (rows.every((r) => r.total === 0)) {
      return `<section class="card hist">${head}<div class="empty">No costs recorded yet. Each month's total appears here as the system runs, and finished months stay for good.</div></section>`;
    }
    const max = niceMax(Math.max(1, ...rows.map((r) => r.total)));
    const peakIdx = rows.reduce((best, r, i) => (r.total > rows[best].total ? i : best), 0);
    const cols = rows
      .map((r, i) => {
        const h = Math.round((r.total / max) * PLOT_H);
        const segs = [["gas", r.gas], ["on", r.on], ["off", r.off]]
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `<i class="seg ${k}" style="flex-grow:${v.toFixed(4)}"></i>`)
          .join("");
        const showTotal = r.total > 0 && (r.current || i === peakIdx);
        const tip = `
          <div class="tip ${i < rows.length / 2 ? "l" : "r"}">
            <b>${esc(longName(r))}</b>
            <div><span class="sw gas"></span>Gas ${money(r.gas)} · ${fmtNum(r.therms, 1)} therms</div>
            <div><span class="sw on"></span>On-peak ${money(r.on)} · ${fmtNum(r.kwhOn, 1)} kWh</div>
            <div><span class="sw off"></span>Off-peak ${money(r.off)} · ${fmtNum(r.kwhOff, 1)} kWh</div>
            <div><b>Total ${money(r.total)}</b></div>
          </div>`;
        return `<div class="bcol" tabindex="0" aria-label="${esc(longName(r))}: ${money(r.total)}">${showTotal ? `<div class="bar-total">${r.total >= 10 ? dollars(r.total) : money(r.total)}</div>` : ""}<div class="stack" style="height:${h}px">${segs}</div>${tip}</div>`;
      })
      .join("");
    const labels = rows
      .map((r) => `<div>${esc(r.date.toLocaleDateString([], { month: "short" }))}${r.current ? "<small>so far</small>" : ""}</div>`)
      .join("");
    const lines = [0.5, 1]
      .map((f) => `<div class="gl" style="bottom:${Math.round(f * PLOT_H)}px"><span>${money(max * f).replace(/\.00$/, "")}</span></div>`)
      .join("");
    return `
      <section class="card hist">${head}${legend}
        <div class="chart">
          <div class="plot">${lines}<div class="cols">${cols}</div></div>
          <div class="xl">${labels}</div>
        </div>${note}
      </section>`;
  }

  _daysCard() {
    const h = this._history;
    const head = `<div class="card-head"><span class="eyebrow">Last ${DAYS} days</span><span class="muted">runtime</span></div>`;
    if (!h) return `<section class="card days">${head}<div class="empty">Loading…</div></section>`;
    if (!h.activity.length) {
      return `<section class="card days">${head}<div class="empty">No thermostat history yet — this fills in as the system runs.</div></section>`;
    }
    const now = Date.now();
    const spans = (rows) =>
      rows
        .map((r, i) => ({ s: r.s, a: Math.max(r.t, h.start), b: i + 1 < rows.length ? rows[i + 1].t : now }))
        .filter((x) => x.b > x.a);
    const act = spans(h.activity);
    const tar = spans(h.tariff);
    const firstSeen = act.length ? act[0].a : now;
    const dayRows = [];
    for (let d = 0; d < DAYS; d++) {
      const ds = new Date();
      ds.setHours(0, 0, 0, 0);
      ds.setDate(ds.getDate() - d);
      const de = new Date(ds);
      de.setDate(de.getDate() + 1);
      const t0 = ds.getTime();
      const t1 = de.getTime();
      const len = t1 - t0;
      const pos = (a, b) => `left:${(((a - t0) / len) * 100).toFixed(2)}%;width:${(((b - a) / len) * 100).toFixed(2)}%`;
      const clip = (list, pred) =>
        list.filter(pred).map((x) => ({ ...x, a: Math.max(x.a, t0), b: Math.min(x.b, t1, now) })).filter((x) => x.b > x.a);
      const peaks = clip(tar, (x) => x.s === "on_peak").map((x) => `<i class="pk" style="${pos(x.a, x.b)}"></i>`).join("");
      const gaps = clip(act, (x) => BAD.has(x.s)).map((x) => `<i class="nd" style="${pos(x.a, x.b)}" title="No data"></i>`).join("");
      const before = firstSeen > t0 ? `<i class="nd" style="${pos(t0, Math.min(firstSeen, t1))}" title="Before tracking started"></i>` : "";
      let runtime = 0;
      const runs = clip(act, (x) => ACTIVITY_LABEL[x.s])
        .map((x) => {
          if (x.s !== "fan") runtime += x.b - x.a;
          return `<i class="${x.s}" style="${pos(x.a, x.b)}" title="${ACTIVITY_LABEL[x.s]} ${this._fmtTime(x.a)}–${this._fmtTime(x.b)}"></i>`;
        })
        .join("");
      const future = d === 0 && now < t1 ? `<i class="future" style="${pos(now, t1)}"></i>` : "";
      const name = d === 0 ? "Today" : ds.toLocaleDateString([], { weekday: "short" });
      dayRows.push(`
        <div class="day"><div class="day-name">${esc(name)}</div>
          <div class="strip">${peaks}${gaps}${before}${runs}${future}</div>
          <div class="day-rt">${runtime ? fmtHours(runtime / 36e5) : "—"}</div></div>`);
    }
    const ticks = [0, 6, 12, 18, 24]
      .map((hr) => {
        const d = new Date();
        d.setHours(hr % 24, 0, 0, 0);
        const label = hr === 12 ? "Noon" : this._fmtTime(d.getTime());
        return `<span style="left:${(hr / 24) * 100}%">${esc(label)}</span>`;
      })
      .join("");
    return `
      <section class="card days">${head}
        <div class="legend"><span><i class="sw gas"></i>Heating</span><span><i class="sw on"></i>Cooling</span><span><i class="sw" style="background:#8593a8;height:5px"></i>Fan only</span><span><i class="band"></i>On-peak hours</span></div>
        <div style="margin-top:12px">${dayRows.join("")}</div>
        <div class="axis"><div></div><div class="ticks">${ticks}</div><div></div></div>
        <div class="note">Runtime counts heating and cooling. Hover a block for its times.</div>
      </section>`;
  }

  _assumeCard(m) {
    const vals = ASSUMPTIONS.map((x) => {
      const st = this._hass.states[x.entity];
      const local = this._assume[x.entity]?.value;
      const live = num(st);
      if (local != null && live != null && Math.abs(local - live) < 1e-9) delete this._assume[x.entity];
      return { ...x, st, value: this._assume[x.entity]?.value ?? live };
    });
    const fmt = (x) => (x.value == null ? "—" : x.unit === "$/therm" ? `$${x.value.toFixed(2)}` : fmtNum(x.value, x.digits));
    const summary = vals.every((x) => x.value != null)
      ? `AC ${fmt(vals[0])} kW · blower ${fmt(vals[1])} kW · furnace ${Math.round(vals[2].value / 1000)}k BTU/h · gas ${fmt(vals[3])}/therm`
      : "Equipment numbers aren't loaded — check packages/hvac_cost.yaml";
    const body = this._showAssumptions
      ? `${vals
          .map((x) => {
            const disabled = !x.st || x.value == null;
            const min = Number(x.st?.attributes?.min ?? -Infinity);
            const max = Number(x.st?.attributes?.max ?? Infinity);
            return `
            <div class="as-row">
              <div class="as-text"><div class="as-name">${esc(x.label)}</div><div class="as-help">${esc(x.help)}</div></div>
              <div class="stepper sm ${disabled ? "disabled" : ""}">
                <button data-action="as-dec" data-entity="${x.entity}" aria-label="Lower ${esc(x.label)}" ${disabled || x.value - x.step < min - 1e-9 ? "disabled" : ""}>${svg("mdiMinus")}</button>
                <div class="val"><b>${fmt(x)}</b><span>${esc(x.unit)}</span></div>
                <button data-action="as-inc" data-entity="${x.entity}" aria-label="Raise ${esc(x.label)}" ${disabled || x.value + x.step > max + 1e-9 ? "disabled" : ""}>${svg("mdiPlus")}</button>
              </div>
            </div>`;
          })
          .join("")}
        <div class="as-foot">
          <div class="note">Costs are estimated from runtime × these numbers, priced at the rate in effect at the time. Changes apply from now on; past months keep what they recorded.</div>
          <div class="note">Electric: Fort Collins ${esc(m.ta.rates_year ?? "")} ToD rates (${m.ta.on_peak_rate != null ? `${(m.ta.on_peak_rate * 100).toFixed(2)}¢ on-peak / ${(m.ta.off_peak_rate * 100).toFixed(2)}¢ off-peak` : "unavailable"} this season). Excludes the monthly base charge and the tier charge above 700 kWh, which apply to the whole home.</div>
        </div>`
      : "";
    return `
      <section class="card assume">
        <button class="disclose" data-action="assume" aria-expanded="${this._showAssumptions}">
          <div class="now-ic">${svg("mdiInformationOutline")}</div>
          <div class="txt"><div class="as-name">How costs are estimated</div><div class="sub">${esc(summary)}</div></div>
          ${svg(this._showAssumptions ? "mdiChevronUp" : "mdiChevronDown")}
        </button>
        ${body}
      </section>`;
  }

  _render() {
    if (!this._hass) return;
    const m = this._model();
    this._m = m;
    const status = this._status(m);
    const chip = this._chip(m);
    const brand = m.activity === "cooling" ? "cool" : m.activity === "heating" ? "" : "idle";
    let banner = "";
    if (!m.connected) {
      banner = `<div class="banner info">${svg("mdiLinkVariantOff")}<span>The Honeywell thermostat isn't connected. Add <b>Honeywell Total Connect Comfort (US)</b> under Settings → Devices &amp; services, then make sure its climate entity is <code>${esc(this.cfg.climate)}</code>.</span></div>`;
    } else if (!m.online) {
      banner = `<div class="banner">${svg("mdiAlertCircleOutline")}<span>Can't reach the thermostat through Honeywell's cloud right now — showing the last known state. Cost tracking pauses until it's back.</span></div>`;
    }

    const html = `
      <style>${CSS}</style>
      <div class="app">
        <header class="top">
          ${this._narrow ? `<button class="icon-btn" data-action="menu" aria-label="Menu">${svg("mdiMenu")}</button>` : ""}
          <div class="brand ${brand}">${svg(m.activity === "cooling" ? "mdiSnowflake" : "mdiThermostat")}</div>
          <div class="titles">
            <h1>Climate</h1>
            <div class="status"><span class="dot ${status.dot}"></span><b>${esc(status.label)}</b><span class="muted">·</span><span class="muted detail">${esc(status.detail)}</span></div>
          </div>
          <div class="spacer"></div>
          ${chip ? `<div class="chip ${chip.cls}">${svg("mdiClockOutline")}<span>${esc(chip.text)}</span></div>` : ""}
        </header>
        ${banner}
        <main class="grid">
          <div class="col">${this._hero(m)}${this._assumeCard(m)}</div>
          <div class="col">${this._monthCard(m)}${this._histCard(m)}${this._daysCard()}</div>
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
  if (document.getElementById("climate-panel-font")) return;
  const link = document.createElement("link");
  link.id = "climate-panel-font";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

if (!customElements.get("climate-panel")) customElements.define("climate-panel", ClimatePanel);
