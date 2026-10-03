// Climbing panel: Mountain Project "What's New" for one area, as a dependency-free panel_custom
// web component. Reads the sensor written nightly by docker-host's mountain-project-feed job;
// the entity id comes from panel_custom `config`.

const ICONS = {
  mdiAlertCircleOutline: "M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z",
  mdiAlertOutline: "M12,2L1,21H23M12,6L19.53,19H4.47M11,10V14H13V10M11,16V18H13V16",
  mdiCarabiner: "M8 17.5C8 18.33 7.33 19 6.5 19S5 18.33 5 17.5 5.67 16 6.5 16 8 16.67 8 17.5M18 5.59C17.79 3.54 16.18 2 14.24 2H8.88C6.95 2 5.36 3.5 5.15 5.53L5 6.59C4.92 7.34 5.5 8 6.24 8C6.87 8 7.39 7.53 7.47 6.91L7.61 5.82C7.68 5.07 8.23 4.5 8.88 4.5H14.24C14.89 4.5 15.44 5.07 15.5 5.82L16.5 16.88C16.59 17.74 16 18.5 15.25 18.5L10.04 17.82C9.95 18.77 9.5 19.6 8.8 20.18L14.93 21L15.09 21H15.25C16.27 21 17.26 20.56 17.96 19.78C18.71 18.94 19.09 17.8 19 16.65L18 5.59M11.66 7.94C11.08 7.57 10.31 7.75 9.94 8.34L6.39 14C6.43 14 6.46 14 6.5 14C7.38 14 8.18 14.34 8.8 14.88L12.06 9.66C12.43 9.08 12.25 8.31 11.66 7.94Z",
  mdiCheckCircleOutline: "M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M12 20C7.59 20 4 16.41 4 12S7.59 4 12 4 20 7.59 20 12 16.41 20 12 20M16.59 7.58L10 14.17L7.41 11.59L6 13L10 17L18 9L16.59 7.58Z",
  mdiCommentTextOutline: "M9,22A1,1 0 0,1 8,21V18H4A2,2 0 0,1 2,16V4C2,2.89 2.9,2 4,2H20A2,2 0 0,1 22,4V16A2,2 0 0,1 20,18H13.9L10.2,21.71C10,21.9 9.75,22 9.5,22V22H9M10,16V19.08L13.08,16H20V4H4V16H10M6,7H18V9H6V7M6,11H15V13H6V11Z",
  mdiImageFilterHdr: "M14,6L10.25,11L13.1,14.8L11.5,16C9.81,13.75 7,10 7,10L1,18H23L14,6Z",
  mdiInformationOutline: "M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z",
  mdiMapMarkerOutline: "M12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5M12,2A7,7 0 0,1 19,9C19,14.25 12,22 12,22C12,22 5,14.25 5,9A7,7 0 0,1 12,2M12,4A5,5 0 0,0 7,9C7,10 7,12 12,18.71C17,12 17,10 17,9A5,5 0 0,0 12,4Z",
  mdiMenu: "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",
  mdiOpenInNew: "M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z",
  mdiStar: "M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z",
  mdiSync: "M12,18A6,6 0 0,1 6,12C6,11 6.25,10.03 6.7,9.2L5.24,7.74C4.46,8.97 4,10.43 4,12A8,8 0 0,0 12,20V23L16,19L12,15M12,4V1L8,5L12,9V6A6,6 0 0,1 18,12C18,13 17.75,13.97 17.3,14.8L18.76,16.26C19.54,15.03 20,13.57 20,12A8,8 0 0,0 12,4Z",
  mdiSyncAlert: "M11,13H13V7H11M21,4H15V10L17.24,7.76C18.32,8.85 19,10.34 19,12C19,14.61 17.33,16.83 15,17.65V19.74C18.45,18.85 21,15.73 21,12C21,9.79 20.09,7.8 18.64,6.36M11,17H13V15H11M3,12C3,14.21 3.91,16.2 5.36,17.64L3,20H9V14L6.76,16.24C5.68,15.15 5,13.66 5,12C5,9.39 6.67,7.17 9,6.35V4.26C5.55,5.15 3,8.27 3,12Z",
};

const TYPES = {
  route: { label: "Routes", one: "Route", icon: "mdiCarabiner", none: "No new routes in the last 30 days." },
  area: { label: "Areas", one: "Area", icon: "mdiMapMarkerOutline", none: "No new areas in the last 30 days." },
  comment: { label: "Comments", one: "Comment", icon: "mdiCommentTextOutline", none: "No new comments in the last 30 days." },
};
const PAGE = 20;
const FILTER_KEY = "climbing-panel.filter";

const svg = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ""}"/></svg>`;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const live = (st) => !!st && !["unavailable", "unknown"].includes(st.state);
const arr = (v) => (Array.isArray(v) ? v : []);
const ms = (iso) => (iso ? Date.parse(iso) || null : null);
const startOfDay = (t) => new Date(t).setHours(0, 0, 0, 0);
// Only http(s) links from the feed are rendered as hrefs.
const safeUrl = (u) => (/^https:\/\/(www\.)?mountainproject\.com\//.test(String(u || "")) ? u : null);

function dayLabel(t) {
  const diff = Math.round((startOfDay(t) - startOfDay(Date.now())) / 864e5);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  return new Date(t).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function agoText(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

function crumbs(b) {
  b = arr(b);
  return b.length > 3 ? [b[0], "…", ...b.slice(-2)] : b;
}

function readFilter() {
  try {
    const v = localStorage.getItem(FILTER_KEY);
    return v in TYPES ? v : "route";
  } catch {
    return "route";
  }
}

function saveFilter(v) {
  try {
    localStorage.setItem(FILTER_KEY, v);
  } catch {}
}

const CSS = `
:host {
  --bg: #080d17; --card: #0f1624; --card-2: #141d2e; --line: rgba(148,170,200,.12);
  --text: #eef3fa; --muted: #8593a8; --rock: #fdba74; --rock-2: #c2410c;
  --green: #22c55e; --amber: #f5b041; --red: #f0616d; --blue: #4cc3ff; --grey: #64748b;
  display: block; height: 100%; overflow-y: auto; container-type: inline-size;
  background: radial-gradient(1200px 600px at 10% -10%, rgba(194,65,12,.14), transparent 60%),
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
  background: linear-gradient(160deg, var(--rock), var(--rock-2)); box-shadow: 0 10px 30px rgba(194,65,12,.35), inset 0 1px 0 rgba(255,255,255,.35); }
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
.icon-btn { width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; background: var(--card-2); border: 1px solid var(--line); flex: none; }

.alerts { display: flex; flex-direction: column; gap: 10px; margin-bottom: 22px; }
.alert { display: flex; gap: 14px; align-items: flex-start; padding: 16px 20px; border-radius: 22px; line-height: 1.4;
  background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line); }
.alert .ic { width: 26px; height: 26px; margin-top: 1px; }
.alert b { display: block; font-size: 17px; font-weight: 600; overflow-wrap: anywhere; }
.alert span { display: block; font-size: 14.5px; color: #c3cedd; overflow-wrap: anywhere; }
.alert small { display: block; font-size: 13px; color: var(--muted); margin-top: 4px; overflow-wrap: anywhere; }
.alert.red { border-color: rgba(240,97,109,.45); background: linear-gradient(180deg, #2a1620, #1a1220); } .alert.red .ic { color: var(--red); }
.alert.amber { border-color: rgba(245,176,65,.35); } .alert.amber .ic { color: var(--amber); }

.grid { display: grid; gap: 22px; align-items: start; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); grid-template-areas: "feed side"; }
.a-feed { grid-area: feed; } .a-side { grid-area: side; }
.card { background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line); border-radius: 30px; padding: 24px 26px; min-width: 0; }
.eyebrow { font-size: 13px; letter-spacing: .12em; font-weight: 600; color: var(--muted); text-transform: uppercase; }
.head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }

.chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
.chip { height: 40px; padding: 0 16px; border-radius: 20px; display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 500;
  background: #121a28; border: 1px solid var(--line); color: #c3cedd; }
.chip .n { color: var(--muted); font-variant-numeric: tabular-nums; }
.chip[aria-pressed="true"] { background: color-mix(in srgb, var(--rock-2) 30%, #121a28); border-color: rgba(253,186,116,.45); color: #fff; }
.chip[aria-pressed="true"] .n { color: var(--rock); }

.day { margin-top: 20px; }
.day-label { font-size: 13px; letter-spacing: .1em; text-transform: uppercase; font-weight: 600; color: var(--muted); margin-bottom: 8px; }
.row { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 14px; align-items: start; padding: 14px; border-radius: 18px; background: #121a28; border: 1px solid var(--line); }
.row + .row { margin-top: 8px; }
.row:hover { border-color: rgba(253,186,116,.35); }
.row:focus-visible { outline: 2px solid var(--rock); outline-offset: 2px; }
.kind { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; background: #1a2436; color: #c3cedd; }
.kind .ic { width: 22px; height: 22px; }
.line1 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.name { font-size: 17px; font-weight: 600; overflow-wrap: anywhere; }
.pre { font-size: 15px; color: var(--muted); }
.name.caption { font-weight: 500; font-style: italic; }
.tag { display: inline-flex; align-items: center; height: 24px; padding: 0 9px; border-radius: 8px; font-size: 13px; font-weight: 600; flex: none;
  background: #1e2a3d; color: #c3cedd; font-variant-numeric: tabular-nums; }
.tag.grade { background: #26303f; color: #eef3fa; }
.tag.new { background: rgba(34,197,94,.16); color: #86efac; }
.stars { font-size: 13.5px; color: var(--muted); white-space: nowrap; }
.stars .ic { width: 14px; height: 14px; vertical-align: -2px; margin-right: 2px; color: #94a3b8; }
.crumbs { font-size: 13.5px; color: var(--muted); margin-top: 4px; overflow-wrap: anywhere; }
.excerpt { font-size: 15px; color: #c3cedd; margin-top: 6px; line-height: 1.4; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; }
.excerpt.one { -webkit-line-clamp: 1; }
.meta { font-size: 13px; color: var(--muted); margin-top: 6px; font-variant-numeric: tabular-nums; }
.link { margin-top: 14px; color: var(--rock); font-weight: 600; font-size: 15px; }
.footer { margin-top: 18px; font-size: 14px; color: var(--muted); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.footer .ic { width: 18px; height: 18px; }
.footer a { color: var(--rock); display: inline-flex; align-items: center; gap: 4px; }
.footer a .ic { width: 16px; height: 16px; }
.empty { margin-top: 16px; padding: 18px; border-radius: 14px; border: 1px dashed var(--line); color: var(--muted); font-size: 15px; text-align: center; }

.stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
.stat { border-radius: 18px; padding: 14px; background: #121a28; border: 1px solid var(--line); min-width: 0; }
.stat b { display: block; font-size: 34px; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
.stat span { font-size: 14px; color: var(--muted); }
.newline { margin-top: 14px; font-size: 16px; color: #c3cedd; }
.newline b { color: #86efac; font-weight: 600; }
.sub-eyebrow { margin-top: 22px; }
.crags { margin-top: 10px; display: flex; flex-direction: column; gap: 10px; }
.crag-top { display: flex; justify-content: space-between; gap: 10px; font-size: 15px; }
.crag-top span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.crag-top span:last-child { color: var(--muted); font-variant-numeric: tabular-nums; }
.bar { height: 6px; border-radius: 3px; background: #1e2740; margin-top: 5px; overflow: hidden; }
.bar div { height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--rock-2), var(--rock)); }

@container (max-width: 980px) {
  .grid { grid-template-columns: minmax(0, 1fr); grid-template-areas: "feed" "side"; }
}
@container (max-width: 640px) {
  .app { padding: 14px 14px 24px; }
  .top { gap: 12px; margin-bottom: 16px; }
  .brand, .icon-btn { width: 44px; height: 44px; border-radius: 14px; }
  .brand .ic { width: 24px; height: 24px; }
  h1 { font-size: 22px; } .status { font-size: 14px; margin-top: 3px; } .dot { width: 10px; height: 10px; }
  .alerts { margin-bottom: 14px; }
  .alert { padding: 12px 14px; border-radius: 18px; gap: 10px; } .alert b { font-size: 15px; } .alert span { font-size: 13.5px; }
  .grid { gap: 14px; }
  .card { border-radius: 24px; padding: 18px 16px; }
  .chips { gap: 6px; } .chip { height: 36px; padding: 0 12px; font-size: 14px; }
  .row { grid-template-columns: 34px minmax(0, 1fr); gap: 10px; padding: 12px; }
  .kind { width: 34px; height: 34px; border-radius: 10px; } .kind .ic { width: 18px; height: 18px; }
  .name { font-size: 15.5px; } .excerpt { font-size: 14px; } .crumbs, .meta { font-size: 12.5px; }
  .stat { padding: 12px 10px; } .stat b { font-size: 26px; } .stat span { font-size: 13px; }
}
`;

class ClimbingPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._filter = readFilter();
    this._showAll = false;
    this.shadowRoot.addEventListener("click", (e) => {
      const el = e.target.closest?.("[data-action]");
      if (!el) return;
      const a = el.dataset.action;
      if (a === "menu") this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
      if (a === "filter") {
        this._filter = el.dataset.type;
        this._showAll = false;
        saveFilter(this._filter);
        this._render();
      }
      if (a === "more") {
        this._showAll = !this._showAll;
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
    return { feed: "sensor.mountain_project_feed", stale_hours: 26, ...(this._cfg || {}) };
  }

  _scheduleRender() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this._render();
    });
  }

  _fmtTime(t) {
    const tf = this._hass?.locale?.time_format;
    const hour12 = tf === "12" ? true : tf === "24" ? false : undefined;
    return new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12 });
  }

  _when(t) {
    return `${dayLabel(t)} ${this._fmtTime(t)}`;
  }

  _model() {
    const st = this._hass.states[this._config.feed];
    const a = st?.attributes || {};
    const items = arr(a.items)
      .filter((i) => i && i.type in TYPES)
      .map((i) => ({ ...i, at: ms(i.published) }))
      .filter((i) => i.at)
      .sort((x, y) => y.at - x.at);
    return {
      ok: live(st) && !!a.schema,
      status: st?.state,
      source: a.source,
      lastAttempt: ms(a.last_attempt),
      lastSuccess: ms(a.last_success),
      error: a.error,
      warnings: arr(a.warnings),
      area: a.area || {},
      items,
      newCount: items.filter((i) => i.new).length,
    };
  }

  _evaluate(m) {
    const now = Date.now();
    const alerts = [];
    const fromWhen = m.lastSuccess ? `Showing the list from ${this._when(m.lastSuccess)}.` : "Nothing has been fetched successfully yet.";
    const stale = m.ok && m.status !== "error" && (!m.lastAttempt || now - m.lastAttempt > this._config.stale_hours * 3600e3);

    if (!m.ok) {
      alerts.push({
        level: "red", icon: "mdiAlertCircleOutline", title: "Can't read the climbing feed",
        text: "Home Assistant has no readable mountain_project_feed.json, so this can't tell whether the nightly update is working.",
        hint: "On docker-host: sudo /docker/mountain-project-feed/scripts/run-feed.sh, then check /docker/mountain-project-feed/cron.log.",
      });
    } else if (m.status === "error") {
      alerts.push({
        level: "red", icon: "mdiSyncAlert",
        title: `Couldn't update from Mountain Project ${m.lastAttempt ? dayLabel(m.lastAttempt).toLowerCase() : ""}`.trim(),
        text: fromWhen, hint: m.error || "",
      });
    } else if (stale) {
      alerts.push({
        level: "amber", icon: "mdiSyncAlert",
        title: m.lastAttempt ? `Nightly update hasn't run since ${this._when(m.lastAttempt)}` : "Nightly update hasn't run",
        text: `It should run every night around 3:30 AM. ${fromWhen}`,
        hint: "Check /etc/cron.d/mountain-project-feed and /docker/mountain-project-feed/cron.log on docker-host.",
      });
    }
    if (m.ok && m.status !== "error") {
      m.warnings.forEach((w, i) =>
        alerts.push({
          level: "amber", icon: "mdiAlertOutline",
          title: m.status === "degraded" && i === 0 ? "Updated from the backup source" : "Partial update",
          text: w, hint: "",
        }),
      );
    }

    let status;
    if (!m.ok) status = { dot: "", label: "No data", detail: "Feed unavailable" };
    else if (m.status === "error") status = { dot: "red", label: "Update failed", detail: m.lastSuccess ? `Last good ${this._when(m.lastSuccess)}` : "No data yet" };
    else if (stale) status = { dot: "amber", label: "Not updating", detail: m.lastAttempt ? `Last checked ${agoText(m.lastAttempt)}` : "Never checked" };
    else if (m.status === "degraded" || m.warnings.length) status = { dot: "amber", label: "Partial update", detail: `Checked ${this._when(m.lastAttempt)}` };
    else
      status = {
        dot: "green", label: "Up to date",
        detail: `Checked ${this._fmtTime(m.lastAttempt)} · ${m.newCount ? `${m.newCount} new since the night before` : "nothing new since the night before"}`,
      };
    return { status, alerts, current: m.ok && m.status !== "error" && !stale };
  }

  _row(i) {
    const t = TYPES[i.type];
    const url = safeUrl(i.url);
    const tags = [
      i.grade ? `<span class="tag grade">${esc(i.grade)}</span>` : "",
      i.route_type ? `<span class="tag">${esc(i.route_type)}</span>` : "",
      i.stars ? `<span class="stars">${svg("mdiStar")}${esc(String(i.stars))}</span>` : "",
      i.new ? `<span class="tag new">New</span>` : "",
    ].join("");
    const path = crumbs(i.breadcrumb);
    const excerpt = i.type !== "route" && i.excerpt ? `<div class="excerpt ${i.type === "area" ? "one" : ""}">${esc(i.type === "comment" ? `“${i.excerpt}”` : i.excerpt)}</div>` : "";
    const who = [t.one, i.author, this._fmtTime(i.at)].filter(Boolean).map(esc).join(" · ");
    const inner = `
      <div class="kind" title="${esc(t.one)}">${svg(t.icon)}</div>
      <div>
        <div class="line1">${i.type === "comment" ? `<span class="pre">${i.subject_type === "photo" ? "on photo" : "on"}</span>` : ""}<span class="name ${i.subject_type === "photo" ? "caption" : ""}">${esc(i.title)}</span>${tags}</div>
        ${path.length ? `<div class="crumbs">${path.map(esc).join(" › ")}</div>` : ""}
        ${excerpt}
        <div class="meta">${who}</div>
      </div>`;
    return url ? `<a class="row" href="${esc(url)}" target="_blank" rel="noopener">${inner}</a>` : `<div class="row">${inner}</div>`;
  }

  _render() {
    if (!this._hass) return;
    const m = this._model();
    const ev = this._evaluate(m);
    const counts = Object.fromEntries(Object.keys(TYPES).map((k) => [k, m.items.filter((i) => i.type === k).length]));
    const areaName = m.area.name || "Fort Collins";
    const areaUrl = safeUrl(m.area.url);

    const alerts = ev.alerts.length
      ? `<section class="alerts" role="status">${ev.alerts
          .map((x) => `<div class="alert ${x.level}">${svg(x.icon)}<div><b>${esc(x.title)}</b><span>${esc(x.text)}</span>${x.hint ? `<small>${esc(x.hint)}</small>` : ""}</div></div>`)
          .join("")}</section>`
      : "";

    // Feed
    const filtered = m.items.filter((i) => i.type === this._filter);
    const shown = this._showAll ? filtered : filtered.slice(0, PAGE);
    const days = [];
    for (const i of shown) {
      const key = startOfDay(i.at);
      let d = days.find((x) => x.key === key);
      if (!d) days.push((d = { key, items: [] }));
      d.items.push(i);
    }
    const chip = (key, label, n) =>
      `<button class="chip" data-action="filter" data-type="${key}" aria-pressed="${this._filter === key}">${esc(label)}<span class="n">${n}</span></button>`;
    const emptyText = m.ok || m.items.length ? TYPES[this._filter].none : "No feed data to show.";
    const sourceText = m.source === "html" ? "via the backup page scrape" : m.source === "rss" ? "via RSS" : "";
    const footerParts = [];
    if (m.ok && m.lastAttempt) footerParts.push(`${svg("mdiSync")}<span>Checked ${esc(this._when(m.lastAttempt))}${sourceText ? ` ${esc(sourceText)}` : ""}</span>`);
    if (areaUrl) footerParts.push(`<a href="${esc(areaUrl)}" target="_blank" rel="noopener">View on Mountain Project${svg("mdiOpenInNew")}</a>`);
    const feed = `<section class="card a-feed">
      <div class="head"><span class="eyebrow">What's new</span><span class="muted">last 30 days</span></div>
      <div class="chips" role="group" aria-label="Filter by type">
        ${Object.entries(TYPES).map(([k, t]) => chip(k, t.label, counts[k])).join("")}
      </div>
      ${
        days.length
          ? days.map((d) => `<div class="day"><div class="day-label">${esc(dayLabel(d.key))}</div>${d.items.map((i) => this._row(i)).join("")}</div>`).join("")
          : `<div class="empty">${esc(emptyText)}</div>`
      }
      ${filtered.length > PAGE ? `<button class="link" data-action="more">${this._showAll ? "Show fewer" : `Show all ${filtered.length}`}</button>` : ""}
      ${footerParts.length ? `<div class="footer">${footerParts.join('<span class="muted">·</span>')}</div>` : ""}
    </section>`;

    // Summary: counts and where the activity is
    const byCrag = {};
    for (const i of m.items) {
      const c = arr(i.breadcrumb)[0];
      if (c) byCrag[c] = (byCrag[c] || 0) + 1;
    }
    const crags = Object.entries(byCrag).sort((x, y) => y[1] - x[1]).slice(0, 5);
    const top = crags.length ? crags[0][1] : 1;
    const side = `<section class="card a-side">
      <div class="head"><span class="eyebrow">Last 30 days</span></div>
      <div class="stats">${Object.entries(TYPES)
        .map(([k, t]) => `<div class="stat"><b>${m.ok ? counts[k] : "–"}</b><span>${esc(t.label.toLowerCase())}</span></div>`)
        .join("")}</div>
      ${ev.current ? `<div class="newline">${m.newCount ? `<b>${m.newCount} new</b> since the night before` : "Nothing new since the night before"}</div>` : ""}
      ${
        crags.length
          ? `<div class="eyebrow sub-eyebrow">Most activity</div><div class="crags">${crags
              .map(([name, n]) => `<div><div class="crag-top"><span>${esc(name)}</span><span>${n}</span></div><div class="bar"><div style="width:${((n / top) * 100).toFixed(1)}%"></div></div></div>`)
              .join("")}</div>`
          : ""
      }
    </section>`;

    const s = ev.status;
    const html = `
      <style>${CSS}</style>
      <div class="app">
        <header class="top">
          ${this._narrow ? `<button class="icon-btn" data-action="menu" aria-label="Menu">${svg("mdiMenu")}</button>` : ""}
          <div class="brand">${svg("mdiImageFilterHdr")}</div>
          <div class="titles"><h1>Climbing · ${esc(areaName)}</h1>
            <div class="status"><span class="dot ${s.dot}"></span><b>${esc(s.label)}</b><span class="muted">·</span><span class="muted detail">${esc(s.detail)}</span></div></div>
        </header>
        ${alerts}
        <main class="grid">${feed}${side}</main>
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

if (!customElements.get("climbing-panel")) customElements.define("climbing-panel", ClimbingPanel);
