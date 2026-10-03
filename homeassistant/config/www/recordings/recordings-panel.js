// Recordings panel: a dependency-free web component registered via panel_custom.
// Reads sensor.plex_recordings_sync_meta (plex_recordings sync via MQTT) and the
// HDHomeRun tuner sensors; ids come from panel_custom `config`.

const ICONS = {
  mdiAlertCircleOutline: "M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z",
  mdiAntenna: "M12 7.5C12.69 7.5 13.27 7.73 13.76 8.2S14.5 9.27 14.5 10C14.5 11.05 14 11.81 13 12.28V21H11V12.28C10 11.81 9.5 11.05 9.5 10C9.5 9.27 9.76 8.67 10.24 8.2S11.31 7.5 12 7.5M16.69 5.3C17.94 6.55 18.61 8.11 18.7 10C18.7 11.8 18.03 13.38 16.69 14.72L15.5 13.5C16.5 12.59 17 11.42 17 10C17 8.67 16.5 7.5 15.5 6.5L16.69 5.3M6.09 4.08C4.5 5.67 3.7 7.64 3.7 10S4.5 14.3 6.09 15.89L4.92 17.11C3 15.08 2 12.7 2 10C2 7.3 3 4.94 4.92 2.91L6.09 4.08M19.08 2.91C21 4.94 22 7.3 22 10C22 12.8 21 15.17 19.08 17.11L17.91 15.89C19.5 14.3 20.3 12.33 20.3 10S19.5 5.67 17.91 4.08L19.08 2.91M7.31 5.3L8.5 6.5C7.5 7.42 7 8.58 7 10C7 11.33 7.5 12.5 8.5 13.5L7.31 14.72C5.97 13.38 5.3 11.8 5.3 10C5.3 8.2 5.97 6.64 7.31 5.3Z",
  mdiCalendarQuestion: "M6,1V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3H18V1H16V3H8V1H6M5,8H19V19H5V8M12.19,9C11.32,9 10.62,9.2 10.08,9.59C9.56,10 9.3,10.57 9.31,11.36L9.32,11.39H11.25C11.26,11.09 11.35,10.86 11.53,10.7C11.71,10.55 11.93,10.47 12.19,10.47C12.5,10.47 12.76,10.57 12.94,10.75C13.12,10.94 13.2,11.2 13.2,11.5C13.2,11.82 13.13,12.09 12.97,12.32C12.83,12.55 12.62,12.75 12.36,12.91C11.85,13.25 11.5,13.55 11.31,13.82C11.11,14.08 11,14.5 11,15H13C13,14.69 13.04,14.44 13.13,14.26C13.22,14.08 13.39,13.9 13.64,13.74C14.09,13.5 14.46,13.21 14.75,12.81C15.04,12.41 15.19,12 15.19,11.5C15.19,10.74 14.92,10.13 14.38,9.68C13.85,9.23 13.12,9 12.19,9M11,16V18H13V16H11Z",
  mdiCalendarRemove: "M19,19H5V8H19M19,3H18V1H16V3H8V1H6V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M9.31,17L11.75,14.56L14.19,17L15.25,15.94L12.81,13.5L15.25,11.06L14.19,10L11.75,12.44L9.31,10L8.25,11.06L10.69,13.5L8.25,15.94L9.31,17Z",
  mdiCheckCircleOutline: "M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M12 20C7.59 20 4 16.41 4 12S7.59 4 12 4 20 7.59 20 12 16.41 20 12 20M16.59 7.58L10 14.17L7.41 11.59L6 13L10 17L18 9L16.59 7.58Z",
  mdiClockOutline: "M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z",
  mdiHarddisk: "M6,2H18A2,2 0 0,1 20,4V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V4A2,2 0 0,1 6,2M12,4A6,6 0 0,0 6,10C6,13.31 8.69,16 12.1,16L11.22,13.77C10.95,13.29 11.11,12.68 11.59,12.4L12.45,11.9C12.93,11.63 13.54,11.79 13.82,12.27L15.74,14.69C17.12,13.59 18,11.9 18,10A6,6 0 0,0 12,4M12,9A1,1 0 0,1 13,10A1,1 0 0,1 12,11A1,1 0 0,1 11,10A1,1 0 0,1 12,9M7,18A1,1 0 0,0 6,19A1,1 0 0,0 7,20A1,1 0 0,0 8,19A1,1 0 0,0 7,18M12.09,13.27L14.58,19.58L17.17,18.08L12.95,12.77L12.09,13.27Z",
  mdiMenu: "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",
  mdiPlay: "M8,5.14V19.14L19,12.14L8,5.14Z",
  mdiSync: "M12,18A6,6 0 0,1 6,12C6,11 6.25,10.03 6.7,9.2L5.24,7.74C4.46,8.97 4,10.43 4,12A8,8 0 0,0 12,20V23L16,19L12,15M12,4V1L8,5L12,9V6A6,6 0 0,1 18,12C18,13 17.75,13.97 17.3,14.8L18.76,16.26C19.54,15.03 20,13.57 20,12A8,8 0 0,0 12,4Z",
  mdiSyncAlert: "M11,13H13V7H11M21,4H15V10L17.24,7.76C18.32,8.85 19,10.34 19,12C19,14.61 17.33,16.83 15,17.65V19.74C18.45,18.85 21,15.73 21,12C21,9.79 20.09,7.8 18.64,6.36M11,17H13V15H11M3,12C3,14.21 3.91,16.2 5.36,17.64L3,20H9V14L6.76,16.24C5.68,15.15 5,13.66 5,12C5,9.39 6.67,7.17 9,6.35V4.26C5.55,5.15 3,8.27 3,12Z",
  mdiTelevisionClassic: "M8.16,3L6.75,4.41L9.34,7H4C2.89,7 2,7.89 2,9V19C2,20.11 2.89,21 4,21H20C21.11,21 22,20.11 22,19V9C22,7.89 21.11,7 20,7H14.66L17.25,4.41L15.84,3L12,6.84L8.16,3M4,9H17V19H4V9M19.5,9A1,1 0 0,1 20.5,10A1,1 0 0,1 19.5,11A1,1 0 0,1 18.5,10A1,1 0 0,1 19.5,9M19.5,12A1,1 0 0,1 20.5,13A1,1 0 0,1 19.5,14A1,1 0 0,1 18.5,13A1,1 0 0,1 19.5,12Z",
  mdiTimerSand: "M6,2H18V8H18V8L14,12L18,16V16H18V22H6V16H6V16L10,12L6,8V8H6V2M16,16.5L12,12.5L8,16.5V20H16V16.5M12,11.5L16,7.5V4H8V7.5L12,11.5M10,6H14V6.75L12,8.75L10,6.75V6Z",
};

const SYNC_STALE_H = 30;
const DISK_WARN = 85;
const DISK_ALERT = 92;
const WEAK_QUALITY = 70;

const svg = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ""}"/></svg>`;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const live = (st) => !!st && !["unavailable", "unknown"].includes(st.state);
const arr = (v) => (Array.isArray(v) ? v : []);
const startOfDay = (ms) => new Date(ms).setHours(0, 0, 0, 0);

// Air date as a plain calendar date. The filename's date is the reliable one; the sync's
// recorded_at is date-only UTC midnight and sometimes a day early.
function recDate(r) {
  const m = /(\d{4})-(\d{2})-(\d{2}) \d{2} \d{2} \d{2}/.exec(r.path || "") || /^(\d{4})-(\d{2})-(\d{2})/.exec(r.recorded_at || "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : null;
}

function dayLabel(ms) {
  const diff = Math.round((startOfDay(ms) - startOfDay(Date.now())) / 864e5);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return new Date(ms).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function until(ms) {
  const m = Math.round((ms - Date.now()) / 60000);
  if (m < 60) return `in ${Math.max(1, m)} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h} h ${m % 60 ? `${m % 60} min` : ""}`.trim();
  const d = Math.floor(h / 24);
  return `in ${plural(d, "day")}${h % 24 ? ` ${h % 24} h` : ""}`;
}

function agoText(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

const CSS = `
:host {
  --bg: #080d17; --card: #0f1624; --card-2: #141d2e; --line: rgba(148,170,200,.12);
  --text: #eef3fa; --muted: #8593a8; --pink: #f472b6; --pink-2: #be185d;
  --green: #22c55e; --amber: #f5b041; --red: #f0616d; --blue: #4cc3ff; --grey: #64748b;
  display: block; height: 100%; overflow-y: auto; container-type: inline-size;
  background: radial-gradient(1200px 600px at 10% -10%, rgba(190,24,93,.14), transparent 60%),
              radial-gradient(900px 500px at 110% 110%, rgba(40,110,190,.10), transparent 60%), var(--bg);
  color: var(--text); font-family: "Outfit", "SF Pro Display", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
* { box-sizing: border-box; }
button { font: inherit; color: inherit; border: 0; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; }
a { color: inherit; text-decoration: none; }
.ic { width: 24px; height: 24px; fill: currentColor; flex: none; }
.muted { color: var(--muted); }
.app { max-width: 1480px; margin: 0 auto; padding: 28px 28px 40px; }

.top { display: flex; align-items: center; gap: 18px; margin-bottom: 26px; }
.brand { width: 76px; height: 76px; border-radius: 22px; display: grid; place-items: center; flex: none; color: #fff;
  background: linear-gradient(160deg, #f9a8d4, var(--pink-2)); box-shadow: 0 10px 30px rgba(190,24,93,.35), inset 0 1px 0 rgba(255,255,255,.35); }
.brand .ic { width: 38px; height: 38px; }
.titles { flex: 1 1 0; min-width: 0; }
h1 { margin: 0; font-size: 34px; font-weight: 700; line-height: 1.1; }
.status { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 18px; white-space: nowrap; overflow: hidden; }
.status b { font-weight: 600; }
.status .detail { overflow: hidden; text-overflow: ellipsis; }
.dot { width: 12px; height: 12px; border-radius: 50%; flex: none; background: var(--grey); }
.dot.green { background: var(--green); box-shadow: 0 0 10px var(--green); }
.dot.amber { background: var(--amber); box-shadow: 0 0 10px var(--amber); }
.dot.red { background: var(--red); box-shadow: 0 0 10px var(--red); }
.dot.blue { background: var(--blue); box-shadow: 0 0 10px var(--blue); animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .35; } }
.icon-btn { width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; background: var(--card-2); border: 1px solid var(--line); flex: none; }

.grid { display: grid; gap: 22px; align-items: start; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  grid-template-areas: "hero ready" "sched ready" "sched tuners" "sched storage" "sched attn"; }
.card { background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line); border-radius: 30px; padding: 24px 26px; min-width: 0; }
.a-hero { grid-area: hero; } .a-sched { grid-area: sched; } .a-ready { grid-area: ready; } .a-tuners { grid-area: tuners; } .a-storage { grid-area: storage; } .a-attn { grid-area: attn; }
.eyebrow { font-size: 13px; letter-spacing: .12em; font-weight: 600; color: var(--muted); text-transform: uppercase; }
.head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }

.tag { display: inline-flex; align-items: center; height: 26px; padding: 0 10px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: color-mix(in srgb, var(--tc, #94a3b8) 18%, transparent); color: color-mix(in srgb, var(--tc, #94a3b8) 75%, white); flex: none; }
.tag.new { --tc: #22c55e; }
.tag.warn { --tc: #f5b041; }

/* Hero */
.hero-title { font-size: 32px; font-weight: 700; line-height: 1.15; margin-top: 10px; letter-spacing: -.01em; }
.hero-meta { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 14px; font-size: 17px; color: #c3cedd; align-items: center; }
.hero-meta .ic { width: 20px; height: 20px; color: var(--muted); margin-right: 6px; vertical-align: -4px; }
.countdown { margin-top: 18px; display: flex; align-items: baseline; gap: 10px; }
.countdown b { font-size: 44px; font-weight: 700; letter-spacing: -.02em; color: #f9a8d4; }
.countdown span { color: var(--muted); font-size: 16px; }
.progress { height: 8px; border-radius: 4px; background: #1e2740; overflow: hidden; margin-top: 16px; }
.progress div { height: 100%; border-radius: 4px; background: linear-gradient(90deg, #1d8fe8, var(--blue)); }

/* Schedule */
.day { margin-top: 18px; }
.day-label { font-size: 13px; letter-spacing: .1em; text-transform: uppercase; font-weight: 600; color: var(--muted); margin-bottom: 8px; }
.ev { display: grid; grid-template-columns: 84px minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 12px 14px; border-radius: 18px; background: #121a28; border: 1px solid var(--line); }
.ev + .ev { margin-top: 8px; }
.ev.now { border-color: rgba(76,195,255,.5); background: #10202f; }
.ev-time { font-size: 17px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ev-time small { display: block; font-size: 12.5px; color: var(--muted); font-weight: 500; }
.ev-title { font-size: 17px; font-weight: 500; overflow-wrap: anywhere; }
.ev-sub { font-size: 13px; color: var(--muted); margin-top: 2px; }
.ev-tags { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.footer { margin-top: 18px; font-size: 14px; color: var(--muted); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.footer .ic { width: 18px; height: 18px; }

/* Ready to watch */
.recs { margin-top: 12px; display: flex; flex-direction: column; }
.rec { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; align-items: center; padding: 12px 0; border-top: 1px solid var(--line); }
.rec:first-child { border-top: 0; }
.rec-title { font-size: 16px; font-weight: 500; overflow-wrap: anywhere; }
.rec-sub { font-size: 13px; color: var(--muted); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.watch { height: 40px; padding: 0 14px; border-radius: 14px; display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: #f9a8d4; background: #241628; border: 1px solid rgba(244,114,182,.3); white-space: nowrap; }
.watch .ic { width: 18px; height: 18px; }
.link { margin-top: 10px; color: var(--pink); font-weight: 600; font-size: 15px; }

/* Tuners */
.tuners { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
.tuner { border-radius: 18px; padding: 14px; background: #121a28; border: 1px solid var(--line); min-width: 0; }
.tuner.busy { border-color: rgba(76,195,255,.4); }
.tuner-name { font-size: 13px; color: var(--muted); }
.tuner-state { font-size: 20px; font-weight: 600; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tuner .meter { margin-top: 10px; font-size: 12.5px; color: var(--muted); }
.meter-bar { height: 6px; border-radius: 3px; background: #1e2740; margin-top: 4px; overflow: hidden; }
.meter-bar div { height: 100%; background: var(--green); }
.meter-bar.weak div { background: var(--amber); }

/* Storage */
.sbar { display: flex; height: 14px; border-radius: 7px; overflow: hidden; margin-top: 16px; background: #172234; gap: 2px; }
.sbar div { height: 100%; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 10px; font-size: 13.5px; color: var(--muted); }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
.big { font-size: 30px; font-weight: 700; margin-top: 10px; }
.big small { font-size: 15px; color: var(--muted); font-weight: 500; margin-left: 6px; }
.big.warn { color: var(--amber); } .big.bad { color: var(--red); }

/* Attention */
.items { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.item { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: 16px; background: #121a28; border: 1px solid var(--line); line-height: 1.4; }
.item .ic { width: 22px; height: 22px; margin-top: 1px; }
.item b { font-weight: 600; display: block; font-size: 16px; overflow-wrap: anywhere; }
.item span { font-size: 14px; color: var(--muted); }
.item.red { border-color: rgba(240,97,109,.4); } .item.red .ic { color: var(--red); }
.item.amber { border-color: rgba(245,176,65,.3); } .item.amber .ic { color: var(--amber); }
.item.info .ic { color: var(--blue); }
.allgood { display: flex; gap: 12px; align-items: center; margin-top: 14px; font-size: 16px; color: #b9f2cc; }
.allgood .ic { color: var(--green); }
.empty { margin-top: 14px; padding: 18px; border-radius: 14px; border: 1px dashed var(--line); color: var(--muted); font-size: 15px; text-align: center; }

@container (max-width: 980px) {
  .grid { grid-template-columns: minmax(0, 1fr); grid-template-areas: "hero" "attn" "sched" "ready" "tuners" "storage"; }
}
@container (max-width: 640px) {
  .app { padding: 14px 14px 24px; }
  .top { gap: 12px; margin-bottom: 16px; }
  .brand, .icon-btn { width: 44px; height: 44px; border-radius: 14px; }
  .brand .ic { width: 24px; height: 24px; }
  h1 { font-size: 22px; } .status { font-size: 14px; margin-top: 3px; } .dot { width: 10px; height: 10px; }
  .grid { gap: 14px; }
  .card { border-radius: 24px; padding: 18px 16px; }
  .hero-title { font-size: 23px; } .hero-meta { font-size: 14.5px; gap: 6px 14px; }
  .countdown b { font-size: 32px; } .countdown span { font-size: 14px; }
  .ev { grid-template-columns: 74px minmax(0, 1fr); padding: 10px 12px; gap: 4px 10px; }
  .ev-tags { grid-column: 2; justify-content: flex-start; }
  .ev-time { font-size: 15px; } .ev-title { font-size: 15px; }
  .rec-title { font-size: 15px; }
  .watch { height: 36px; padding: 0 10px; font-size: 13px; }
  .tuner-state { font-size: 17px; }
  .big { font-size: 24px; }
}
`;

class RecordingsPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._showAllRecent = false;
    this.shadowRoot.addEventListener("click", (e) => {
      const el = e.target.closest?.("[data-action]");
      if (!el) return;
      if (el.dataset.action === "menu") this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
      if (el.dataset.action === "recent") {
        this._showAllRecent = !this._showAllRecent;
        this._render();
      }
    });
  }

  set hass(hass) {
    this._hass = hass;
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
    this._tick = setInterval(() => this._render(), 30000);
    this._scheduleRender();
  }

  disconnectedCallback() {
    clearInterval(this._tick);
  }

  get _config() {
    return { meta: "sensor.plex_recordings_sync_meta", tuners: [], team_colors: {}, avg_recording_gb: 14, ...(this._cfg || {}) };
  }

  _scheduleRender() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this._render();
    });
  }

  _fmtTime(ms) {
    const tf = this._hass?.locale?.time_format;
    const hour12 = tf === "12" ? true : tf === "24" ? false : undefined;
    return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12 });
  }

  _teamTag(team) {
    if (!team) return "";
    const label = team === "Other NFL Games" ? "Other NFL" : team.split(" ").slice(-1)[0];
    const color = this._config.team_colors[team];
    return `<span class="tag" ${color ? `style="--tc:${esc(color)}"` : ""}>${esc(label)}</span>`;
  }

  _model() {
    const c = this._config;
    const metaSt = this._hass.states[c.meta];
    const a = metaSt?.attributes || {};
    const now = Date.now();
    const teamByGuid = {};
    for (const x of [...arr(a.scheduled), ...arr(a.skipped_existing)]) if (x.guid) teamByGuid[x.guid] = { team: x.team, channels: arr(x.channels) };
    const newGuids = new Set(arr(a.scheduled).map((x) => x.guid));
    const queue = arr(a.plex_queue).map((q) => ({
      ...q,
      at: q.air_time ? Date.parse(q.air_time) : null,
      lands: q.lands_after ? Date.parse(q.lands_after) : null,
      team: teamByGuid[q.guid]?.team,
      channels: teamByGuid[q.guid]?.channels || [],
      isNew: newGuids.has(q.guid),
    }));
    const upcoming = queue.filter((q) => q.at && (q.lands ?? q.at) > now).sort((x, y) => x.at - y.at);
    const airing = upcoming.filter((q) => q.at <= now);
    const orphans = queue.filter((q) => !q.at);
    const tuners = c.tuners.map((id, i) => {
      const s = this._hass.states[id];
      const busy = live(s) && s.state !== "idle";
      const num = (suffix) => {
        const v = parseFloat(this._hass.states[`${id}${suffix}`]?.state);
        return Number.isFinite(v) ? v : null;
      };
      return { name: `Tuner ${i + 1}`, ok: live(s), busy, channel: busy ? s.state : null, strength: num("_signal_strength"), quality: num("_signal_quality") };
    });
    const disk = a.disk || {};
    return {
      ok: live(metaSt) && !!a.ran_at,
      ranAt: a.ran_at ? Date.parse(a.ran_at) : null,
      matched: a.matched,
      errors: arr(a.errors),
      health: a.health || {},
      healthy: a.library_healthy !== false && a.library_healthy !== "false",
      awaiting: Number(a.awaiting_index_count) || 0,
      recent: arr(a.recent_recordings),
      newCount: newGuids.size,
      queue,
      upcoming,
      airing,
      orphans,
      tuners,
      disk,
    };
  }

  _evaluate(m) {
    const now = Date.now();
    const usedPct = Number(m.disk.filesystem_used_percent);
    const freeGb = Number(m.disk.filesystem_avail_gb);
    const fits = Number.isFinite(freeGb) ? Math.floor(freeGb / this._config.avg_recording_gb) : null;
    const stale = m.ranAt && now - m.ranAt > SYNC_STALE_H * 3600e3;
    const busyTuners = m.tuners.filter((t) => t.busy);
    const next = m.upcoming.find((q) => q.at > now);
    const items = [];

    for (const e of m.errors)
      items.push({ level: "red", icon: "mdiCalendarRemove", title: `Couldn't schedule ${e.title || "a recording"}`, text: `${e.team ? `${e.team}: ` : ""}${e.error || "Plex API error"}` });
    if (!m.healthy)
      for (const i of arr(m.health.issues).length ? arr(m.health.issues) : ["Plex reports the Recordings library is unhealthy"])
        items.push({ level: "red", icon: "mdiAlertCircleOutline", title: "Recordings library problem", text: typeof i === "string" ? i : JSON.stringify(i) });
    if (m.awaiting)
      items.push({ level: "amber", icon: "mdiTimerSand", title: `${plural(m.awaiting, "recording")} waiting for Plex`, text: "On disk but not indexed into the library yet, so it won't show up in Plex until it is." });
    if (Number.isFinite(usedPct) && usedPct >= DISK_WARN)
      items.push({ level: usedPct >= DISK_ALERT ? "red" : "amber", icon: "mdiHarddisk", title: `Disk ${Math.round(usedPct)}% full`, text: `${Math.round(freeGb)} GB free — room for about ${plural(fits, "more game")}. Retention removes old games as new ones land.` });
    if (stale)
      items.push({ level: "amber", icon: "mdiSyncAlert", title: `Sync hasn't run since ${dayLabel(m.ranAt)} ${this._fmtTime(m.ranAt)}`, text: "New games won't be scheduled until it does. Check the plex_recordings cron on media-laptop." });
    for (const o of m.orphans)
      items.push({ level: "info", icon: "mdiCalendarQuestion", title: `${o.show || o.title}: nothing scheduled`, text: "This DVR subscription has no upcoming airings. If you're done with it, remove it from Plex DVR." });
    for (const t of busyTuners.filter((x) => x.quality !== null && x.quality < WEAK_QUALITY))
      items.push({ level: "info", icon: "mdiAntenna", title: `Weak signal on ${t.channel}`, text: `${t.name} quality ${Math.round(t.quality)}% — playback may stutter.` });

    let status;
    if (!m.ok) status = { dot: "", label: "No data", detail: "Recording sync data unavailable" };
    else if (m.errors.length) status = { dot: "red", label: `Couldn't schedule ${m.errors.length}`, detail: m.errors[0].title || "" };
    else if (!m.healthy) status = { dot: "red", label: "Library problem", detail: "Plex can't index recordings" };
    else if (m.airing.length) status = { dot: "blue", label: "Recording now", detail: m.airing.map((q) => q.title).join(" · ") };
    else if (Number.isFinite(usedPct) && usedPct >= DISK_ALERT) status = { dot: "amber", label: "Disk almost full", detail: `${Math.round(freeGb)} GB free` };
    else if (stale) status = { dot: "amber", label: "Sync stalled", detail: `Last ran ${agoText(m.ranAt)}` };
    else if (m.awaiting) status = { dot: "amber", label: "Waiting for Plex", detail: `${plural(m.awaiting, "recording")} not indexed yet` };
    else if (next) status = { dot: "green", label: "Ready", detail: `Next: ${next.title} · ${dayLabel(next.at)} ${this._fmtTime(next.at)}` };
    else status = { dot: "green", label: "Ready", detail: "Nothing scheduled" };
    return { status, items, fits, freeGb, usedPct, busyTuners, next };
  }

  _render() {
    if (!this._hass) return;
    const c = this._config;
    const m = this._model();
    const ev = this._evaluate(m);
    const now = Date.now();

    // Hero: what's recording now, or what's next
    let hero;
    if (m.airing.length) {
      const q = m.airing[0];
      const pct = q.lands ? Math.min(100, ((now - q.at) / (q.lands - q.at)) * 100) : 0;
      hero = `<section class="card a-hero">
        <div class="head"><span class="eyebrow">Recording now</span>${this._teamTag(q.team)}</div>
        <div class="hero-title">${esc(q.title)}</div>
        <div class="hero-meta">
          <span>${svg("mdiClockOutline")}Started ${this._fmtTime(q.at)}</span>
          ${q.lands ? `<span>${svg("mdiCheckCircleOutline")}Ready to watch about ${this._fmtTime(q.lands)}</span>` : ""}
          ${ev.busyTuners.length ? `<span>${svg("mdiAntenna")}${esc(ev.busyTuners.map((t) => t.channel).join(" · "))}</span>` : ""}
        </div>
        <div class="progress"><div style="width:${pct.toFixed(1)}%"></div></div>
        ${m.airing.length > 1 ? `<div class="footer">Also recording: ${esc(m.airing.slice(1).map((x) => x.title).join(", "))}</div>` : ""}
      </section>`;
    } else if (ev.next) {
      const q = ev.next;
      const sameSlot = m.upcoming.filter((x) => x !== q && x.at === q.at);
      hero = `<section class="card a-hero">
        <div class="head"><span class="eyebrow">Up next</span><span style="display:flex;gap:6px">${q.isNew ? `<span class="tag new">New</span>` : ""}${this._teamTag(q.team)}</span></div>
        <div class="hero-title">${esc(q.title)}</div>
        <div class="countdown"><b>${esc(until(q.at))}</b><span>${esc(dayLabel(q.at))} · ${this._fmtTime(q.at)}</span></div>
        <div class="hero-meta">
          ${q.lands ? `<span>${svg("mdiCheckCircleOutline")}Ready to watch about ${esc(dayLabel(q.lands))} ${this._fmtTime(q.lands)}</span>` : ""}
          ${q.channels.length ? `<span>${svg("mdiAntenna")}${esc(q.channels[0])}${q.channels.length > 1 ? ` +${q.channels.length - 1}` : ""}</span>` : ""}
        </div>
        ${sameSlot.length ? `<div class="footer">Same time: ${esc(sameSlot.map((x) => x.title).join(", "))}</div>` : ""}
      </section>`;
    } else {
      hero = `<section class="card a-hero"><div class="eyebrow">Up next</div><div class="empty">Nothing scheduled to record.</div></section>`;
    }

    // Schedule grouped by day
    const days = [];
    for (const q of m.upcoming) {
      const key = startOfDay(q.at);
      let d = days.find((x) => x.key === key);
      if (!d) days.push((d = { key, items: [] }));
      d.items.push(q);
    }
    const shows = new Set(m.upcoming.map((q) => q.show));
    const sched = `<section class="card a-sched">
      <div class="head"><span class="eyebrow">Recording schedule</span><span class="muted">${plural(m.upcoming.length, "game")}</span></div>
      ${
        days.length
          ? days
              .map(
                (d) => `<div class="day"><div class="day-label">${esc(dayLabel(d.key))}</div>${d.items
                  .map(
                    (q) => `<div class="ev ${q.at <= now ? "now" : ""}">
                  <div class="ev-time">${this._fmtTime(q.at)}<small>${q.at <= now ? "recording" : esc(until(q.at).replace("in ", ""))}</small></div>
                  <div><div class="ev-title">${esc(q.title)}</div>${q.show && q.show !== q.title && shows.size > 1 ? `<div class="ev-sub">${esc(q.show)}</div>` : ""}</div>
                  <div class="ev-tags">${q.isNew ? `<span class="tag new">New</span>` : ""}${this._teamTag(q.team)}</div>
                </div>`,
                  )
                  .join("")}</div>`,
              )
              .join("")
          : `<div class="empty">Nothing scheduled.</div>`
      }
      ${
        m.ok
          ? `<div class="footer">${svg("mdiSync")}Synced ${esc(agoText(m.ranAt))} · ${m.matched ?? "?"} matched${m.newCount ? ` · ${m.newCount} new` : ""} · ${plural(m.errors.length, "error")}</div>`
          : ""
      }
    </section>`;

    // Ready to watch
    const recent = m.recent.map((r, i) => ({ ...r, day: recDate(r), i })).sort((x, y) => (y.day ?? 0) - (x.day ?? 0) || x.i - y.i);
    const shown = this._showAllRecent ? recent : recent.slice(0, 5);
    const watchUrl = (r) =>
      c.plex_server && r.rating_key
        ? `https://app.plex.tv/desktop/#!/server/${encodeURIComponent(c.plex_server)}/details?key=${encodeURIComponent(`/library/metadata/${r.rating_key}`)}`
        : null;
    const ready = `<section class="card a-ready">
      <div class="head"><span class="eyebrow">Ready to watch</span><span class="muted">${m.recent.length ? `latest ${m.recent.length}` : ""}</span></div>
      ${
        recent.length
          ? `<div class="recs">${shown
              .map((r) => {
                const url = watchUrl(r);
                const d = r.day ? new Date(r.day) : null;
                return `<div class="rec">
                  <div><div class="rec-title">${esc(r.title)}</div>
                    <div class="rec-sub">${d ? esc(d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })) : ""}${r.in_plex === false ? `<span class="tag warn">Waiting for Plex</span>` : ""}</div></div>
                  ${url && r.in_plex !== false ? `<a class="watch" href="${esc(url)}" target="_blank" rel="noopener">${svg("mdiPlay")}Watch</a>` : "<span></span>"}
                </div>`;
              })
              .join("")}</div>
            ${recent.length > 5 ? `<button class="link" data-action="recent">${this._showAllRecent ? "Show fewer" : `Show all ${recent.length}`}</button>` : ""}`
          : `<div class="empty">No recordings yet.</div>`
      }
    </section>`;

    // Tuners
    const tuners = m.tuners.length
      ? `<section class="card a-tuners">
      <div class="head"><span class="eyebrow">Antenna tuners</span><span class="muted">${ev.busyTuners.length} of ${m.tuners.length} in use</span></div>
      <div class="tuners">${m.tuners
        .map(
          (t) => `<div class="tuner ${t.busy ? "busy" : ""}">
          <div class="tuner-name">${esc(t.name)}</div>
          <div class="tuner-state">${!t.ok ? "Unavailable" : t.busy ? esc(t.channel) : "Idle"}</div>
          ${
            t.busy && t.quality !== null
              ? `<div class="meter">Signal ${Math.round(t.strength ?? 0)}% · quality ${Math.round(t.quality)}%<div class="meter-bar ${t.quality < WEAK_QUALITY ? "weak" : ""}"><div style="width:${t.quality}%"></div></div></div>`
              : ""
          }
        </div>`,
        )
        .join("")}</div>
    </section>`
      : "";

    // Storage
    const total = Number(m.disk.filesystem_total_bytes);
    const used = Number(m.disk.filesystem_used_bytes);
    const recs = Number(m.disk.recordings_bytes);
    const free = Number(m.disk.filesystem_avail_bytes);
    const gb = (b) => `${Math.round(b / 1e9)} GB`;
    const storage =
      Number.isFinite(total) && total > 0
        ? `<section class="card a-storage">
      <div class="head"><span class="eyebrow">Storage</span><span class="muted">${Math.round(ev.usedPct)}% used</span></div>
      <div class="big ${ev.usedPct >= DISK_ALERT ? "bad" : ev.usedPct >= DISK_WARN ? "warn" : ""}">${esc(gb(free))}<small>free · room for about ${plural(ev.fits, "more game")}</small></div>
      <div class="sbar"><div style="flex:${recs};background:var(--pink)"></div><div style="flex:${Math.max(0, used - recs)};background:#475569"></div><div style="flex:${free};background:#1e2a3d"></div></div>
      <div class="legend"><span><i style="background:var(--pink)"></i>Recordings ${esc(gb(recs))}</span><span><i style="background:#475569"></i>Other files ${esc(gb(Math.max(0, used - recs)))}</span><span><i style="background:#1e2a3d;border:1px solid var(--line)"></i>Free ${esc(gb(free))}</span></div>
      <div class="footer">Estimate assumes ~${c.avg_recording_gb} GB per game.</div>
    </section>`
        : "";

    const attn = `<section class="card a-attn">
      <div class="head"><span class="eyebrow">Needs attention</span>${ev.items.length ? `<span class="muted">${ev.items.length}</span>` : ""}</div>
      ${
        !m.ok
          ? `<div class="empty">Can't check while sync data is unavailable.</div>`
          : ev.items.length
            ? `<div class="items">${ev.items.map((i) => `<div class="item ${i.level}">${svg(i.icon)}<div><b>${esc(i.title)}</b><span>${esc(i.text)}</span></div></div>`).join("")}</div>`
            : `<div class="allgood">${svg("mdiCheckCircleOutline")} Nothing needs attention.</div>`
      }
    </section>`;

    const s = ev.status;
    const html = `
      <style>${CSS}</style>
      <div class="app">
        <header class="top">
          ${this._narrow ? `<button class="icon-btn" data-action="menu" aria-label="Menu">${svg("mdiMenu")}</button>` : ""}
          <div class="brand">${svg("mdiTelevisionClassic")}</div>
          <div class="titles"><h1>Recordings</h1>
            <div class="status"><span class="dot ${s.dot}"></span><b>${esc(s.label)}</b><span class="muted">·</span><span class="muted detail">${esc(s.detail)}</span></div></div>
        </header>
        <main class="grid">${hero}${sched}${ready}${tuners}${storage}${attn}</main>
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

if (!customElements.get("recordings-panel")) customElements.define("recordings-panel", RecordingsPanel);
