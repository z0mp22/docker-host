// Online panel: which sites each person in the house uses, today and over the last 7 days, as a
// dependency-free panel_custom web component. Reads sensor.online_activity, the retained summary
// docker-host's sitewatch.py builds from Pi-hole's DNS log every 15 minutes. Read-only: no actions.

const ICONS = {
  mdiAlertCircleOutline: "M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z",
  mdiInformationOutline: "M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z",
  mdiMenu: "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",
  mdiSyncAlert: "M11,13H13V7H11M21,4H15V10L17.24,7.76C18.32,8.85 19,10.34 19,12C19,14.61 17.33,16.83 15,17.65V19.74C18.45,18.85 21,15.73 21,12C21,9.79 20.09,7.8 18.64,6.36M11,17H13V15H11M3,12C3,14.21 3.91,16.2 5.36,17.64L3,20H9V14L6.76,16.24C5.68,15.15 5,13.66 5,12C5,9.39 6.67,7.17 9,6.35V4.26C5.55,5.15 3,8.27 3,12Z",
  mdiWeb: "M16.36,14C16.44,13.34 16.5,12.68 16.5,12C16.5,11.32 16.44,10.66 16.36,10H19.74C19.9,10.64 20,11.31 20,12C20,12.69 19.9,13.36 19.74,14M14.59,19.56C15.19,18.45 15.65,17.25 15.97,16H18.92C17.96,17.65 16.43,18.93 14.59,19.56M14.34,14H9.66C9.56,13.34 9.5,12.68 9.5,12C9.5,11.32 9.56,10.65 9.66,10H14.34C14.43,10.65 14.5,11.32 14.5,12C14.5,12.68 14.43,13.34 14.34,14M12,19.96C11.17,18.76 10.5,17.43 10.09,16H13.91C13.5,17.43 12.83,18.76 12,19.96M8,8H5.08C6.03,6.34 7.57,5.06 9.4,4.44C8.8,5.55 8.35,6.75 8,8M5.08,16H8C8.35,17.25 8.8,18.45 9.4,19.56C7.57,18.93 6.03,17.65 5.08,16M4.26,14C4.1,13.36 4,12.69 4,12C4,11.31 4.1,10.64 4.26,10H7.64C7.56,10.66 7.5,11.32 7.5,12C7.5,12.68 7.56,13.34 7.64,14M12,4.03C12.83,5.23 13.5,6.57 13.91,8H10.09C10.5,6.57 11.17,5.23 12,4.03M18.92,8H15.97C15.65,6.75 15.19,5.55 14.59,4.44C16.43,5.07 17.96,6.34 18.92,8M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z",
};

const RANGES = { today: "Today", week: "Last 7 days" };
const SHOW_SITES = 5;
const RANGE_KEY = "online-panel.range";

const svg = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ""}"/></svg>`;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const live = (st) => !!st && !["unavailable", "unknown"].includes(st.state);
const arr = (v) => (Array.isArray(v) ? v : []);
const num = (v) => (Number.isFinite(+v) ? +v : 0);
// "2026-11-04" or "2026-11-04T16:25" in the house's local time -> epoch ms (the browser is in the same zone).
const localMs = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(s || ""));
  return m ? new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)).getTime() : null;
};
const startOfDay = (t) => new Date(t).setHours(0, 0, 0, 0);
// A site from sites.json has a proper name; anything else is shown as its domain.
const isDomain = (site) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(site);

function dur(min) {
  min = Math.round(num(min) / 5) * 5;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function shortDur(min) {
  min = num(min);
  return min < 60 ? `${min}m` : `${(min / 60).toFixed(min < 600 ? 1 : 0).replace(/\.0$/, "")}h`;
}

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

function readRange() {
  try {
    const v = localStorage.getItem(RANGE_KEY);
    return v in RANGES ? v : "today";
  } catch {
    return "today";
  }
}

function saveRange(v) {
  try {
    localStorage.setItem(RANGE_KEY, v);
  } catch {}
}

const CSS = `
:host {
  --bg: #080d17; --card: #0f1624; --card-2: #141d2e; --line: rgba(148,170,200,.12);
  --text: #eef3fa; --muted: #8593a8; --use: #a78bfa; --use-2: #6d28d9;
  --green: #22c55e; --amber: #f5b041; --red: #f0616d; --grey: #64748b;
  display: block; height: 100%; overflow-y: auto; container-type: inline-size;
  background: radial-gradient(1200px 600px at 10% -10%, rgba(109,40,217,.16), transparent 60%),
              radial-gradient(900px 500px at 110% 110%, rgba(40,110,190,.10), transparent 60%), var(--bg);
  color: var(--text); font-family: "Outfit", "SF Pro Display", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
* { box-sizing: border-box; }
button { font: inherit; color: inherit; border: 0; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.ic { width: 24px; height: 24px; fill: currentColor; flex: none; }
.muted { color: var(--muted); }
.app { max-width: 1480px; margin: 0 auto; padding: 28px 28px 40px; }

.top { display: flex; align-items: center; gap: 18px; margin-bottom: 22px; }
.brand { width: 76px; height: 76px; border-radius: 22px; display: grid; place-items: center; flex: none; color: #fff;
  background: linear-gradient(160deg, var(--use), var(--use-2)); box-shadow: 0 10px 30px rgba(109,40,217,.35), inset 0 1px 0 rgba(255,255,255,.35); }
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

.alerts { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
.alert { display: flex; gap: 14px; align-items: flex-start; padding: 16px 20px; border-radius: 22px; line-height: 1.4;
  background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line); }
.alert .ic { width: 26px; height: 26px; margin-top: 1px; }
.alert b { display: block; font-size: 17px; font-weight: 600; }
.alert span { display: block; font-size: 14.5px; color: #c3cedd; }
.alert small { display: block; font-size: 13px; color: var(--muted); margin-top: 4px; overflow-wrap: anywhere; }
.alert.red { border-color: rgba(240,97,109,.45); background: linear-gradient(180deg, #2a1620, #1a1220); } .alert.red .ic { color: var(--red); }
.alert.amber { border-color: rgba(245,176,65,.35); } .alert.amber .ic { color: var(--amber); }

.bar-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
.seg { display: inline-flex; padding: 4px; border-radius: 22px; background: #0d1422; border: 1px solid var(--line); }
.seg button { height: 40px; padding: 0 18px; border-radius: 18px; font-size: 15px; font-weight: 500; color: #c3cedd; }
.seg button[aria-pressed="true"] { background: color-mix(in srgb, var(--use-2) 45%, #121a28); color: #fff; }
.est { font-size: 14px; color: var(--muted); }

.grid { display: grid; gap: 22px; align-items: start; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.card { background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line); border-radius: 30px; padding: 24px 26px; min-width: 0; }
.eyebrow { font-size: 13px; letter-spacing: .12em; font-weight: 600; color: var(--muted); text-transform: uppercase; }

.who { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.who h2 { margin: 0; font-size: 24px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pill { display: inline-flex; align-items: center; gap: 7px; height: 28px; padding: 0 11px; border-radius: 14px; font-size: 13.5px; font-weight: 500;
  background: #121a28; border: 1px solid var(--line); color: var(--muted); white-space: nowrap; flex: none; }
.pill.on { color: #86efac; border-color: rgba(34,197,94,.35); background: rgba(34,197,94,.10); }
.pill .dot { width: 8px; height: 8px; }
.devices { font-size: 13.5px; color: var(--muted); margin-top: 4px; overflow-wrap: anywhere; }
.total { margin-top: 16px; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.total b { font-size: 40px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.total span { font-size: 15px; color: var(--muted); }

.chart { margin-top: 16px; }
.cols { display: grid; gap: 3px; align-items: end; height: 56px; }
.cols.h24 { grid-template-columns: repeat(24, minmax(0, 1fr)); }
.cols.d7 { grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; height: 64px; }
.col { background: #1e2740; border-radius: 3px; min-height: 3px; position: relative; }
.col.v { background: linear-gradient(0deg, var(--use-2), var(--use)); }
.col.future { background: #141b2b; }
.col.now { outline: 1px solid rgba(167,139,250,.6); outline-offset: 1px; }
.axis { display: grid; margin-top: 6px; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.axis.h24 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.axis.d7 { grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; text-align: center; }
.axis.d7 .today { color: var(--text); font-weight: 600; }
.d7v { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; text-align: center; font-size: 12px; color: #c3cedd; margin-bottom: 4px; font-variant-numeric: tabular-nums; }

.sites { margin-top: 18px; display: flex; flex-direction: column; gap: 10px; }
.site-top { display: flex; justify-content: space-between; gap: 10px; font-size: 16px; }
.site-top span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.site-top .dom { color: #c3cedd; font-size: 15px; }
.site-top span:last-child { color: var(--muted); font-variant-numeric: tabular-nums; flex: none; }
.bar { height: 6px; border-radius: 3px; background: #1e2740; margin-top: 5px; overflow: hidden; }
.bar div { height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--use-2), var(--use)); }
.link { margin-top: 12px; color: var(--use); font-weight: 600; font-size: 15px; }
.empty { margin-top: 16px; padding: 16px; border-radius: 14px; border: 1px dashed var(--line); color: var(--muted); font-size: 15px; text-align: center; }
.new { margin-top: 16px; font-size: 14.5px; color: #c3cedd; line-height: 1.5; }
.new b { font-weight: 600; color: var(--text); }

.section { margin-top: 28px; }
.section > .eyebrow { display: block; margin-bottom: 12px; }
.mini-grid { display: grid; gap: 14px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.mini { background: #0f1624; border: 1px solid var(--line); border-radius: 22px; padding: 16px 18px; min-width: 0; }
.mini h3 { margin: 0; font-size: 17px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mini .meta { font-size: 13.5px; color: var(--muted); margin-top: 3px; }
.mini .tops { font-size: 14.5px; color: #c3cedd; margin-top: 8px; overflow-wrap: anywhere; }
.hint { font-size: 13.5px; color: var(--muted); margin-top: 10px; }
.hint code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; color: #c3cedd; }

.how { margin-top: 28px; }
.how summary { cursor: pointer; display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: 15px; list-style: none; }
.how summary::-webkit-details-marker { display: none; }
.how summary .ic { width: 20px; height: 20px; }
.how ul { margin: 12px 0 0; padding-left: 22px; color: #c3cedd; font-size: 14.5px; line-height: 1.55; max-width: 860px; }

@container (max-width: 980px) {
  .grid { grid-template-columns: minmax(0, 1fr); }
  .mini-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container (max-width: 640px) {
  .app { padding: 14px 14px 24px; }
  .top { gap: 12px; margin-bottom: 16px; }
  .brand, .icon-btn { width: 44px; height: 44px; border-radius: 14px; }
  .brand .ic { width: 24px; height: 24px; }
  h1 { font-size: 22px; } .status { font-size: 14px; margin-top: 3px; } .dot { width: 10px; height: 10px; }
  .alert { padding: 12px 14px; border-radius: 18px; gap: 10px; } .alert b { font-size: 15px; } .alert span { font-size: 13.5px; }
  .bar-row { margin-bottom: 14px; } .seg button { height: 36px; padding: 0 14px; font-size: 14px; } .est { font-size: 12.5px; }
  .grid { gap: 14px; }
  .card { border-radius: 24px; padding: 18px 16px; }
  .who h2 { font-size: 19px; } .pill { height: 26px; font-size: 12.5px; padding: 0 9px; }
  .total b { font-size: 30px; } .total span { font-size: 13.5px; }
  .cols { height: 44px; gap: 2px; } .cols.d7 { height: 52px; gap: 6px; }
  .site-top { font-size: 15px; } .site-top .dom { font-size: 14px; }
  .mini-grid { grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .mini { border-radius: 18px; padding: 14px; }
  .how ul { font-size: 13.5px; }
}
`;

class OnlinePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._range = readRange();
    this._expanded = new Set();
    this._howOpen = false;
    // <details> state would reset whenever the summary updates and the HTML is replaced.
    this.shadowRoot.addEventListener("toggle", (e) => {
      if (e.target.classList?.contains("how")) this._howOpen = e.target.open;
    }, true);
    this.shadowRoot.addEventListener("click", (e) => {
      const el = e.target.closest?.("[data-action]");
      if (!el) return;
      const a = el.dataset.action;
      if (a === "menu") this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
      if (a === "range") {
        this._range = el.dataset.range;
        saveRange(this._range);
        this._render();
      }
      if (a === "more") {
        const k = el.dataset.who;
        this._expanded.has(k) ? this._expanded.delete(k) : this._expanded.add(k);
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
    return { summary: "sensor.online_activity", stale_minutes: 45, ...(this._cfg || {}) };
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

  _model() {
    const st = this._hass.states[this._config.summary];
    const a = st?.attributes || {};
    const people = arr(a.people).filter((p) => p && p.name);
    return {
      ok: live(st) && people.length > 0,
      updated: Date.parse(a.updated) || null,
      today: a.today,
      // After a long outage the summary's "today" is an earlier day; say which.
      todayLabel: !a.today || startOfDay(localMs(a.today)) === startOfDay(Date.now()) ? "today" : `on ${dayLabel(localMs(a.today))}`,
      days: arr(a.days),
      bucketMin: num(a.bucket_min) || 5,
      minHosts: num(a.min_hosts) || 3,
      newReady: !!a.new_ready,
      historyFrom: a.history_from,
      people,
      unassigned: arr(a.unassigned).filter((p) => p && p.name),
    };
  }

  _evaluate(m) {
    const alerts = [];
    const stale = m.ok && (!m.updated || Date.now() - m.updated > this._config.stale_minutes * 60e3);
    if (!m.ok) {
      alerts.push({
        level: "red", icon: "mdiAlertCircleOutline", title: "Can't read the site summary",
        text: "Home Assistant has no summary from sitewatch, so there's nothing to show yet.",
        hint: "On docker-host: sudo python3 /usr/local/bin/sitewatch.py, then check /var/log/sitewatch.log.",
      });
    } else if (stale) {
      alerts.push({
        level: "amber", icon: "mdiSyncAlert",
        title: `Not updated since ${dayLabel(m.updated).toLowerCase()} ${this._fmtTime(m.updated)}`,
        text: "It should update every 15 minutes, so the numbers below are out of date.",
        hint: "Check /etc/cron.d/sitewatch and /var/log/sitewatch.log on docker-host.",
      });
    }
    const onlineNow = m.people.filter((p) => p.active_now).length;
    let status;
    if (!m.ok) status = { dot: "", label: "No data", detail: "Summary unavailable" };
    else if (stale) status = { dot: "amber", label: "Not updating", detail: `Last update ${agoText(m.updated)}` };
    else
      status = {
        dot: "green", label: "Up to date",
        detail: `Updated ${this._fmtTime(m.updated)} · ${onlineNow ? `${onlineNow} online now` : "nobody online right now"}`,
      };
    return { status, alerts, stale };
  }

  _lastSeen(p, stale) {
    if (p.active_now && !stale) return `<span class="pill on"><span class="dot green"></span>Online now</span>`;
    const t = localMs(p.last_active);
    if (!t) return `<span class="pill">Not seen this week</span>`;
    const day = dayLabel(t);
    const when = day === "Today" ? "" : day === "Yesterday" ? "yesterday " : `${day} `;
    return `<span class="pill">Last online ${esc(when + this._fmtTime(t))}</span>`;
  }

  _hours(p) {
    const now = new Date();
    const curH = now.getHours();
    const hours = arr(p.hours).map(num);
    const cols = Array.from({ length: 24 }, (_, h) => {
      const v = hours[h] || 0;
      const cls = h > curH ? "future" : v ? "v" : "";
      const pct = h > curH ? 4 : Math.max(5, (v / 60) * 100);
      return `<div class="col ${cls} ${h === curH ? "now" : ""}" style="height:${pct.toFixed(0)}%" title="${h}:00 · ${dur(v)}"></div>`;
    }).join("");
    const lab = (h) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: "numeric", hour12: this._hass?.locale?.time_format !== "24" });
    return `<div class="chart" aria-label="Online time by hour today"><div class="cols h24">${cols}</div>
      <div class="axis h24">${[0, 6, 12, 18].map((h) => `<span>${esc(lab(h))}</span>`).join("")}</div></div>`;
  }

  _week(p, m) {
    const daily = arr(p.daily).map(num);
    const top = Math.max(60, ...daily);
    const days = m.days.length === daily.length ? m.days : daily.map(() => null);
    const lab = (d, i) => {
      const t = localMs(d);
      if (!t) return "";
      return i === daily.length - 1 ? "Today" : new Date(t).toLocaleDateString([], { weekday: "short" });
    };
    return `<div class="chart" aria-label="Online time per day, last 7 days">
      <div class="d7v">${daily.map((v) => `<span>${v ? shortDur(v) : ""}</span>`).join("")}</div>
      <div class="cols d7">${daily.map((v) => `<div class="col ${v ? "v" : ""}" style="height:${Math.max(5, (v / top) * 100).toFixed(0)}%" title="${dur(v)}"></div>`).join("")}</div>
      <div class="axis d7">${days.map((d, i) => `<span class="${i === daily.length - 1 ? "today" : ""}">${esc(lab(d, i))}</span>`).join("")}</div></div>`;
  }

  _sites(list, key) {
    const rows = arr(list).filter((x) => Array.isArray(x) && x[0]);
    if (!rows.length) return "";
    const open = this._expanded.has(key);
    const shown = open ? rows : rows.slice(0, SHOW_SITES);
    const top = num(rows[0][1]) || 1;
    return `<div class="sites">${shown
      .map(([site, min]) => `<div><div class="site-top"><span class="${isDomain(site) ? "dom" : ""}">${esc(site)}</span><span>${esc(dur(min))}</span></div><div class="bar"><div style="width:${((num(min) / top) * 100).toFixed(1)}%"></div></div></div>`)
      .join("")}</div>
      ${rows.length > SHOW_SITES ? `<button class="link" data-action="more" data-who="${esc(key)}">${open ? "Show fewer" : `Show all ${rows.length}`}</button>` : ""}`;
  }

  _person(p, m, ev) {
    const week = this._range === "week";
    const total = week ? num(p.week_min) : num(p.today_min);
    const key = `${this._range}:${p.name}`;
    const list = week ? p.week : p.today;
    const totalLine = week
      ? `<b>${esc(dur(total))}</b><span>in 7 days · about ${esc(dur(total / 7))} a day</span>`
      : `<b>${esc(dur(total))}</b><span>online ${esc(m.todayLabel)}</span>`;
    const emptyText = week ? "No site use seen in the last 7 days." : "No site use seen yet today.";
    const fresh = arr(p.new).filter((x) => Array.isArray(x) && x[0]);
    const newLine = week && fresh.length
      ? `<div class="new"><b>New this week:</b> ${fresh.map((x) => esc(x[0])).join(", ")}</div>`
      : "";
    return `<section class="card">
      <div class="who"><h2>${esc(p.name)}</h2>${this._lastSeen(p, ev.stale)}</div>
      ${arr(p.devices).length ? `<div class="devices">${arr(p.devices).map(esc).join(" · ")}</div>` : ""}
      <div class="total">${total ? totalLine : `<b>0 min</b>`}</div>
      ${week ? this._week(p, m) : this._hours(p)}
      ${arr(list).length ? this._sites(list, key) : `<div class="empty">${esc(emptyText)}</div>`}
      ${newLine}
    </section>`;
  }

  _unassigned(m, ev) {
    if (!m.unassigned.length) return "";
    const week = this._range === "week";
    return `<section class="section"><span class="eyebrow">Not assigned to anyone</span>
      <div class="mini-grid">${m.unassigned
        .map((d) => {
          const list = arr(week ? d.week : d.today).slice(0, 3);
          const total = week ? num(d.week_min) : num(d.today_min);
          return `<div class="mini"><h3>${esc(d.name)}</h3>
            <div class="meta">${esc(total ? `${dur(total)} ${week ? "in 7 days" : "today"}` : week ? "Nothing in 7 days" : "Nothing yet today")}${d.active_now && !ev.stale ? " · online now" : ""}</div>
            ${list.length ? `<div class="tops">${list.map((x) => esc(x[0])).join(" · ")}</div>` : ""}</div>`;
        })
        .join("")}</div>
      <div class="hint">To put a device under someone, add its MAC to <code>sitewatch/people.json</code> in the docker-host repo.</div>
    </section>`;
  }

  _render() {
    if (!this._hass) return;
    const m = this._model();
    const ev = this._evaluate(m);

    const alerts = ev.alerts.length
      ? `<section class="alerts" role="status">${ev.alerts
          .map((x) => `<div class="alert ${x.level}">${svg(x.icon)}<div><b>${esc(x.title)}</b><span>${esc(x.text)}</span>${x.hint ? `<small>${esc(x.hint)}</small>` : ""}</div></div>`)
          .join("")}</section>`
      : "";

    const seg = `<div class="seg" role="group" aria-label="Time range">${Object.entries(RANGES)
      .map(([k, label]) => `<button data-action="range" data-range="${k}" aria-pressed="${this._range === k}">${esc(label)}</button>`)
      .join("")}</div>`;

    const how = `<details class="how" ${this._howOpen ? "open" : ""}><summary>${svg("mdiInformationOutline")}How this is counted</summary><ul>
      <li>Everything comes from Pi-hole's DNS log: which device looked up which site, never what was on the page.</li>
      <li>Time is an estimate. A ${m.bucketMin}-minute window counts for a site when a device loads at least ${m.minHosts} different parts of it (pages, images, video). Apps refreshing in the background can still count, especially on phones overnight.</li>
      <li>Ads and trackers Pi-hole blocks, CDNs, and phone/OS background services are left out. Sites without a friendly name show as their domain.</li>
      <li>Not visible: the Kids Guest and Guest Wi-Fi networks, VPNs, and school-managed devices that send their traffic through a filter. Work laptops are left out on purpose.</li>
      ${m.newReady ? "" : `<li>"New this week" appears once there's a week of history before it${m.historyFrom ? ` (history starts ${esc(dayLabel(localMs(m.historyFrom)))})` : ""}.</li>`}
    </ul></details>`;

    const body = m.ok
      ? `<div class="bar-row">${seg}<span class="est">Estimated from DNS lookups</span></div>
         <main class="grid">${m.people.map((p) => this._person(p, m, ev)).join("")}</main>
         ${this._unassigned(m, ev)}${how}`
      : how;

    const s = ev.status;
    const html = `
      <style>${CSS}</style>
      <div class="app">
        <header class="top">
          ${this._narrow ? `<button class="icon-btn" data-action="menu" aria-label="Menu">${svg("mdiMenu")}</button>` : ""}
          <div class="brand">${svg("mdiWeb")}</div>
          <div class="titles"><h1>Online</h1>
            <div class="status"><span class="dot ${s.dot}"></span><b>${esc(s.label)}</b><span class="muted">·</span><span class="muted detail">${esc(s.detail)}</span></div></div>
        </header>
        ${alerts}
        ${body}
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

if (!customElements.get("online-panel")) customElements.define("online-panel", OnlinePanel);
