// Network panel: a dependency-free web component registered via panel_custom.
// Reads the UniFi Integration API rest sensors + ping sensors; device ids and
// sensor names come from panel_custom `config` in configuration.yaml.

const ICONS = {
  mdiAccessPointOff: "M20.84 22.73L12.1 14C12.06 14 12.03 14 12 14C10.9 14 10 13.11 10 12C10 11.97 10 11.94 10 11.9L8.4 10.29C8.15 10.81 8 11.38 8 12C8 13.11 8.45 14.11 9.17 14.83L7.76 16.24C6.67 15.15 6 13.65 6 12C6 10.83 6.34 9.74 6.93 8.82L5.5 7.37C4.55 8.67 4 10.27 4 12C4 14.22 4.89 16.22 6.34 17.66L4.93 19.07C3.12 17.26 2 14.76 2 12C2 9.72 2.77 7.63 4.06 5.95L1.11 3L2.39 1.73L22.11 21.46L20.84 22.73M15.93 12.73L17.53 14.33C17.83 13.61 18 12.83 18 12C18 10.35 17.33 8.85 16.24 7.76L14.83 9.17C15.55 9.89 16 10.89 16 12C16 12.25 15.97 12.5 15.93 12.73M19.03 15.83L20.5 17.28C21.44 15.75 22 13.94 22 12C22 9.24 20.88 6.74 19.07 4.93L17.66 6.34C19.11 7.78 20 9.79 20 12C20 13.39 19.65 14.7 19.03 15.83Z",
  mdiAlertOutline: "M12,2L1,21H23M12,6L19.53,19H4.47M11,10V14H13V10M11,16V18H13V16",
  mdiArrowDown: "M11,4H13V16L18.5,10.5L19.92,11.92L12,19.84L4.08,11.92L5.5,10.5L11,16V4Z",
  mdiArrowUp: "M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z",
  mdiCheckCircleOutline: "M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M12 20C7.59 20 4 16.41 4 12S7.59 4 12 4 20 7.59 20 12 16.41 20 12 20M16.59 7.58L10 14.17L7.41 11.59L6 13L10 17L18 9L16.59 7.58Z",
  mdiEthernet: "M7,15H9V18H11V15H13V18H15V15H17V18H19V9H15V6H9V9H5V18H7V15M4.38,3H19.63C20.94,3 22,4.06 22,5.38V19.63A2.37,2.37 0 0,1 19.63,22H4.38C3.06,22 2,20.94 2,19.63V5.38C2,4.06 3.06,3 4.38,3Z",
  mdiLanDisconnect: "M4,1C2.89,1 2,1.89 2,3V7C2,8.11 2.89,9 4,9H1V11H13V9H10C11.11,9 12,8.11 12,7V3C12,1.89 11.11,1 10,1H4M4,3H10V7H4V3M14,13C12.89,13 12,13.89 12,15V19C12,20.11 12.89,21 14,21H11V23H23V21H20C21.11,21 22,20.11 22,19V15C22,13.89 21.11,13 20,13H14M3.88,13.46L2.46,14.88L4.59,17L2.46,19.12L3.88,20.54L6,18.41L8.12,20.54L9.54,19.12L7.41,17L9.54,14.88L8.12,13.46L6,15.59L3.88,13.46M14,15H20V19H14V15Z",
  mdiMemory: "M17,17H7V7H17M21,11V9H19V7C19,5.89 18.1,5 17,5H15V3H13V5H11V3H9V5H7C5.89,5 5,5.89 5,7V9H3V11H5V13H3V15H5V17A2,2 0 0,0 7,19H9V21H11V19H13V21H15V19H17A2,2 0 0,0 19,17V15H21V13H19V11M13,13H11V11H13M15,9H9V15H15V9Z",
  mdiMenu: "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",
  mdiRouterNetwork: "M5 9C3.9 9 3 9.9 3 11V15C3 16.11 3.9 17 5 17H11V19H10C9.45 19 9 19.45 9 20H2V22H9C9 22.55 9.45 23 10 23H14C14.55 23 15 22.55 15 22H22V20H15C15 19.45 14.55 19 14 19H13V17H19C20.11 17 21 16.11 21 15V11C21 9.9 20.11 9 19 9H5M6 12H8V14H6V12M9.5 12H11.5V14H9.5V12M13 12H15V14H13V12Z",
  mdiRouterWireless: "M20.2,5.9L21,5.1C19.6,3.7 17.8,3 16,3C14.2,3 12.4,3.7 11,5.1L11.8,5.9C13,4.8 14.5,4.2 16,4.2C17.5,4.2 19,4.8 20.2,5.9M19.3,6.7C18.4,5.8 17.2,5.3 16,5.3C14.8,5.3 13.6,5.8 12.7,6.7L13.5,7.5C14.2,6.8 15.1,6.5 16,6.5C16.9,6.5 17.8,6.8 18.5,7.5L19.3,6.7M19,13H17V9H15V13H5A2,2 0 0,0 3,15V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V15A2,2 0 0,0 19,13M8,18H6V16H8V18M11.5,18H9.5V16H11.5V18M15,18H13V16H15V18Z",
  mdiTimerOutline: "M12,20A7,7 0 0,1 5,13A7,7 0 0,1 12,6A7,7 0 0,1 19,13A7,7 0 0,1 12,20M19.03,7.39L20.45,5.97C20,5.46 19.55,5 19.04,4.56L17.62,6C16.07,4.74 14.12,4 12,4A9,9 0 0,0 3,13A9,9 0 0,0 12,22C17,22 21,17.97 21,13C21,10.88 20.26,8.93 19.03,7.39M11,14H13V8H11M15,1H9V3H15V1Z",
  mdiUpdate: "M21,10.12H14.22L16.96,7.3C14.23,4.6 9.81,4.5 7.08,7.2C4.35,9.91 4.35,14.28 7.08,17C9.81,19.7 14.23,19.7 16.96,17C18.32,15.65 19,14.08 19,12.1H21C21,14.08 20.12,16.65 18.36,18.39C14.85,21.87 9.15,21.87 5.64,18.39C2.14,14.92 2.11,9.28 5.62,5.81C9.13,2.34 14.76,2.34 18.27,5.81L21,3V10.12M12.5,8V12.25L16,14.33L15.28,15.54L11,13V8H12.5Z",
  mdiWeb: "M16.36,14C16.44,13.34 16.5,12.68 16.5,12C16.5,11.32 16.44,10.66 16.36,10H19.74C19.9,10.64 20,11.31 20,12C20,12.69 19.9,13.36 19.74,14M14.59,19.56C15.19,18.45 15.65,17.25 15.97,16H18.92C17.96,17.65 16.43,18.93 14.59,19.56M14.34,14H9.66C9.56,13.34 9.5,12.68 9.5,12C9.5,11.32 9.56,10.65 9.66,10H14.34C14.43,10.65 14.5,11.32 14.5,12C14.5,12.68 14.43,13.34 14.34,14M12,19.96C11.17,18.76 10.5,17.43 10.09,16H13.91C13.5,17.43 12.83,18.76 12,19.96M8,8H5.08C6.03,6.34 7.57,5.06 9.4,4.44C8.8,5.55 8.35,6.75 8,8M5.08,16H8C8.35,17.25 8.8,18.45 9.4,19.56C7.57,18.93 6.03,17.65 5.08,16M4.26,14C4.1,13.36 4,12.69 4,12C4,11.31 4.1,10.64 4.26,10H7.64C7.56,10.66 7.5,11.32 7.5,12C7.5,12.68 7.56,13.34 7.64,14M12,4.03C12.83,5.23 13.5,6.57 13.91,8H10.09C10.5,6.57 11.17,5.23 12,4.03M18.92,8H15.97C15.65,6.75 15.19,5.55 14.59,4.44C16.43,5.07 17.96,6.34 18.92,8M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z",
  mdiWifi: "M12,21L15.6,16.2C14.6,15.45 13.35,15 12,15C10.65,15 9.4,15.45 8.4,16.2L12,21M12,3C7.95,3 4.21,4.34 1.2,6.6L3,9C5.5,7.12 8.62,6 12,6C15.38,6 18.5,7.12 21,9L22.8,6.6C19.79,4.34 16.05,3 12,3M12,9C9.3,9 6.81,9.89 4.8,11.4L6.6,13.8C8.1,12.67 9.97,12 12,12C14.03,12 15.9,12.67 17.4,13.8L19.2,11.4C17.19,9.89 14.7,9 12,9Z",
  mdiWifiAlert: "M20.24 5H18V7.25C16.16 6.45 14.13 6 12 6C8.62 6 5.5 7.12 3 9L1.2 6.6C4.21 4.34 7.95 3 12 3C14.97 3 17.77 3.73 20.24 5M8.4 16.2L12 21L15.6 16.2C14.6 15.45 13.35 15 12 15S9.4 15.45 8.4 16.2M4.8 11.4L6.6 13.8C8.1 12.67 9.97 12 12 12S15.9 12.67 17.4 13.8L18 13V10.62C16.23 9.59 14.19 9 12 9C9.3 9 6.81 9.89 4.8 11.4M20 17H22V15H20V17M20 7V13H22V7H20Z",
};

const SLOW_MS = 100;
const RETRY_WARN_PCT = 30;
const HISTORY_HOURS = 24;

const svg = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ""}"/></svg>`;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
const live = (st) => !!st && !["unavailable", "unknown"].includes(st.state);

function fmtUptime(sec) {
  if (!Number.isFinite(sec)) return "";
  const d = Math.floor(sec / 86400);
  if (d >= 1) return plural(d, "day");
  const h = Math.floor(sec / 3600);
  return h >= 1 ? plural(h, "hour") : plural(Math.max(1, Math.floor(sec / 60)), "minute");
}

function fmtRate(mbps) {
  if (mbps === null) return "—";
  if (mbps < 1) return `${Math.round(mbps * 1000)} kbps`;
  return `${mbps < 10 ? mbps.toFixed(1) : Math.round(mbps)} Mbps`;
}

function ago(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (!Number.isFinite(s)) return "";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

function since(ms) {
  const d = new Date(ms);
  const days = Math.floor((Date.now() - ms) / 864e5);
  const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
  return days >= 1 ? `${date} (${plural(days, "day")})` : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function sparkline(points, cls) {
  if (points.length < 2) return `<div class="spark-empty">Collecting history…</div>`;
  const t0 = points[0][0];
  const t1 = points[points.length - 1][0];
  const max = Math.max(...points.map((p) => p[1])) * 1.15 || 1;
  const W = 300;
  const H = 60;
  const xy = points.map(([t, v]) => [((t - t0) / Math.max(1, t1 - t0)) * W, H - (v / max) * (H - 4) - 2]);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const [lx, ly] = xy[xy.length - 1];
  return `<svg class="spark ${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <path class="area" d="${line}L${W},${H}L0,${H}Z"/><path class="line" d="${line}"/>
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3"/></svg>`;
}

const CSS = `
:host {
  --bg: #080d17; --card: #0f1624; --card-2: #141d2e; --line: rgba(148,170,200,.12);
  --text: #eef3fa; --muted: #8593a8; --teal: #2dd4bf; --teal-2: #0d9488;
  --green: #22c55e; --amber: #f5b041; --red: #f0616d; --grey: #64748b; --blue: #4cc3ff;
  display: block; height: 100%; overflow-y: auto; container-type: inline-size;
  background: radial-gradient(1200px 600px at 10% -10%, rgba(20,140,130,.16), transparent 60%),
              radial-gradient(900px 500px at 110% 110%, rgba(40,110,190,.10), transparent 60%), var(--bg);
  color: var(--text); font-family: "Outfit", "SF Pro Display", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
* { box-sizing: border-box; }
button { font: inherit; color: inherit; border: 0; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.ic { width: 24px; height: 24px; fill: currentColor; flex: none; }
.muted { color: var(--muted); }
.app { max-width: 1480px; margin: 0 auto; padding: 28px 28px 40px; }

.top { display: flex; align-items: center; gap: 18px; margin-bottom: 26px; }
.brand { width: 76px; height: 76px; border-radius: 22px; display: grid; place-items: center; flex: none; color: #fff;
  background: linear-gradient(160deg, #5eead4, var(--teal-2)); box-shadow: 0 10px 30px rgba(13,148,136,.35), inset 0 1px 0 rgba(255,255,255,.35); }
.brand .ic { width: 38px; height: 38px; }
.titles { flex: 1 1 0; min-width: 0; }
h1 { margin: 0; font-size: 34px; font-weight: 700; line-height: 1.1; }
.status { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 18px; white-space: nowrap; overflow: hidden; }
.status b { font-weight: 600; }
.status .detail { overflow: hidden; text-overflow: ellipsis; }
.dot { width: 12px; height: 12px; border-radius: 50%; flex: none; background: var(--grey); }
.dot.green { background: var(--green); box-shadow: 0 0 10px var(--green); }
.dot.amber { background: var(--amber); box-shadow: 0 0 10px var(--amber); }
.dot.red { background: var(--red); box-shadow: 0 0 10px var(--red); animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .35; } }
.icon-btn { width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; background: var(--card-2); border: 1px solid var(--line); flex: none; }
.banner { margin: -8px 0 20px; padding: 14px 18px; border-radius: 16px; display: flex; gap: 10px; align-items: flex-start; line-height: 1.45;
  background: rgba(245,176,65,.08); border: 1px solid rgba(245,176,65,.3); color: #f7d49a; }

.grid { display: grid; gap: 22px; align-items: start; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-areas: "path path" "internet wifi" "clients attn"; }
.card { background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line); border-radius: 30px; padding: 24px 26px; min-width: 0; }
.a-path { grid-area: path; } .a-internet { grid-area: internet; } .a-wifi { grid-area: wifi; } .a-clients { grid-area: clients; } .a-attn { grid-area: attn; }
.eyebrow { font-size: 13px; letter-spacing: .12em; font-weight: 600; color: var(--muted); text-transform: uppercase; }
.head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }

/* Path: Internet -> Gateway -> Wi-Fi */
.path { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 44px; margin-top: 16px; }
.node { position: relative; border-radius: 22px; padding: 18px 18px 16px; background: #121a28; border: 1.5px solid var(--line); min-width: 0; }
.node:not(:last-child)::after { content: ""; position: absolute; top: 50%; right: -46px; width: 44px; height: 3px; border-radius: 2px; background: var(--c, var(--grey)); }
.node.green { --c: var(--green); border-color: rgba(34,197,94,.35); }
.node.amber { --c: var(--amber); border-color: rgba(245,176,65,.45); }
.node.red { --c: var(--red); border-color: rgba(240,97,109,.55); background: #1f1520; }
.node.grey { --c: var(--grey); }
.node-top { display: flex; align-items: center; gap: 12px; }
.nic { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; color: #fff; flex: none; background: #243246; }
.node.green .nic { background: linear-gradient(160deg, #5eead4, var(--teal-2)); }
.node.amber .nic { background: linear-gradient(160deg, #fcd58a, #d98b16); }
.node.red .nic { background: linear-gradient(160deg, #ff9aa2, #d9434f); }
.node-name { font-size: 15px; color: var(--muted); }
.node-state { font-size: 22px; font-weight: 600; line-height: 1.15; }
.node-sub { margin-top: 10px; font-size: 15px; color: #c3cedd; line-height: 1.45; }

/* Internet */
.big { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 16px; }
.metric { border-radius: 18px; background: #121a28; border: 1px solid var(--line); padding: 14px 16px; min-width: 0; }
.metric .v { font-size: 30px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
.metric .v small { font-size: 15px; color: var(--muted); font-weight: 500; margin-left: 4px; }
.metric .l { font-size: 14px; color: var(--muted); margin-top: 2px; display: flex; align-items: center; gap: 6px; }
.metric .l .ic { width: 16px; height: 16px; }
.metric.warn .v { color: var(--amber); } .metric.bad .v { color: var(--red); }
.note { font-size: 13px; color: var(--muted); margin-top: 8px; }
.chart { margin-top: 16px; }
.chart .cap { display: flex; justify-content: space-between; font-size: 13px; color: var(--muted); margin-bottom: 6px; }
.spark { width: 100%; height: 60px; display: block; overflow: visible; }
.spark .line { fill: none; stroke: var(--teal); stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
.spark .area { fill: rgba(45,212,191,.10); stroke: none; }
.spark circle { fill: var(--teal); }
.spark.blue .line { stroke: var(--blue); } .spark.blue .area { fill: rgba(76,195,255,.10); } .spark.blue circle { fill: var(--blue); }
.spark-empty { height: 60px; display: grid; place-items: center; font-size: 13px; color: var(--muted); border: 1px dashed var(--line); border-radius: 12px; }
.kv { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 16px; font-size: 14px; color: var(--muted); }
.kv b { color: #c3cedd; font-weight: 500; }

/* Wi-Fi */
.aps { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
.ap { border-radius: 20px; background: #121a28; border: 1px solid var(--line); padding: 14px 16px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 14px; align-items: center; }
.ap-name { font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; min-width: 0; }
.ap-name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tag { font-size: 12px; font-weight: 600; padding: 3px 8px; border-radius: 8px; background: #1b2638; color: #aeb9c9; flex: none; }
.tag.off { background: rgba(245,176,65,.14); color: var(--amber); }
.tag.retired { background: #1b2638; color: var(--grey); }
.ap-clients { font-size: 26px; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
.ap-clients small { font-size: 13px; color: var(--muted); font-weight: 500; display: block; margin-top: -4px; }
.bands { display: flex; gap: 8px; flex-wrap: wrap; font-size: 13px; }
.band { padding: 4px 9px; border-radius: 8px; background: #172234; color: #b8c4d4; }
.band.warn { background: rgba(245,176,65,.12); color: #f7c77a; }
.ap.offline { opacity: .6; }
.ap.retired { opacity: .45; }

/* Clients */
.counts { display: flex; gap: 22px; align-items: baseline; margin-top: 12px; flex-wrap: wrap; }
.counts .total { font-size: 44px; font-weight: 700; letter-spacing: -.02em; line-height: 1; }
.counts .split { font-size: 15px; color: var(--muted); }
.bar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; margin-top: 16px; background: #172234; gap: 2px; }
.bar div { height: 100%; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 10px; font-size: 13px; color: var(--muted); }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
.list { margin-top: 16px; display: flex; flex-direction: column; }
.row { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 9px 0; border-top: 1px solid var(--line); font-size: 15px; }
.row .ic { width: 18px; height: 18px; color: var(--muted); }
.row .n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row .n small { color: var(--muted); margin-left: 6px; }
.row .t { color: var(--muted); font-size: 13px; white-space: nowrap; }
.group { margin-top: 14px; font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
.link { margin-top: 12px; color: var(--teal); font-weight: 600; font-size: 15px; }

/* Attention */
.items { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.item { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: 16px; background: #121a28; border: 1px solid var(--line); line-height: 1.4; }
.item .ic { width: 22px; height: 22px; margin-top: 1px; }
.item b { font-weight: 600; display: block; font-size: 16px; }
.item span { font-size: 14px; color: var(--muted); }
.item.amber { border-color: rgba(245,176,65,.3); } .item.amber .ic { color: var(--amber); }
.item.red { border-color: rgba(240,97,109,.4); } .item.red .ic { color: var(--red); }
.item.info .ic { color: var(--blue); }
.allgood { display: flex; gap: 12px; align-items: center; margin-top: 14px; font-size: 16px; color: #b9f2cc; }
.allgood .ic { color: var(--green); }

@container (max-width: 980px) {
  .grid { grid-template-columns: minmax(0, 1fr); grid-template-areas: "path" "attn" "internet" "wifi" "clients"; }
}
@container (max-width: 640px) {
  .app { padding: 14px 14px 24px; }
  .top { gap: 12px; margin-bottom: 16px; }
  .brand, .icon-btn { width: 44px; height: 44px; border-radius: 14px; }
  .brand .ic { width: 24px; height: 24px; }
  h1 { font-size: 22px; } .status { font-size: 14px; margin-top: 3px; } .dot { width: 10px; height: 10px; }
  .banner { font-size: 14px; }
  .grid { gap: 14px; }
  .card { border-radius: 24px; padding: 18px 16px; }
  .path { grid-template-columns: minmax(0, 1fr); gap: 22px; margin-top: 12px; }
  .node { padding: 12px 14px; border-radius: 18px; }
  .node:not(:last-child)::after { top: auto; bottom: -22px; right: auto; left: 36px; width: 3px; height: 20px; }
  .nic { width: 40px; height: 40px; border-radius: 12px; }
  .nic .ic { width: 22px; height: 22px; }
  .node-state { font-size: 18px; } .node-name { font-size: 13px; } .node-sub { font-size: 13.5px; margin-top: 6px; }
  .metric { padding: 12px; } .metric .v { font-size: 22px; } .metric .v small { font-size: 13px; } .metric .l { font-size: 12.5px; }
  .ap { padding: 12px; } .ap-name { font-size: 16px; } .ap-clients { font-size: 22px; }
  .counts .total { font-size: 36px; }
  .row { font-size: 14px; }
}
`;

class NetworkPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._history = {};
    this._showAll = false;
    this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
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
    this._historyTimer = setInterval(() => this._loadHistory(), 5 * 60e3);
    if (this._hass) this._loadHistory();
    this._scheduleRender();
  }

  disconnectedCallback() {
    clearInterval(this._tick);
    clearInterval(this._historyTimer);
  }

  get _config() {
    return {
      stats: {},
      latency: {},
      retired: [],
      devices: "sensor.network_devices",
      clients: "sensor.network_clients",
      ...(this._cfg || {}),
    };
  }

  async _loadHistory() {
    const c = this._config;
    const ids = [Object.values(c.latency)[0], c.download].filter(Boolean);
    if (!this._hass || !ids.length) return;
    try {
      const res = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: new Date(Date.now() - HISTORY_HOURS * 3600e3).toISOString(),
        entity_ids: ids,
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      });
      const out = {};
      for (const [id, rows] of Object.entries(res || {})) {
        out[id] = rows.map((r) => [(r.lc ?? r.lu) * 1000, num(r.s)]).filter((p) => p[1] !== null);
      }
      this._history = out;
      this._scheduleRender();
    } catch (_) {
      /* sparklines are optional */
    }
  }

  _scheduleRender() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this._render();
    });
  }

  _onClick(e) {
    const el = e.target.closest?.("[data-action]");
    if (!el) return;
    if (el.dataset.action === "menu") this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
    if (el.dataset.action === "all") {
      this._showAll = !this._showAll;
      this._render();
    }
  }

  _model() {
    const c = this._config;
    const st = this._hass.states;
    const devSensor = st[c.devices];
    const clientSensor = st[c.clients];
    const unifiOk = live(devSensor);
    const devices = (devSensor?.attributes?.data || []).map((d) => {
      const s = st[c.stats[d.id]];
      const a = s?.attributes || {};
      return {
        ...d,
        online: d.state === "ONLINE",
        retired: c.retired.includes(d.id),
        isGateway: d.id === c.gateway,
        cpu: live(s) ? num(s.state) : null,
        mem: num(a.memoryUtilizationPct),
        uptime: num(a.uptimeSec),
        radios: a.interfaces?.radios || [],
        lastSeen: a.lastHeartbeatAt ? Date.parse(a.lastHeartbeatAt) : null,
      };
    });
    const clients = live(clientSensor) ? clientSensor.attributes?.data || [] : [];
    const latency = Object.entries(c.latency).map(([label, id]) => {
      const s = st[id];
      return { label, id, exists: !!s, ms: live(s) ? num(s.state) : null, loss: num(s?.attributes?.loss) };
    });
    return {
      unifiOk,
      clientsOk: live(clientSensor),
      devices,
      gateway: devices.find((d) => d.isGateway) || null,
      aps: devices.filter((d) => (d.features || []).includes("accessPoint")),
      clients,
      totalClients: live(clientSensor) ? num(clientSensor.state) : null,
      latency,
      down: num(st[c.download]?.state),
      up: num(st[c.upload]?.state),
    };
  }

  _evaluate(m) {
    const measured = m.latency.filter((l) => l.exists);
    const reachable = measured.filter((l) => l.ms !== null);
    const best = reachable.length ? Math.min(...reachable.map((l) => l.ms)) : null;

    let internet;
    if (!measured.length) internet = { level: "grey", word: "Unknown", sub: "No latency sensors configured" };
    else if (!reachable.length) internet = { level: "red", word: "Down", sub: `No replies from ${measured.map((l) => l.label).join(" or ")}` };
    else if (best > SLOW_MS) internet = { level: "amber", word: "Slow", sub: `${Math.round(best)} ms to ${reachable.find((l) => l.ms === best).label}` };
    else internet = { level: "green", word: "Online", sub: reachable.map((l) => `${l.label} ${Math.round(l.ms)} ms`).join(" · ") };

    let gateway;
    const g = m.gateway;
    if (!m.unifiOk || !g) gateway = { level: "grey", word: "No data", sub: "Can't read UniFi right now" };
    else if (!g.online) gateway = { level: "red", word: "Offline", sub: `${g.name} isn't responding` };
    else if ((g.cpu ?? 0) > 90 || (g.mem ?? 0) > 95) gateway = { level: "amber", word: "Busy", sub: `CPU ${Math.round(g.cpu ?? 0)}% · memory ${Math.round(g.mem ?? 0)}%` };
    else gateway = { level: "green", word: "Online", sub: `${g.name}${g.uptime ? ` · up ${fmtUptime(g.uptime)}` : ""}` };

    const activeAps = m.aps.filter((a) => !a.retired);
    const downAps = activeAps.filter((a) => !a.online);
    const wireless = m.clients.filter((c) => c.type === "WIRELESS").length;
    let wifi;
    if (!m.unifiOk) wifi = { level: "grey", word: "No data", sub: "Can't read UniFi right now" };
    else if (activeAps.length && downAps.length === activeAps.length) wifi = { level: "red", word: "Down", sub: "No access points online" };
    else if (downAps.length) wifi = { level: "amber", word: "Degraded", sub: `${downAps.map((a) => a.name).join(", ")} offline · ${wireless} on Wi-Fi` };
    else wifi = { level: "green", word: "Online", sub: `${plural(activeAps.length, "access point")} · ${wireless} on Wi-Fi` };

    // Headline: the most upstream problem wins; "can't read data" is never reported as "down".
    let status;
    if (internet.level === "red") status = { dot: "red", label: "Internet down", detail: internet.sub };
    else if (gateway.level === "red") status = { dot: "red", label: "Gateway offline", detail: gateway.sub };
    else if (wifi.level === "red") status = { dot: "red", label: "Wi-Fi down", detail: wifi.sub };
    else if (internet.level === "amber") status = { dot: "amber", label: "Internet slow", detail: internet.sub };
    else if (wifi.level === "amber") status = { dot: "amber", label: "Wi-Fi degraded", detail: wifi.sub };
    else if (gateway.level === "amber") status = { dot: "amber", label: "Gateway busy", detail: gateway.sub };
    else if (!m.unifiOk) status = { dot: "", label: internet.level === "green" ? "Internet OK" : "No data", detail: "UniFi data unavailable" };
    else status = { dot: "green", label: "All good", detail: `${internet.sub.split(" · ")[0]} · ${plural(m.totalClients ?? 0, "device")} connected` };

    const items = [];
    for (const a of downAps)
      items.push({ level: "amber", icon: "mdiAccessPointOff", title: `${a.name} is offline${a.lastSeen ? ` since ${since(a.lastSeen)}` : ""}`, text: a.lastSeen && Date.now() - a.lastSeen > 7 * 864e5 ? "Out for a while. If it's been removed on purpose, mark it retired so it stops counting against Wi-Fi status." : "Anything that relied on this access point is on a weaker signal or disconnected." });
    for (const d of m.devices.filter((x) => x.firmwareUpdatable)) items.push({ level: "info", icon: "mdiUpdate", title: `Firmware update for ${d.name}`, text: `Running ${d.firmwareVersion}. Update from the UniFi app when convenient.` });
    for (const d of m.devices.filter((x) => x.online)) {
      for (const r of d.radios) {
        if ((r.txRetriesPct ?? 0) > RETRY_WARN_PCT)
          items.push({ level: "info", icon: "mdiWifiAlert", title: `${d.name}: busy ${r.frequencyGHz} GHz`, text: `${Math.round(r.txRetriesPct)}% of transmissions are retried — interference or a crowded channel. Worth a look if nearby devices feel slow.` });
      }
      if ((d.mem ?? 0) > 90) items.push({ level: "amber", icon: "mdiMemory", title: `${d.name} memory at ${Math.round(d.mem)}%`, text: "Consider restarting it from the UniFi app if it stays this high." });
    }
    for (const l of m.latency.filter((x) => x.ms !== null && (x.loss ?? 0) > 0))
      items.push({ level: "info", icon: "mdiLanDisconnect", title: `Packet loss to ${l.label}`, text: `${Math.round(l.loss)}% of pings lost in the last check.` });
    return { internet, gateway, wifi, status, items };
  }

  _render() {
    if (!this._hass) return;
    const c = this._config;
    const m = this._model();
    const ev = this._evaluate(m);
    const deviceName = Object.fromEntries(m.devices.map((d) => [d.id, d.name]));

    const node = (icon, name, s) => `
      <div class="node ${s.level}">
        <div class="node-top"><div class="nic">${svg(icon)}</div><div><div class="node-name">${esc(name)}</div><div class="node-state">${esc(s.word)}</div></div></div>
        <div class="node-sub">${esc(s.sub)}</div>
      </div>`;
    const path = `
      <section class="card a-path">
        <div class="eyebrow">Connection path</div>
        <div class="path">
          ${node("mdiWeb", "Internet", ev.internet)}
          ${node("mdiRouterNetwork", "Gateway", ev.gateway)}
          ${node("mdiWifi", "Wi-Fi", ev.wifi)}
        </div>
      </section>`;

    // Internet card
    const lat = m.latency;
    const latHist = this._history[Object.values(c.latency)[0]] || [];
    const dlHist = this._history[c.download] || [];
    const metric = (label, icon, value, unit, cls = "") =>
      `<div class="metric ${cls}"><div class="v">${value}${unit ? `<small>${unit}</small>` : ""}</div><div class="l">${svg(icon)}${esc(label)}</div></div>`;
    const internet = `
      <section class="card a-internet">
        <div class="head"><span class="eyebrow">Internet</span><span class="muted">${esc(ev.internet.word)}</span></div>
        <div class="big">
          ${lat.map((l) => metric(`Ping ${l.label}${l.ms !== null && (l.loss ?? 0) > 0 ? ` · ${Math.round(l.loss)}% loss` : ""}`, "mdiTimerOutline", l.ms === null ? "—" : Math.round(l.ms), l.ms === null ? "" : "ms", l.ms === null && l.exists ? "bad" : l.ms > SLOW_MS ? "warn" : "")).join("")}
          ${metric("Download right now", "mdiArrowDown", esc(fmtRate(m.down)), "")}
          ${metric("Upload right now", "mdiArrowUp", esc(fmtRate(m.up)), "")}
        </div>
        <div class="note">Traffic in use at this moment, not your plan's top speed.</div>
        <div class="chart"><div class="cap"><span>Ping ${esc(lat[0]?.label || "")} · last 24 h</span><span>${latHist.length > 1 ? `peak ${Math.round(Math.max(...latHist.map((p) => p[1])))} ms` : ""}</span></div>${sparkline(latHist, "")}</div>
        <div class="chart"><div class="cap"><span>Download · last 24 h</span><span>${dlHist.length > 1 ? `peak ${esc(fmtRate(Math.max(...dlHist.map((p) => p[1]))))}` : ""}</span></div>${sparkline(dlHist, "blue")}</div>
        ${
          m.gateway?.online
            ? `<div class="kv"><span>Gateway <b>${esc(m.gateway.name)}</b></span><span>Up <b>${esc(fmtUptime(m.gateway.uptime))}</b></span><span>CPU <b>${m.gateway.cpu === null ? "—" : `${Math.round(m.gateway.cpu)}%`}</b></span><span>Memory <b>${m.gateway.mem === null ? "—" : `${Math.round(m.gateway.mem)}%`}</b></span></div>`
            : ""
        }
      </section>`;

    // Wi-Fi card
    const perDevice = {};
    for (const cl of m.clients) perDevice[cl.uplinkDeviceId] = (perDevice[cl.uplinkDeviceId] || 0) + (cl.type === "WIRELESS" ? 1 : 0);
    const apOrder = [...m.aps].sort((a, b) => (a.retired - b.retired) || (b.online - a.online) || (perDevice[b.id] || 0) - (perDevice[a.id] || 0));
    const wifi = `
      <section class="card a-wifi">
        <div class="head"><span class="eyebrow">Wi-Fi access points</span><span class="muted">${esc(ev.wifi.word)}</span></div>
        ${m.unifiOk ? "" : `<div class="spark-empty" style="margin-top:14px">Access point status unavailable</div>`}
        <div class="aps">${apOrder
          .map((a) => {
            const tag = a.retired ? `<span class="tag retired">Retired</span>` : !a.online ? `<span class="tag off">Offline</span>` : a.isGateway ? `<span class="tag">Built into gateway</span>` : "";
            const bands = a.online
              ? a.radios.map((r) => `<span class="band ${(r.txRetriesPct ?? 0) > RETRY_WARN_PCT ? "warn" : ""}">${r.frequencyGHz} GHz · ${Math.round(r.txRetriesPct ?? 0)}% retries</span>`).join("")
              : `<span class="muted">${a.lastSeen ? `Last seen ${esc(since(a.lastSeen))} · ` : ""}${esc(a.model || "")}</span>`;
            return `<div class="ap ${a.online ? "" : "offline"} ${a.retired ? "retired" : ""}">
              <div class="ap-name"><span>${esc(a.name)}</span>${tag}</div>
              <div class="ap-clients">${a.online ? perDevice[a.id] || 0 : "—"}<small>on Wi-Fi</small></div>
              <div class="bands">${bands}${a.online && a.uptime ? `<span class="band">up ${esc(fmtUptime(a.uptime))}</span>` : ""}</div><div></div>
            </div>`;
          })
          .join("")}</div>
      </section>`;

    // Clients card
    const wireless = m.clients.filter((x) => x.type === "WIRELESS").length;
    const wired = m.clients.length - wireless;
    const shades = ["#2dd4bf", "#4cc3ff", "#a78bfa", "#f5b041", "#94a3b8", "#f472b6"];
    const byUplink = Object.entries(
      m.clients.reduce((acc, x) => ((acc[x.uplinkDeviceId] = (acc[x.uplinkDeviceId] || 0) + 1), acc), {}),
    ).sort((a, b) => b[1] - a[1]);
    const recent = [...m.clients].sort((a, b) => Date.parse(b.connectedAt) - Date.parse(a.connectedAt));
    const row = (x) => `<div class="row">${svg(x.type === "WIRELESS" ? "mdiWifi" : "mdiEthernet")}<span class="n">${esc(x.name || x.macAddress)}<small>${esc(deviceName[x.uplinkDeviceId] || "")}</small></span><span class="t">${esc(ago(x.connectedAt))}</span></div>`;
    const clientList = this._showAll
      ? byUplink
          .map(([id]) => `<div class="group">${esc(deviceName[id] || "Other")}</div>${recent.filter((x) => x.uplinkDeviceId === id).map(row).join("")}`)
          .join("")
      : `<div class="group">Most recently connected</div>${recent.slice(0, 5).map(row).join("")}`;
    const clientsCard = `
      <section class="card a-clients">
        <div class="head"><span class="eyebrow">Connected devices</span></div>
        ${
          m.clientsOk
            ? `<div class="counts"><span class="total">${m.totalClients ?? m.clients.length}</span><span class="split">${wireless} on Wi-Fi · ${wired} wired</span></div>
        <div class="bar">${byUplink.map(([, n], i) => `<div style="flex:${n};background:${shades[i % shades.length]}"></div>`).join("")}</div>
        <div class="legend">${byUplink.map(([id, n], i) => `<span><i style="background:${shades[i % shades.length]}"></i>${esc(deviceName[id] || "Other")} ${n}</span>`).join("")}</div>
        <div class="list">${clientList}</div>
        <button class="link" data-action="all">${this._showAll ? "Show fewer" : `Show all ${m.clients.length} by access point`}</button>`
            : `<div class="spark-empty" style="margin-top:14px">Device list unavailable</div>`
        }
      </section>`;

    const attn = `
      <section class="card a-attn">
        <div class="head"><span class="eyebrow">Needs attention</span>${ev.items.length ? `<span class="muted">${ev.items.length}</span>` : ""}</div>
        ${
          !m.unifiOk
            ? `<div class="spark-empty" style="margin-top:14px">Can't check devices while UniFi data is unavailable</div>`
            : ev.items.length
            ? `<div class="items">${ev.items.map((i) => `<div class="item ${i.level}">${svg(i.icon)}<div><b>${esc(i.title)}</b><span>${esc(i.text)}</span></div></div>`).join("")}</div>`
            : `<div class="allgood">${svg("mdiCheckCircleOutline")} Nothing needs attention.</div>`
        }
      </section>`;

    const s = ev.status;
    const banner = !m.unifiOk
      ? `<div class="banner">${svg("mdiAlertOutline")}<span>Can't read data from UniFi (the API key may have been revoked, or the UDM is unreachable). Internet checks below still work; gateway and Wi-Fi details are unknown — not necessarily down.</span></div>`
      : "";
    const html = `
      <style>${CSS}</style>
      <div class="app">
        <header class="top">
          ${this._narrow ? `<button class="icon-btn" data-action="menu" aria-label="Menu">${svg("mdiMenu")}</button>` : ""}
          <div class="brand">${svg("mdiRouterWireless")}</div>
          <div class="titles"><h1>Network</h1>
            <div class="status"><span class="dot ${s.dot}"></span><b>${esc(s.label)}</b><span class="muted">·</span><span class="muted detail">${esc(s.detail)}</span></div></div>
        </header>
        ${banner}
        <main class="grid">${path}${internet}${wifi}${clientsCard}${attn}</main>
      </div>`;
    if (html !== this._html) {
      this._html = html;
      this.shadowRoot.innerHTML = html;
    }
  }
}

function loadFont() {
  if (document.querySelector("link[href*='family=Outfit']")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

if (!customElements.get("network-panel")) customElements.define("network-panel", NetworkPanel);
