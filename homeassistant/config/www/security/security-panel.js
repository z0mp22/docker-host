// Security panel: a dependency-free web component registered via panel_custom.
// Reads Frigate integration entities, named {camera id}_{thing} (e.g.
// binary_sensor.driveway_person_occupancy). Cameras come from panel_custom `config`.

const ICONS = {
  mdiChevronLeft: "M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z",
  mdiChevronRight: "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",
  mdiClose: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
  mdiPlay: "M8,5.14V19.14L19,12.14L8,5.14Z",
  mdiAccount: "M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z",
  mdiAlarmLight: "M6,6.9L3.87,4.78L5.28,3.37L7.4,5.5L6,6.9M13,1V4H11V1H13M20.13,4.78L18,6.9L16.6,5.5L18.72,3.37L20.13,4.78M4.5,10.5V12.5H1.5V10.5H4.5M19.5,10.5H22.5V12.5H19.5V10.5M6,20H18A2,2 0 0,1 20,22H4A2,2 0 0,1 6,20M12,5A6,6 0 0,1 18,11V19H6V11A6,6 0 0,1 12,5Z",
  mdiCar: "M5,11L6.5,6.5H17.5L19,11M17.5,16A1.5,1.5 0 0,1 16,14.5A1.5,1.5 0 0,1 17.5,13A1.5,1.5 0 0,1 19,14.5A1.5,1.5 0 0,1 17.5,16M6.5,16A1.5,1.5 0 0,1 5,14.5A1.5,1.5 0 0,1 6.5,13A1.5,1.5 0 0,1 8,14.5A1.5,1.5 0 0,1 6.5,16M18.92,6C18.72,5.42 18.16,5 17.5,5H6.5C5.84,5 5.28,5.42 5.08,6L3,12V20A1,1 0 0,0 4,21H5A1,1 0 0,0 6,20V19H18V20A1,1 0 0,0 19,21H20A1,1 0 0,0 21,20V12L18.92,6Z",
  mdiCctvOff: "M20.84 22.73L18.11 20H17C15.9 20 15 19.1 15 18V16.89L12.66 14.55L11.81 15.04C10.86 15.59 9.63 15.26 9.08 14.31L7.58 11.71C7.18 11 7.25 10.18 7.68 9.57L1.11 3L2.39 1.73L22.11 21.46L20.84 22.73M18.5 13C18.5 12.43 18.3 11.9 17.97 11.5L19.94 10.35C20.95 9.76 21.3 8.47 20.71 7.46L19.33 5.06C18.74 4.05 17.45 3.7 16.44 4.28L10.77 7.57L17.86 14.66C18.26 14.22 18.5 13.64 18.5 13M2 12.62L5.5 18.68L8.03 15.5L6.03 12.03L2 12.62Z",
  mdiEyeOutline: "M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9M12,4.5C17,4.5 21.27,7.61 23,12C21.27,16.39 17,19.5 12,19.5C7,19.5 2.73,16.39 1,12C2.73,7.61 7,4.5 12,4.5M3.18,12C4.83,15.36 8.24,17.5 12,17.5C15.76,17.5 19.17,15.36 20.82,12C19.17,8.64 15.76,6.5 12,6.5C8.24,6.5 4.83,8.64 3.18,12Z",
  mdiMenu: "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",
  mdiMicrophoneOff: "M19,11C19,12.19 18.66,13.3 18.1,14.28L16.87,13.05C17.14,12.43 17.3,11.74 17.3,11H19M15,11.16L9,5.18V5A3,3 0 0,1 12,2A3,3 0 0,1 15,5V11L15,11.16M4.27,3L21,19.73L19.73,21L15.54,16.81C14.77,17.27 13.91,17.58 13,17.72V21H11V17.72C7.72,17.23 5,14.41 5,11H6.7C6.7,14 9.24,16.1 12,16.1C12.81,16.1 13.6,15.91 14.31,15.58L12.65,13.92L12,14A3,3 0 0,1 9,11V10.28L3,4.27L4.27,3Z",
  mdiMotionSensorOff: "M11.4 8.2H15V10H13.2L11.4 8.2M19.67 1H18.33C18.33 3.58 20.42 5.67 23 5.67V4.33C21.16 4.33 19.67 2.84 19.67 1M21 1C21 2.11 21.9 3 23 3V1H21M17 1H15.67C15.67 5.05 18.95 8.33 23 8.33V7C19.69 7 17 4.31 17 1M10 3.8C11 3.8 11.8 3 11.8 2S11 .2 10 .2 8.2 1 8.2 2 9 3.8 10 3.8M2.39 1.73L1.11 3L3.46 5.35L2 5.8V11H3.8V7.33L5.05 6.94L5.68 7.57L2 22H3.8L6.67 13.89L9 17V22H10.8V15.59L8.31 11.05L8.5 10.37L20.84 22.73L22.11 21.46L2.39 1.73M9.38 4.87C9.08 4.37 8.54 4.03 7.92 4.03C7.75 4.03 7.58 4.06 7.42 4.11L7.34 4.14L11.35 8.15L9.38 4.87Z",
  mdiPlayCircleOutline: "M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M10,16.5L16,12L10,7.5V16.5Z",
  mdiPrinter3d: "M19,6A1,1 0 0,0 20,5A1,1 0 0,0 19,4A1,1 0 0,0 18,5A1,1 0 0,0 19,6M19,2A3,3 0 0,1 22,5V11H18V7H6V11H2V5A3,3 0 0,1 5,2H19M18,18.25C18,18.63 17.79,18.96 17.47,19.13L12.57,21.82C12.4,21.94 12.21,22 12,22C11.79,22 11.59,21.94 11.43,21.82L6.53,19.13C6.21,18.96 6,18.63 6,18.25V13C6,12.62 6.21,12.29 6.53,12.12L11.43,9.68C11.59,9.56 11.79,9.5 12,9.5C12.21,9.5 12.4,9.56 12.57,9.68L17.47,12.12C17.79,12.29 18,12.62 18,13V18.25M12,11.65L9.04,13L12,14.6L14.96,13L12,11.65M8,17.66L11,19.29V16.33L8,14.71V17.66M16,17.66V14.71L13,16.33V19.29L16,17.66Z",
  mdiRecordRec: "M12.5,5A7.5,7.5 0 0,0 5,12.5A7.5,7.5 0 0,0 12.5,20A7.5,7.5 0 0,0 20,12.5A7.5,7.5 0 0,0 12.5,5M7,10H9A1,1 0 0,1 10,11V12C10,12.5 9.62,12.9 9.14,12.97L10.31,15H9.15L8,13V15H7M12,10H14V11H12V12H14V13H12V14H14V15H12A1,1 0 0,1 11,14V11A1,1 0 0,1 12,10M16,10H18V11H16V14H18V15H16A1,1 0 0,1 15,14V11A1,1 0 0,1 16,10M8,11V12H9V11",
  mdiShieldCheckOutline: "M21,11C21,16.55 17.16,21.74 12,23C6.84,21.74 3,16.55 3,11V5L12,1L21,5V11M12,21C15.75,20 19,15.54 19,11.22V6.3L12,3.18L5,6.3V11.22C5,15.54 8.25,20 12,21M10,17L6,13L7.41,11.59L10,14.17L16.59,7.58L18,9",
  mdiShieldHome: "M11,13H13V16H16V11H18L12,6L6,11H8V16H11V13M12,1L21,5V11C21,16.55 17.16,21.74 12,23C6.84,21.74 3,16.55 3,11V5L12,1Z",
  mdiVideoOff: "M3.27,2L2,3.27L4.73,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16C16.2,18 16.39,17.92 16.54,17.82L19.73,21L21,19.73M21,6.5L17,10.5V7A1,1 0 0,0 16,6H9.82L21,17.18V6.5Z",
};

const HISTORY_DAYS = 7;
const VISIT_GAP_MS = 2 * 60e3;
const SNAP_MS = 10e3;
const SNAP_ACTIVE_MS = 2e3;
const ALARM_SOUNDS = ["fire_alarm", "scream", "yell"];

const svg = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ""}"/></svg>`;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const live = (st) => !!st && !["unavailable", "unknown"].includes(st.state);
const nice = (s) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const startOfDay = (ms) => new Date(ms).setHours(0, 0, 0, 0);

function dayLabel(ms) {
  const diff = Math.round((startOfDay(Date.now()) - startOfDay(ms)) / 864e5);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return new Date(ms).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function agoText(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

function fmtDur(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return "<1 min";
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

const CSS = `
:host {
  --bg: #080d17; --card: #0f1624; --card-2: #141d2e; --line: rgba(148,170,200,.12);
  --text: #eef3fa; --muted: #8593a8; --steel: #cbd5e1; --steel-2: #475569;
  --green: #22c55e; --amber: #f5b041; --red: #f0616d; --blue: #4cc3ff; --grey: #64748b;
  display: block; height: 100%; overflow-y: auto; container-type: inline-size;
  background: radial-gradient(1200px 600px at 10% -10%, rgba(100,116,139,.18), transparent 60%),
              radial-gradient(900px 500px at 110% 110%, rgba(40,110,190,.10), transparent 60%), var(--bg);
  color: var(--text); font-family: "Outfit", "SF Pro Display", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
* { box-sizing: border-box; }
button { font: inherit; color: inherit; border: 0; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; }
button:disabled { cursor: default; }
.ic { width: 24px; height: 24px; fill: currentColor; flex: none; }
.muted { color: var(--muted); }
.app { max-width: 1480px; margin: 0 auto; padding: 28px 28px 40px; }

.top { display: flex; align-items: center; gap: 18px; margin-bottom: 26px; }
.brand { width: 76px; height: 76px; border-radius: 22px; display: grid; place-items: center; flex: none; color: #fff;
  background: linear-gradient(160deg, var(--steel), var(--steel-2)); box-shadow: 0 10px 30px rgba(71,85,105,.4), inset 0 1px 0 rgba(255,255,255,.35); }
.brand .ic { width: 38px; height: 38px; }
.titles { flex: 1 1 0; min-width: 0; }
h1 { margin: 0; font-size: 34px; font-weight: 700; line-height: 1.1; }
.status { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 18px; white-space: nowrap; overflow: hidden; }
.status b { font-weight: 600; }
.status .detail { overflow: hidden; text-overflow: ellipsis; }
.dot { width: 12px; height: 12px; border-radius: 50%; flex: none; background: var(--grey); }
.dot.green { background: var(--green); box-shadow: 0 0 10px var(--green); }
.dot.amber { background: var(--amber); box-shadow: 0 0 10px var(--amber); }
.dot.red { background: var(--red); box-shadow: 0 0 10px var(--red); animation: pulse 1s ease-in-out infinite; }
.dot.blue { background: var(--blue); box-shadow: 0 0 10px var(--blue); animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .35; } }
.icon-btn { width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; background: var(--card-2); border: 1px solid var(--line); flex: none; }
.alarm { margin: -8px 0 20px; padding: 16px 20px; border-radius: 18px; display: flex; gap: 14px; align-items: center; font-size: 19px; font-weight: 600;
  background: rgba(240,97,109,.14); border: 1.5px solid rgba(240,97,109,.6); color: #ffd3d7; }
.alarm .ic { width: 30px; height: 30px; color: var(--red); }

.grid { display: grid; gap: 22px; align-items: start; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  grid-template-areas: "cams timeline" "settings attn"; }
.card { background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line); border-radius: 30px; padding: 24px 26px; min-width: 0; }
.a-cams { grid-area: cams; } .a-timeline { grid-area: timeline; } .a-attn { grid-area: attn; } .a-settings { grid-area: settings; }
.eyebrow { font-size: 13px; letter-spacing: .12em; font-weight: 600; color: var(--muted); text-transform: uppercase; }
.head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }

/* Cameras */
.cams { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }
.cam { position: relative; border-radius: 20px; overflow: hidden; background: #0b111c; border: 1.5px solid var(--line); aspect-ratio: 16 / 9; text-align: left; padding: 0; }
.cam img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.cam.active { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(76,195,255,.25); }
.cam.alarm-on { border-color: var(--red); box-shadow: 0 0 0 3px rgba(240,97,109,.3); }
.cam.off img { filter: grayscale(1) brightness(.35); }
.cam .shade { position: absolute; inset: auto 0 0 0; padding: 26px 14px 10px; background: linear-gradient(transparent, rgba(4,8,15,.88)); display: flex; align-items: flex-end; gap: 8px; }
.cam .name { font-size: 17px; font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cam .pills { position: absolute; top: 10px; left: 10px; right: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
.pill { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 9px; border-radius: 8px; font-size: 12.5px; font-weight: 600;
  background: rgba(8,13,23,.75); color: #d6deea; backdrop-filter: blur(6px); }
.pill .ic { width: 15px; height: 15px; }
.pill.rec .ic { color: var(--red); }
.pill.now { background: rgba(76,195,255,.9); color: #06213a; }
.pill.warn { background: rgba(245,176,65,.9); color: #2b1a02; }
.pill.bad { background: rgba(240,97,109,.92); color: #2b0508; }
.cam .center { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); font-size: 15px; text-align: center; padding: 20px; }
.live { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; color: #d6deea; flex: none; }
.live .ic { width: 16px; height: 16px; }
.hint { margin-top: 12px; font-size: 13px; color: var(--muted); }

/* Timeline */
.latest { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
.snap { border-radius: 14px; overflow: hidden; background: #0b111c; border: 1px solid var(--line); text-align: left; padding: 0; }
.snap img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
.snap div { padding: 6px 8px; font-size: 12.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.snap div b { color: var(--text); font-weight: 600; }
.day { margin-top: 16px; font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
.ev { display: grid; grid-template-columns: 72px 22px minmax(0, 1fr) auto; font: inherit; color: inherit; background: none; border: 0; gap: 10px; align-items: center; padding: 9px 0; border-top: 1px solid var(--line); font-size: 15px; }
.day + .ev { border-top: 0; }
.ev .t { font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ev .ic { width: 20px; height: 20px; color: var(--muted); }
.ev.alarm-ev .ic { color: var(--red); }
.ev .w { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ev .d { color: var(--muted); font-size: 13px; white-space: nowrap; display: flex; align-items: center; gap: 6px; }
.ev .d .ic { width: 16px; height: 16px; color: var(--steel); }
.ev.play { width: 100%; text-align: left; border-radius: 0; }
.ev.play:hover { background: rgba(148,170,200,.05); }
.ev .th { width: 22px; height: 22px; border-radius: 6px; object-fit: cover; background: #0b111c; }
.ev .w small { color: var(--muted); font-size: 12px; margin-left: 4px; }
.modal { position: fixed; inset: 0; z-index: 20; background: rgba(3,6,12,.78); backdrop-filter: blur(6px); display: grid; place-items: center; padding: 20px; }
.sheet { width: min(980px, 100%); max-height: 100%; overflow: auto; border-radius: 24px; background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line); padding: 16px; }
.sheet-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 2px 4px 12px; }
.sheet-head b { display: block; font-size: 19px; font-weight: 600; }
.sheet-head span { font-size: 14px; color: var(--muted); }
.media { border-radius: 16px; overflow: hidden; background: #000; aspect-ratio: 16 / 9; display: grid; place-items: center; }
.media video, .media img { width: 100%; height: 100%; object-fit: contain; display: block; }
.noclip { color: var(--muted); font-size: 15px; }
.sheet-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
.btn2 { height: 42px; padding: 0 14px; border-radius: 14px; background: #172234; border: 1px solid var(--line); color: var(--steel); font-weight: 600; font-size: 15px; display: inline-flex; align-items: center; gap: 6px; }
.btn2:disabled { opacity: .4; }
.btn2 .ic { width: 20px; height: 20px; }
.link { margin-top: 12px; color: var(--steel); font-weight: 600; font-size: 15px; }
.links { display: flex; gap: 18px; flex-wrap: wrap; }
.summary { margin-top: 10px; font-size: 14.5px; color: var(--muted); }
.summary b { color: var(--text); font-weight: 600; }
.empty { margin-top: 14px; padding: 18px; border-radius: 14px; border: 1px dashed var(--line); color: var(--muted); font-size: 15px; text-align: center; }

/* Attention */
.items { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.item { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: 16px; background: #121a28; border: 1px solid var(--line); line-height: 1.4; }
.item .ic { width: 22px; height: 22px; margin-top: 1px; }
.item b { font-weight: 600; display: block; font-size: 16px; }
.item span { font-size: 14px; color: var(--muted); }
.item.red { border-color: rgba(240,97,109,.4); } .item.red .ic { color: var(--red); }
.item.amber { border-color: rgba(245,176,65,.3); } .item.amber .ic { color: var(--amber); }
.item.info .ic { color: var(--blue); }
.allgood { display: flex; gap: 12px; align-items: center; margin-top: 14px; font-size: 16px; color: #b9f2cc; }
.allgood .ic { color: var(--green); }

/* Settings */
.table { margin-top: 14px; display: grid; grid-template-columns: minmax(120px, 1.2fr) repeat(4, minmax(0, 1fr)); }
.table > div { padding: 12px 8px; border-top: 1px solid var(--line); display: flex; align-items: center; gap: 10px; min-width: 0; }
.table .th { border-top: 0; font-size: 12.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); font-weight: 600; padding-top: 0; }
.table .cn { font-weight: 600; font-size: 16px; }
.table .cn small { display: block; font-size: 12.5px; color: var(--muted); font-weight: 500; }
.toggle { width: 52px; height: 32px; border-radius: 16px; background: #253145; position: relative; flex: none; }
.toggle::after { content: ""; position: absolute; top: 4px; left: 4px; width: 24px; height: 24px; border-radius: 50%; background: #fff; transition: transform .2s; box-shadow: 0 2px 6px rgba(0,0,0,.35); }
.toggle.on { background: linear-gradient(90deg, #16a34a, var(--green)); }
.toggle.on::after { transform: translateX(20px); }
.ro { font-size: 13px; color: var(--muted); }
.ro.on { color: #b9f2cc; }
.lbl { display: none; font-size: 13px; color: var(--muted); }
.toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); padding: 14px 20px; border-radius: 14px; background: #3a1d24; border: 1px solid rgba(240,97,109,.5); color: #ffd3d7; z-index: 10; max-width: 90vw; }

@container (max-width: 980px) {
  .grid { grid-template-columns: minmax(0, 1fr); grid-template-areas: "cams" "timeline" "attn" "settings"; }
}
@container (max-width: 640px) {
  .app { padding: 14px 14px 24px; }
  .top { gap: 12px; margin-bottom: 16px; }
  .brand, .icon-btn { width: 44px; height: 44px; border-radius: 14px; }
  .brand .ic { width: 24px; height: 24px; }
  h1 { font-size: 22px; } .status { font-size: 14px; margin-top: 3px; } .dot { width: 10px; height: 10px; }
  .alarm { font-size: 16px; padding: 12px 14px; }
  .grid { gap: 14px; }
  .card { border-radius: 24px; padding: 18px 14px; }
  .cams { gap: 8px; }
  .cam { border-radius: 14px; }
  .cam .shade { padding: 18px 8px 6px; } .cam .name { font-size: 14px; }
  .cam .pills { top: 6px; left: 6px; gap: 4px; }
  .pill { height: 22px; font-size: 11px; padding: 0 6px; }
  .live { display: none; }
  .ev { grid-template-columns: 64px 22px minmax(0, 1fr) auto; font-size: 14px; gap: 8px; }
  .modal { padding: 0; place-items: end stretch; }
  .sheet { border-radius: 22px 22px 0 0; padding: 12px 12px calc(12px + env(safe-area-inset-bottom)); }
  .table { grid-template-columns: minmax(0, 1fr) auto; }
  .table .th { display: none; }
  .table .cn { grid-column: 1 / -1; padding-bottom: 2px; border-top: 1px solid var(--line); }
  .table .cell { border-top: 0; justify-content: space-between; grid-column: 1 / -1; padding: 6px 8px; }
  .lbl { display: inline; }
}
`;

class SecurityPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._visits = [];
    this._range = "recent";
    this._toast = "";
    this._signed = new Map();
    this._player = null;
    this.shadowRoot.innerHTML = `<style>${CSS}</style><div id="main"></div><div id="player"></div>`;
    this._main = this.shadowRoot.getElementById("main");
    this._playerEl = this.shadowRoot.getElementById("player");
    this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
    this._onKey = (e) => e.key === "Escape" && this._player && this._closePlayer();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first && this.isConnected) this._loadHistory();
    this._scheduleRender();
  }

  get hass() {
    return this._hass;
  }

  set narrow(v) {
    this._narrow = v;
    this._scheduleRender();
  }

  set panel(p) {
    this._cfg = p?.config || {};
    this._scheduleRender();
  }

  connectedCallback() {
    loadFont();
    this._tick = setInterval(() => this._render(), 15000);
    this._snapTimer = setInterval(() => this._refreshSnapshots(), 1000);
    this._historyTimer = setInterval(() => this._loadHistory(), 60e3);
    if (this._hass) this._loadHistory();
    window.addEventListener("keydown", this._onKey);
    this._scheduleRender();
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this._onKey);
    clearInterval(this._tick);
    clearInterval(this._snapTimer);
    clearInterval(this._historyTimer);
  }

  get _cameras() {
    return (this._cfg?.cameras || []).map((c) => ({ labels: ["person"], security: true, ...c, name: c.name || nice(c.id) }));
  }

  _ent(cam, suffix) {
    return this._hass.states[`${suffix.split(".")[0]}.${cam.id}_${suffix.split(".")[1]}`];
  }

  get _instance() {
    return this._cfg?.frigate_instance || "frigate";
  }

  // Visits come from Frigate's own events (with ids, so each can be played back).
  // If the Frigate integration can't answer, fall back to HA's detection history.
  async _loadHistory() {
    if (!this._hass) return;
    if (await this._loadEvents()) return;
    await this._loadSensorHistory();
  }

  async _loadEvents() {
    const cams = this._cameras.filter((c) => c.security);
    const labels = [...new Set(cams.flatMap((c) => c.labels)), ...ALARM_SOUNDS];
    try {
      let res = await this._hass.callWS({
        type: "frigate/events/get",
        instance_id: this._instance,
        labels,
        after: Math.floor((Date.now() - HISTORY_DAYS * 864e5) / 1000),
        limit: 1000,
      });
      if (typeof res === "string") res = JSON.parse(res);
      if (!Array.isArray(res)) return false;
      const byName = Object.fromEntries(cams.map((c) => [String(c.frigate || c.id).toLowerCase(), c]));
      const open = {};
      const visits = [];
      for (const ev of res.sort((a, b) => a.start_time - b.start_time)) {
        const cam = byName[String(ev.camera).toLowerCase()];
        if (!cam) continue;
        const alarm = ALARM_SOUNDS.includes(ev.label);
        if (!alarm && !cam.labels.includes(ev.label)) continue;
        const start = ev.start_time * 1000;
        const end = ev.end_time ? ev.end_time * 1000 : null;
        const key = `${cam.id}|${ev.label}`;
        const cur = open[key];
        if (cur && cur.end !== null && start - cur.end <= VISIT_GAP_MS) {
          cur.end = end === null ? null : Math.max(cur.end, end);
          cur.events.push(ev);
        } else {
          open[key] = { key: ev.id, cam, kind: ev.label, alarm, start, end, events: [ev] };
          visits.push(open[key]);
        }
      }
      this._visits = visits.sort((a, b) => b.start - a.start);
      this._fromFrigate = true;
      this._scheduleRender();
      return true;
    } catch (_) {
      return false;
    }
  }

  // Merge each detection sensor's "on" periods (Frigate flaps between frames) into visits.
  async _loadSensorHistory() {
    const sources = [];
    for (const c of this._cameras.filter((x) => x.security)) {
      for (const l of c.labels) sources.push({ id: `binary_sensor.${c.id}_${l}_occupancy`, cam: c, kind: l, alarm: false });
      for (const s of ALARM_SOUNDS) sources.push({ id: `binary_sensor.${c.id}_${s}_sound`, cam: c, kind: s, alarm: true });
    }
    const ids = sources.map((s) => s.id).filter((id) => this._hass.states[id]);
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
      const visits = [];
      for (const src of sources) {
        const rows = res?.[src.id] || [];
        let cur = null;
        rows.forEach((r, i) => {
          const t = (r.lc ?? r.lu) * 1000;
          if (r.s === "on") {
            const next = rows[i + 1];
            const end = next ? (next.lc ?? next.lu) * 1000 : null;
            if (cur && t - (cur.end ?? t) <= VISIT_GAP_MS) cur.end = end;
            else {
              cur = { cam: src.cam, kind: src.kind, alarm: src.alarm, start: t, end };
              visits.push(cur);
            }
          }
        });
      }
      this._visits = visits.sort((a, b) => b.start - a.start);
      this._scheduleRender();
    } catch (_) {
      /* timeline is optional */
    }
  }

  _media(ev, file) {
    return `/api/frigate/${encodeURIComponent(this._instance)}/notifications/${encodeURIComponent(ev.id)}/${file}`;
  }

  // <img>/<video> can't send HA's auth header, so media URLs are HA-signed paths.
  async _sign(path) {
    const hit = this._signed.get(path);
    if (hit && hit.exp > Date.now()) return hit.url;
    const res = await this._hass.callWS({ type: "auth/sign_path", path, expires: 6 * 3600 });
    this._signed.set(path, { url: res.path, exp: Date.now() + 5.5 * 3600e3 });
    return res.path;
  }

  _hydrate(root) {
    for (const el of root.querySelectorAll("[data-sign]")) {
      const path = el.dataset.sign;
      const hit = this._signed.get(path);
      if (hit && hit.exp > Date.now()) {
        if (el.getAttribute("src") !== hit.url) el.src = hit.url;
        continue;
      }
      this._sign(path).then((url) => {
        if (el.dataset.sign === path) el.src = url;
      }).catch(() => {});
    }
  }

  _openPlayer(visit, idx = 0) {
    this._player = { visit, idx };
    this._renderPlayer();
  }

  _closePlayer() {
    this._player = null;
    this._playerEl.innerHTML = "";
  }

  _renderPlayer() {
    const p = this._player;
    if (!p) return;
    const v = p.visit;
    const ev = v.events[p.idx];
    const n = v.events.length;
    const when = `${dayLabel(ev.start_time * 1000)} ${this._fmtTime(ev.start_time * 1000)}`;
    const len = ev.end_time ? fmtDur((ev.end_time - ev.start_time) * 1000) : "ongoing";
    const media = ev.has_clip
      ? `<video controls autoplay playsinline data-sign="${esc(this._media(ev, "clip.mp4"))}" poster=""></video>`
      : ev.has_snapshot
        ? `<img data-sign="${esc(this._media(ev, "snapshot.jpg"))}" alt="">`
        : `<div class="noclip">No recording was saved for this event.</div>`;
    this._playerEl.innerHTML = `
      <div class="modal" data-action="close-player">
        <div class="sheet" role="dialog" aria-label="Recording">
          <div class="sheet-head">
            <div><b>${esc(nice(v.kind))} · ${esc(v.cam.name)}</b><span>${esc(when)} · ${esc(len)}${ev.has_clip ? "" : " · snapshot only"}</span></div>
            <button class="icon-btn" data-action="close-player" aria-label="Close">${svg("mdiClose")}</button>
          </div>
          <div class="media">${media}</div>
          <div class="sheet-foot">
            ${n > 1 ? `<button class="btn2" data-action="clip" data-step="-1" ${p.idx === 0 ? "disabled" : ""}>${svg("mdiChevronLeft")}Earlier</button><span class="muted">Clip ${p.idx + 1} of ${n}</span><button class="btn2" data-action="clip" data-step="1" ${p.idx === n - 1 ? "disabled" : ""}>Later${svg("mdiChevronRight")}</button>` : "<span></span>"}
            <button class="btn2" data-action="live" data-entity="${esc(v.cam.cameraId || v.cam.camera || `camera.${v.cam.id}`)}">${svg("mdiPlayCircleOutline")}Live</button>
          </div>
        </div>
      </div>`;
    this._hydrate(this._playerEl);
  }

  _scheduleRender() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this._render();
    });
  }

  // Swap each snapshot only once the new frame has loaded, so tiles never flash blank.
  _refreshSnapshots() {
    const now = Date.now();
    for (const img of this.shadowRoot.querySelectorAll("img[data-snap]")) {
      const base = img.dataset.snap;
      if (!base || base.startsWith("data:") || img.dataset.loading) continue;
      const every = img.dataset.active ? SNAP_ACTIVE_MS : SNAP_MS;
      if (now - Number(img.dataset.at || 0) < every) continue;
      img.dataset.loading = "1";
      const next = new Image();
      const url = `${base}${base.includes("?") ? "&" : "?"}_=${now}`;
      next.onload = () => {
        img.src = url;
        img.dataset.at = String(Date.now());
        delete img.dataset.loading;
      };
      next.onerror = () => {
        img.dataset.at = String(Date.now());
        delete img.dataset.loading;
      };
      next.src = url;
    }
  }

  _fmtTime(ms) {
    const tf = this._hass?.locale?.time_format;
    const hour12 = tf === "12" ? true : tf === "24" ? false : undefined;
    return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12 });
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

  async _onClick(e) {
    const el = e.target.closest?.("[data-action]");
    if (!el || !this._hass) return;
    const action = el.dataset.action;
    if (action === "menu") this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
    else if (action === "play") {
      const v = this._visits.find((x) => x.key === el.dataset.key);
      if (v?.events) this._openPlayer(v, Math.max(0, v.events.findIndex((e) => e.has_clip)));
    } else if (action === "clip") {
      const p = this._player;
      if (p) {
        p.idx = Math.min(p.visit.events.length - 1, Math.max(0, p.idx + Number(el.dataset.step)));
        this._renderPlayer();
      }
    } else if (action === "close-player") {
      if (e.target === el || el.tagName === "BUTTON") this._closePlayer();
    } else if (action === "live") {
      this._closePlayer();
      this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: el.dataset.entity }, bubbles: true, composed: true }));
    } else if (action === "range") {
      this._range = el.dataset.range;
      this._render();
    } else if (action === "toggle") {
      const id = el.dataset.entity;
      const on = this._hass.states[id]?.state === "on";
      if (on && el.dataset.confirm && !window.confirm(el.dataset.confirm)) return;
      try {
        await this._hass.callService("switch", on ? "turn_off" : "turn_on", { entity_id: id });
      } catch (err) {
        this._showToast(`Couldn't change ${id}: ${err.message || err}`);
      }
    }
  }

  _model() {
    const now = Date.now();
    return this._cameras.map((c) => {
      const camSt = this._hass.states[c.camera || `camera.${c.id}`];
      const sw = (name) => {
        const st = this._ent(c, `switch.${name}`);
        return st ? { id: st.entity_id || `switch.${c.id}_${name}`, on: st.state === "on", ok: live(st) } : null;
      };
      const present = c.labels.filter((l) => this._ent(c, `binary_sensor.${l}_occupancy`)?.state === "on");
      const alarms = c.security ? ALARM_SOUNDS.filter((s) => this._ent(c, `binary_sensor.${s}_sound`)?.state === "on") : [];
      const streamActive = this._ent(c, "binary_sensor.stream_active");
      const review = this._ent(c, "sensor.review_status");
      const lastPerson = this._visits.find((v) => v.cam.id === c.id && v.kind === "person");
      const personImg = this._ent(c, "image.person");
      return {
        ...c,
        cameraId: c.camera || `camera.${c.id}`,
        online: live(camSt),
        picture: camSt?.attributes?.entity_picture || "",
        detect: sw("detect"),
        record: sw("recordings"),
        audio: sw("audio_detection"),
        stream: sw("stream"),
        streamOn: streamActive ? streamActive.state === "on" : null,
        present,
        presentSince: present.length ? Math.min(...present.map((l) => Date.parse(this._ent(c, `binary_sensor.${l}_occupancy`).last_changed || now))) : null,
        alarms,
        reviewAlert: String(review?.state || "").toUpperCase() === "ALERT",
        personPicture: live(personImg) ? personImg.attributes?.entity_picture || "" : "",
        lastPerson,
      };
    });
  }

  _render() {
    if (!this._hass) return;
    const cams = this._model();
    const sec = cams.filter((c) => c.security);
    const now = Date.now();

    const offline = sec.filter((c) => !c.online);
    const alarms = sec.flatMap((c) => c.alarms.map((a) => ({ cam: c, kind: a })));
    const active = sec.filter((c) => c.present.length);
    const streamOff = sec.filter((c) => c.online && c.streamOn === false);
    const notRecording = sec.filter((c) => c.online && c.streamOn !== false && c.record && !c.record.on);
    const noDetect = sec.filter((c) => c.online && c.streamOn !== false && c.detect && !c.detect.on);
    const watching = sec.filter((c) => c.online && c.streamOn !== false && c.record?.on !== false && c.detect?.on !== false);
    const lastPerson = this._visits.find((v) => v.kind === "person");

    let status;
    if (alarms.length) status = { dot: "red", label: `${nice(alarms[0].kind)} heard`, detail: [...new Set(alarms.map((a) => a.cam.name))].join(", ") };
    else if (offline.length) status = { dot: "red", label: `${plural(offline.length, "camera")} offline`, detail: offline.map((c) => c.name).join(", ") };
    else if (active.length) {
      const c = active[0];
      status = { dot: "blue", label: `${nice(c.present[0])} in ${c.name}`, detail: `since ${this._fmtTime(c.presentSince)}${active.length > 1 ? ` · also ${active.slice(1).map((x) => x.name).join(", ")}` : ""}` };
    } else if (streamOff.length) status = { dot: "amber", label: `${streamOff.map((c) => c.name).join(", ")} camera off`, detail: "Video is switched off at the camera" };
    else if (notRecording.length) status = { dot: "amber", label: "Not recording", detail: notRecording.map((c) => c.name).join(", ") };
    else if (noDetect.length) status = { dot: "amber", label: "Detection off", detail: noDetect.map((c) => c.name).join(", ") };
    else status = { dot: "green", label: "All clear", detail: `${plural(watching.length, "camera")} watching${lastPerson ? ` · last person ${lastPerson.cam.name} ${agoText(lastPerson.start)}` : ""}` };

    const items = [];
    for (const a of alarms) items.push({ level: "red", icon: "mdiAlarmLight", title: `${nice(a.kind)} detected on ${a.cam.name}`, text: "Tap the camera to watch live." });
    for (const c of offline) items.push({ level: "red", icon: "mdiCctvOff", title: `${c.name} camera is offline`, text: "Frigate isn't getting video from it, so nothing is being watched or recorded there." });
    for (const c of streamOff) items.push({ level: "amber", icon: "mdiVideoOff", title: `${c.name} video is switched off`, text: "Turned off at the camera itself. No recording or detection until it's back on." });
    for (const c of notRecording) items.push({ level: "amber", icon: "mdiRecordRec", title: `${c.name} isn't recording`, text: "Detection may still alert you, but no footage is being saved." });
    for (const c of noDetect) items.push({ level: "amber", icon: "mdiMotionSensorOff", title: `Detection is off on ${c.name}`, text: "No person alerts or snapshots from this camera." });
    for (const c of sec.filter((x) => x.online && x.audio && !x.audio.on)) items.push({ level: "info", icon: "mdiMicrophoneOff", title: `Sound detection off on ${c.name}`, text: "Fire alarm, scream and yell sounds won't be noticed here." });
    for (const c of sec.filter((x) => x.reviewAlert)) items.push({ level: "info", icon: "mdiEyeOutline", title: `Unreviewed alerts on ${c.name}`, text: "Frigate has alerts you haven't reviewed yet." });

    // Camera tiles
    const tiles = cams
      .map((c) => {
        const pills = [];
        if (!c.security) pills.push(`<span class="pill">${svg("mdiPrinter3d")}Printer cam</span>`);
        if (c.alarms.length) pills.push(`<span class="pill bad">${svg("mdiAlarmLight")}${esc(nice(c.alarms[0]))}</span>`);
        if (c.present.length) pills.push(`<span class="pill now">${svg("mdiAccount")}${esc(nice(c.present[0]))} now</span>`);
        if (c.online && c.streamOn === false) pills.push(`<span class="pill warn">${svg("mdiVideoOff")}Video off</span>`);
        else if (c.online && c.record?.on) pills.push(`<span class="pill rec">${svg("mdiRecordRec")}Rec</span>`);
        else if (c.online && c.record && !c.record.on && c.security) pills.push(`<span class="pill warn">${svg("mdiRecordRec")}Not recording</span>`);
        if (c.online && c.security && c.detect && !c.detect.on) pills.push(`<span class="pill warn">Detection off</span>`);
        const cls = c.alarms.length ? "alarm-on" : c.present.length ? "active" : !c.online || c.streamOn === false ? "off" : "";
        return `<button class="cam ${cls}" data-action="live" data-entity="${esc(c.cameraId)}" aria-label="Watch ${esc(c.name)} live">
          ${c.online && c.picture ? `<img data-snap="${esc(c.picture)}" ${c.present.length || c.alarms.length ? 'data-active="1"' : ""} src="${esc(c.picture)}" alt="">` : ""}
          ${!c.online ? `<div class="center">${svg("mdiCctvOff")}<br>Offline</div>` : ""}
          <div class="pills">${pills.join("")}</div>
          <div class="shade"><span class="name">${esc(c.name)}</span><span class="live">${svg("mdiPlayCircleOutline")}Live</span></div>
        </button>`;
      })
      .join("");
    const camsCard = `<section class="card a-cams">
      <div class="head"><span class="eyebrow">Cameras</span><span class="muted">${watching.length} of ${sec.length} watching</span></div>
      <div class="cams">${tiles}</div>
      <div class="hint">Tap a camera to watch it live.</div>
    </section>`;

    // Timeline
    const week = this._range === "week";
    const visits = this._visits.filter((v) => now - v.start <= (week ? HISTORY_DAYS * 864e5 : 864e5));
    const perCam = Object.entries(visits.filter((v) => !v.alarm).reduce((a, v) => ((a[v.cam.name] = (a[v.cam.name] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
    const listed = this._range === "recent" ? visits.slice(0, 8) : visits.slice(0, 300);
    const latestVisits = sec.map((c) => this._visits.find((v) => v.cam.id === c.id && v.kind === "person" && v.events)).filter(Boolean);
    const latest = latestVisits.length ? [] : sec.filter((c) => c.personPicture);
    let lastDay = null;
    const rows = listed
      .map((v) => {
        const day = dayLabel(v.start);
        const header = day !== lastDay ? `<div class="day">${esc(day)}</div>` : "";
        lastDay = day;
        const icon = v.alarm ? "mdiAlarmLight" : v.kind === "car" ? "mdiCar" : "mdiAccount";
        const dur = v.end ? fmtDur(v.end - v.start) : "ongoing";
        const first = v.events?.find((e) => e.has_clip) || v.events?.[0];
        const thumb = first ? `<img class="th" data-sign="${esc(this._media(first, "thumbnail.jpg"))}" alt="">` : svg(icon);
        const clips = v.events ? v.events.filter((e) => e.has_clip).length : 0;
        const body = `<span class="t">${this._fmtTime(v.start)}</span>${thumb}<span class="w">${esc(nice(v.kind))} · ${esc(v.cam.name)}${clips > 1 ? ` <small>${clips} clips</small>` : ""}</span><span class="d">${esc(dur)}${first ? ` ${svg("mdiPlay")}` : ""}</span>`;
        return first
          ? `${header}<button class="ev play ${v.alarm ? "alarm-ev" : ""}" data-action="play" data-key="${esc(v.key)}">${body}</button>`
          : `${header}<div class="ev ${v.alarm ? "alarm-ev" : ""}">${body}</div>`;
      })
      .join("");
    const timeline = `<section class="card a-timeline">
      <div class="head"><span class="eyebrow">Activity</span><span class="muted">${week ? "last 7 days" : "last 24 h"}</span></div>
      ${perCam.length ? `<div class="summary"><b>${plural(perCam.reduce((n, [, c]) => n + c, 0), "visit")}</b> · ${perCam.map(([n, c]) => `${esc(n)} ${c}`).join(" · ")}</div>` : ""}
      ${
        latestVisits.length
          ? `<div class="latest">${latestVisits
              .map((v) => {
                const ev = v.events.find((e) => e.has_clip) || v.events[0];
                return `<button class="snap" data-action="play" data-key="${esc(v.key)}"><img data-sign="${esc(this._media(ev, "snapshot.jpg"))}" alt="Latest person on ${esc(v.cam.name)}"><div><b>${esc(v.cam.name)}</b> · ${esc(agoText(v.start))}</div></button>`;
              })
              .join("")}</div>`
          : latest.length
          ? `<div class="latest">${latest
              .map(
                (c) => `<button class="snap" data-action="live" data-entity="${esc(c.cameraId)}"><img src="${esc(c.personPicture)}" alt="Latest person on ${esc(c.name)}"><div><b>${esc(c.name)}</b>${c.lastPerson ? ` · ${esc(agoText(c.lastPerson.start))}` : ""}</div></button>`,
              )
              .join("")}</div>`
          : ""
      }
      ${rows || `<div class="empty">No people or alarms ${week ? "this week" : "in the last 24 hours"}.</div>`}
      <div class="links">
        ${this._range === "recent" && visits.length > listed.length ? `<button class="link" data-action="range" data-range="day">Show all ${visits.length} from today</button>` : ""}
        ${this._range !== "recent" ? `<button class="link" data-action="range" data-range="recent">Show less</button>` : ""}
        ${!week ? `<button class="link" data-action="range" data-range="week">Show last 7 days</button>` : ""}
      </div>
    </section>`;

    const attn = `<section class="card a-attn">
      <div class="head"><span class="eyebrow">Needs attention</span>${items.length ? `<span class="muted">${items.length}</span>` : ""}</div>
      ${
        items.length
          ? `<div class="items">${items.map((i) => `<div class="item ${i.level}">${svg(i.icon)}<div><b>${esc(i.title)}</b><span>${esc(i.text)}</span></div></div>`).join("")}</div>`
          : `<div class="allgood">${svg("mdiShieldCheckOutline")} Every camera is online, recording and detecting.</div>`
      }
    </section>`;

    // Settings: turning coverage off asks first; turning it on doesn't.
    const cell = (c, sw, label, offWarning) => {
      if (!sw) return `<div class="cell"><span class="lbl">${label}</span><span class="ro">—</span></div>`;
      const confirm = c.security && offWarning ? `Turn off ${label.toLowerCase()} for ${c.name}? ${offWarning}` : "";
      return `<div class="cell"><span class="lbl">${label}</span><button class="toggle ${sw.on ? "on" : ""}" data-action="toggle" data-entity="${esc(sw.id)}" ${confirm ? `data-confirm="${esc(confirm)}"` : ""} aria-pressed="${sw.on}" aria-label="${esc(`${c.name} ${label}`)}" ${sw.ok ? "" : "disabled"}></button></div>`;
    };
    const streamCell = (c) => {
      if (c.stream) return cell(c, c.stream, "Video", "The camera stops sending video entirely: nothing is watched or recorded until it's turned back on.");
      if (c.streamOn === null) return `<div class="cell"><span class="lbl">Video</span><span class="ro">—</span></div>`;
      return `<div class="cell"><span class="lbl">Video</span><span class="ro ${c.streamOn ? "on" : ""}">${c.streamOn ? "On" : "Off"}</span></div>`;
    };
    const settings = `<section class="card a-settings">
      <div class="head"><span class="eyebrow">Camera settings</span></div>
      <div class="table">
        <div class="th">Camera</div><div class="th">Detection</div><div class="th">Recording</div><div class="th">Sound</div><div class="th">Video</div>
        ${cams
          .map(
            (c) => `<div class="cn">${esc(c.name)}<small>${!c.online ? "Offline" : c.security ? "Security" : "Not used for alerts"}</small></div>
          ${cell(c, c.detect, "Detection", "You won't get person alerts or snapshots from this camera.")}
          ${cell(c, c.record, "Recording", "Nothing will be saved from this camera.")}
          ${cell(c, c.audio, "Sound", "Fire alarm, scream and yell sounds won't be noticed here.")}
          ${streamCell(c)}`,
          )
          .join("")}
      </div>
    </section>`;

    const s = status;
    const html = `
      <div class="app">
        <header class="top">
          ${this._narrow ? `<button class="icon-btn" data-action="menu" aria-label="Menu">${svg("mdiMenu")}</button>` : ""}
          <div class="brand">${svg("mdiShieldHome")}</div>
          <div class="titles"><h1>Security</h1>
            <div class="status"><span class="dot ${s.dot}"></span><b>${esc(s.label)}</b><span class="muted">·</span><span class="muted detail">${esc(s.detail)}</span></div></div>
        </header>
        ${alarms.length ? `<div class="alarm" role="alert">${svg("mdiAlarmLight")}<span>${esc(alarms.map((a) => `${nice(a.kind)} detected · ${a.cam.name}`).join(" · "))}</span></div>` : ""}
        <main class="grid">${camsCard}${timeline}${attn}${settings}</main>
        ${this._toast ? `<div class="toast" role="alert">${esc(this._toast)}</div>` : ""}
      </div>`;
    if (html !== this._html) {
      this._html = html;
      this._main.innerHTML = html;
      this._refreshSnapshots();
    }
    this._hydrate(this._main);
  }
}

function loadFont() {
  if (document.querySelector("link[href*='family=Outfit']")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

if (!customElements.get("security-panel")) customElements.define("security-panel", SecurityPanel);
