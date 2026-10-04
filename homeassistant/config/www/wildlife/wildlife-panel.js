// Wildlife panel: a dependency-free web component registered via panel_custom.
// One Frigate camera, every animal except dogs (ours) and people (the Security panel's job).
// Sightings come from Frigate events via the HA integration; "here now" from the
// {camera}_{label}_occupancy binary sensors, which only exist for labels Frigate tracks.

const ICONS = {
  mdiPaw: "M8.35,3C9.53,2.83 10.78,4.12 11.14,5.9C11.5,7.67 10.85,9.25 9.67,9.43C8.5,9.61 7.24,8.32 6.87,6.54C6.5,4.77 7.17,3.19 8.35,3M15.5,3C16.69,3.19 17.35,4.77 17,6.54C16.62,8.32 15.37,9.61 14.19,9.43C13,9.25 12.35,7.67 12.72,5.9C13.08,4.12 14.33,2.83 15.5,3M3,7.6C4.14,7.11 5.69,8 6.5,9.55C7.26,11.13 7,12.79 5.87,13.28C4.74,13.77 3.2,12.89 2.41,11.32C1.62,9.75 1.9,8.08 3,7.6M21,7.6C22.1,8.08 22.38,9.75 21.59,11.32C20.8,12.89 19.26,13.77 18.13,13.28C17,12.79 16.74,11.13 17.5,9.55C18.31,8 19.86,7.11 21,7.6M19.33,18.38C19.37,19.32 18.65,20.36 17.79,20.75C16,21.57 13.88,19.87 11.89,19.87C9.9,19.87 7.76,21.64 6,20.75C5,20.26 4.31,18.96 4.44,17.88C4.62,16.39 6.41,15.59 7.47,14.5C8.88,13.09 9.88,10.44 11.89,10.44C13.89,10.44 14.95,13.05 16.3,14.5C17.41,15.72 19.26,16.75 19.33,18.38Z",
  mdiCat: "M12,8L10.67,8.09C9.81,7.07 7.4,4.5 5,4.5C5,4.5 3.03,7.46 4.96,11.41C4.41,12.24 4.07,12.67 4,13.66L2.07,13.95L2.28,14.93L4.04,14.67L4.18,15.38L2.61,16.32L3.08,17.21L4.53,16.32C5.68,18.76 8.59,20 12,20C15.41,20 18.32,18.76 19.47,16.32L20.92,17.21L21.39,16.32L19.82,15.38L19.96,14.67L21.72,14.93L21.93,13.95L20,13.66C19.93,12.67 19.59,12.24 19.04,11.41C20.97,7.46 19,4.5 19,4.5C16.6,4.5 14.19,7.07 13.33,8.09L12,8M9,11A1,1 0 0,1 10,12A1,1 0 0,1 9,13A1,1 0 0,1 8,12A1,1 0 0,1 9,11M15,11A1,1 0 0,1 16,12A1,1 0 0,1 15,13A1,1 0 0,1 14,12A1,1 0 0,1 15,11M11,14H13L12.3,15.39C12.5,16.03 13.06,16.5 13.75,16.5A1.5,1.5 0 0,0 15.25,15H15.75A2,2 0 0,1 13.75,17C13,17 12.35,16.59 12,16V16H12C11.65,16.59 11,17 10.25,17A2,2 0 0,1 8.25,15H8.75A1.5,1.5 0 0,0 10.25,16.5C10.94,16.5 11.5,16.03 11.7,15.39L11,14Z",
  mdiBird: "M23 11.5L19.95 10.37C19.69 9.22 19.04 8.56 19.04 8.56C17.4 6.92 14.75 6.92 13.11 8.56L11.63 10.04L5 3C4 7 5 11 7.45 14.22L2 19.5C2 19.5 10.89 21.5 16.07 17.45C18.83 15.29 19.45 14.03 19.84 12.7L23 11.5M17.71 11.72C17.32 12.11 16.68 12.11 16.29 11.72C15.9 11.33 15.9 10.7 16.29 10.31C16.68 9.92 17.32 9.92 17.71 10.31C18.1 10.7 18.1 11.33 17.71 11.72Z",
  mdiCctvOff: "M20.84 22.73L18.11 20H17C15.9 20 15 19.1 15 18V16.89L12.66 14.55L11.81 15.04C10.86 15.59 9.63 15.26 9.08 14.31L7.58 11.71C7.18 11 7.25 10.18 7.68 9.57L1.11 3L2.39 1.73L22.11 21.46L20.84 22.73M18.5 13C18.5 12.43 18.3 11.9 17.97 11.5L19.94 10.35C20.95 9.76 21.3 8.47 20.71 7.46L19.33 5.06C18.74 4.05 17.45 3.7 16.44 4.28L10.77 7.57L17.86 14.66C18.26 14.22 18.5 13.64 18.5 13M2 12.62L5.5 18.68L8.03 15.5L6.03 12.03L2 12.62Z",
  mdiMotionSensorOff: "M11.4 8.2H15V10H13.2L11.4 8.2M19.67 1H18.33C18.33 3.58 20.42 5.67 23 5.67V4.33C21.16 4.33 19.67 2.84 19.67 1M21 1C21 2.11 21.9 3 23 3V1H21M17 1H15.67C15.67 5.05 18.95 8.33 23 8.33V7C19.69 7 17 4.31 17 1M10 3.8C11 3.8 11.8 3 11.8 2S11 .2 10 .2 8.2 1 8.2 2 9 3.8 10 3.8M2.39 1.73L1.11 3L3.46 5.35L2 5.8V11H3.8V7.33L5.05 6.94L5.68 7.57L2 22H3.8L6.67 13.89L9 17V22H10.8V15.59L8.31 11.05L8.5 10.37L20.84 22.73L22.11 21.46L2.39 1.73M9.38 4.87C9.08 4.37 8.54 4.03 7.92 4.03C7.75 4.03 7.58 4.06 7.42 4.11L7.34 4.14L11.35 8.15L9.38 4.87Z",
  mdiPlay: "M8,5.14V19.14L19,12.14L8,5.14Z",
  mdiPlayCircleOutline: "M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M10,16.5L16,12L10,7.5V16.5Z",
  mdiChevronLeft: "M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z",
  mdiChevronRight: "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",
  mdiClose: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
  mdiMenu: "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",
  mdiInformationOutline: "M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z",
  mdiCloudAlertOutline: "M21.86 12.5C21.1 11.63 20.15 11.13 19 11C19 9.05 18.32 7.4 16.96 6.04C15.6 4.68 13.95 4 12 4C10.42 4 9 4.47 7.75 5.43S5.67 7.62 5.25 9.15C4 9.43 2.96 10.08 2.17 11.1S1 13.28 1 14.58C1 16.09 1.54 17.38 2.61 18.43C3.69 19.5 5 20 6.5 20H18.5C19.75 20 20.81 19.56 21.69 18.69C22.56 17.81 23 16.75 23 15.5C23 14.35 22.62 13.35 21.86 12.5M20.27 17.27C19.79 17.76 19.2 18 18.5 18H6.5C5.53 18 4.71 17.66 4.03 17C3.34 16.29 3 15.47 3 14.5S3.34 12.71 4.03 12.03C4.71 11.34 5.53 11 6.5 11H7C7 9.62 7.5 8.44 8.46 7.46C9.44 6.5 10.62 6 12 6S14.56 6.5 15.54 7.46C16.5 8.44 17 9.62 17 11V13H18.5C19.2 13 19.79 13.24 20.27 13.73S21 14.8 21 15.5 20.76 16.79 20.27 17.27M11 15H13V17H11V15M11 7H13V13H11V7Z",
};

// Frigate keeps snapshots 7 days (snapshots.retain.default), so older sightings have nothing to show.
const HISTORY_DAYS = 7;
const VISIT_GAP_MS = 2 * 60e3;
const SNAP_MS = 10e3;
const SNAP_ACTIVE_MS = 2e3;
const RECENT_ROWS = 8;
// The Coral COCO model has no deer class; a deer usually comes through as one of these.
const LARGE = ["horse", "cow", "sheep"];
const KINDS = {
  cat: { name: "Cat", plural: "Cats", icon: "mdiCat" },
  bird: { name: "Bird", plural: "Birds", icon: "mdiBird" },
  bear: { name: "Bear", plural: "Bears", icon: "mdiPaw" },
  large: { name: "Large animal", plural: "Large animals", icon: "mdiPaw" },
};
const kindOf = (label) => (LARGE.includes(label) ? "large" : label);
const kindInfo = (k) => KINDS[k] || { name: nice(k), plural: `${nice(k)}s`, icon: "mdiPaw" };

const svg = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ""}"/></svg>`;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const live = (st) => !!st && !["unavailable", "unknown"].includes(st.state);
const nice = (s) => String(s).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const startOfDay = (ms) => new Date(ms).setHours(0, 0, 0, 0);
const listText = (xs, conj = "or") => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${conj} ${xs[xs.length - 1]}`);

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
  --text: #eef3fa; --muted: #8593a8; --moss: #a3b98a; --moss-2: #4d6138;
  --green: #22c55e; --amber: #f5b041; --red: #f0616d; --blue: #4cc3ff; --grey: #64748b;
  display: block; height: 100%; overflow-y: auto; container-type: inline-size;
  background: radial-gradient(1200px 600px at 10% -10%, rgba(120,150,90,.14), transparent 60%),
              radial-gradient(900px 500px at 110% 110%, rgba(40,110,190,.10), transparent 60%), var(--bg);
  color: var(--text); font-family: "Outfit", "SF Pro Display", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
* { box-sizing: border-box; }
button { font: inherit; color: inherit; border: 0; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; }
button:disabled { cursor: default; }
.ic { width: 24px; height: 24px; fill: currentColor; flex: none; }
.muted { color: var(--muted); }
.app { max-width: 1320px; margin: 0 auto; padding: 28px 28px 40px; }

.top { display: flex; align-items: center; gap: 18px; margin-bottom: 26px; }
.brand { width: 76px; height: 76px; border-radius: 22px; display: grid; place-items: center; flex: none; color: #fff;
  background: linear-gradient(160deg, var(--moss), var(--moss-2)); box-shadow: 0 10px 30px rgba(77,97,56,.4), inset 0 1px 0 rgba(255,255,255,.35); }
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
  grid-template-areas: "hero list" "about list"; }
.card { background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line); border-radius: 30px; padding: 24px 26px; min-width: 0; }
.a-hero { grid-area: hero; } .a-list { grid-area: list; } .a-about { grid-area: about; }
.eyebrow { font-size: 13px; letter-spacing: .12em; font-weight: 600; color: var(--muted); text-transform: uppercase; }
.head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }

/* Latest sighting */
.shot { position: relative; display: block; width: 100%; margin-top: 14px; border-radius: 20px; overflow: hidden; background: #0b111c;
  border: 1.5px solid var(--line); aspect-ratio: 16 / 9; padding: 0; text-align: left; }
.shot:disabled { cursor: default; }
.shot img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.shot.now { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(76,195,255,.25); }
.shot.dim img { filter: grayscale(.6) brightness(.45); }
.shot.off img { filter: grayscale(1) brightness(.3); }
.shot .pills { position: absolute; top: 10px; left: 10px; right: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
.pill { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 9px; border-radius: 8px; font-size: 12.5px; font-weight: 600;
  background: rgba(8,13,23,.75); color: #d6deea; backdrop-filter: blur(6px); }
.pill .ic { width: 15px; height: 15px; }
.pill.now { background: rgba(76,195,255,.9); color: #06213a; }
.pill.bad { background: rgba(240,97,109,.92); color: #2b0508; }
.shot .center { position: absolute; inset: 0; display: grid; place-items: center; align-content: center; gap: 6px; padding: 20px;
  color: #d6deea; font-size: 17px; text-align: center; }
.shot .center .ic { width: 34px; height: 34px; color: var(--muted); }
.shot .center small { font-size: 14px; color: var(--muted); }
.shot.dim .center, .shot.off .center { background: rgba(4,8,15,.5); }
.meta { margin-top: 14px; display: flex; gap: 14px; align-items: center; }
.meta .tile { width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; flex: none; background: #172234; border: 1px solid var(--line); color: var(--moss); }
.meta .tile.now { color: var(--blue); }
.meta .tile .ic { width: 30px; height: 30px; }
.meta b { display: block; font-size: 24px; font-weight: 600; line-height: 1.2; }
.meta span { display: block; font-size: 16px; color: var(--muted); margin-top: 2px; font-variant-numeric: tabular-nums; }
.note { margin-top: 10px; font-size: 14.5px; color: var(--muted); line-height: 1.45; }
.primary { margin-top: 16px; width: 100%; height: 62px; border-radius: 18px; display: flex; align-items: center; justify-content: center; gap: 8px;
  font-size: 18px; font-weight: 600; background: #1c2940; border: 1px solid rgba(148,170,200,.22); color: var(--text); }
.primary.now { background: linear-gradient(180deg, #7fd6ff, var(--blue)); border-color: transparent; color: #06213a; }
.primary:disabled { opacity: .45; }
.why { margin-top: 8px; font-size: 13px; color: var(--muted); text-align: center; }
.link { margin-top: 12px; color: #cbd5e1; font-weight: 600; font-size: 15px; }
.links { display: flex; gap: 18px; flex-wrap: wrap; }

/* Sightings */
.summary { margin-top: 10px; font-size: 14.5px; color: var(--muted); }
.summary b { color: var(--text); font-weight: 600; }
.day { margin-top: 16px; font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); font-weight: 600; }
.ev { display: grid; grid-template-columns: 72px 40px minmax(0, 1fr) auto; width: 100%; text-align: left; gap: 12px; align-items: center;
  padding: 9px 0; border-top: 1px solid var(--line); font-size: 16px; }
.day + .ev { border-top: 0; }
.ev:hover { background: rgba(148,170,200,.05); }
.ev .t { font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ev .th { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; background: #0b111c; display: grid; place-items: center; color: var(--muted); }
.ev .th .ic { width: 22px; height: 22px; }
.ev .w { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ev .w small { color: var(--muted); font-size: 12.5px; margin-left: 4px; }
.ev .d { color: var(--muted); font-size: 13px; white-space: nowrap; display: flex; align-items: center; gap: 6px; }
.ev .d .ic { width: 16px; height: 16px; color: #cbd5e1; }
.empty { margin-top: 14px; padding: 18px; border-radius: 14px; border: 1px dashed var(--line); color: var(--muted); font-size: 15px; text-align: center; line-height: 1.45; }

/* What it watches for */
.kinds { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.kind { display: inline-flex; align-items: center; gap: 7px; height: 40px; padding: 0 14px 0 11px; border-radius: 12px; font-size: 15px; font-weight: 600;
  background: #172234; border: 1px solid var(--line); }
.kind .ic { width: 20px; height: 20px; color: var(--moss); }
.kind.off { color: var(--muted); border-style: dashed; background: none; }
.kind.off .ic { color: var(--grey); }
.kind small { font-weight: 500; font-size: 12.5px; color: var(--amber); }
.item { display: flex; gap: 12px; align-items: flex-start; margin-top: 14px; padding: 12px 14px; border-radius: 16px; background: #121a28;
  border: 1px solid rgba(245,176,65,.3); line-height: 1.4; }
.item .ic { width: 22px; height: 22px; margin-top: 1px; color: var(--amber); }
.item b { font-weight: 600; display: block; font-size: 16px; }
.item span { font-size: 14px; color: var(--muted); }
.item code { font-size: 13px; color: var(--text); }
.facts { margin: 14px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 14.5px; color: var(--muted); line-height: 1.45; }
.facts li { display: flex; gap: 10px; }
.facts .ic { width: 18px; height: 18px; margin-top: 2px; color: var(--grey); }
.facts b { color: var(--text); font-weight: 600; }

/* Player */
.modal { position: fixed; inset: 0; z-index: 20; background: rgba(3,6,12,.78); backdrop-filter: blur(6px); display: grid; place-items: center; padding: 20px; }
.sheet { width: min(980px, 100%); max-height: 100%; overflow: auto; border-radius: 24px; background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line); padding: 16px; }
.sheet-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 2px 4px 12px; }
.sheet-head b { display: block; font-size: 19px; font-weight: 600; }
.sheet-head span { font-size: 14px; color: var(--muted); }
.media { border-radius: 16px; overflow: hidden; background: #000; aspect-ratio: 16 / 9; display: grid; place-items: center; }
.media video, .media img { width: 100%; height: 100%; object-fit: contain; display: block; }
.noclip { color: var(--muted); font-size: 15px; }
.sheet-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
.btn2 { height: 44px; padding: 0 14px; border-radius: 14px; background: #172234; border: 1px solid var(--line); color: #cbd5e1; font-weight: 600; font-size: 15px; display: inline-flex; align-items: center; gap: 6px; }
.btn2:disabled { opacity: .4; }
.btn2 .ic { width: 20px; height: 20px; }

@container (max-width: 980px) {
  .grid { grid-template-columns: minmax(0, 1fr); grid-template-areas: "hero" "list" "about"; }
}
@container (max-width: 640px) {
  .app { padding: 14px 14px 24px; }
  .top { gap: 12px; margin-bottom: 16px; }
  .brand, .icon-btn { width: 44px; height: 44px; border-radius: 14px; }
  .brand .ic { width: 24px; height: 24px; }
  h1 { font-size: 22px; } .status { font-size: 14px; margin-top: 3px; } .dot { width: 10px; height: 10px; }
  .grid { gap: 14px; }
  .card { border-radius: 24px; padding: 18px 14px; }
  .shot { border-radius: 14px; }
  .pill { height: 22px; font-size: 11px; padding: 0 6px; }
  .meta .tile { width: 44px; height: 44px; border-radius: 12px; }
  .meta .tile .ic { width: 24px; height: 24px; }
  .meta b { font-size: 18px; } .meta span { font-size: 14px; }
  .primary { height: 54px; font-size: 16px; border-radius: 16px; }
  .ev { grid-template-columns: 64px 36px minmax(0, 1fr) auto; font-size: 14.5px; gap: 10px; }
  .ev .th { width: 36px; height: 36px; }
  .kind { height: 36px; font-size: 14px; }
  .modal { padding: 0; place-items: end stretch; }
  .sheet { border-radius: 22px 22px 0 0; padding: 12px 12px calc(12px + env(safe-area-inset-bottom)); }
}
`;

class WildlifePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._visits = [];
    this._loaded = false;
    this._failed = false;
    this._showAll = false;
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
    if (first && this.isConnected) this._loadEvents();
    // An animal arriving or leaving means Frigate has a new or finished event to show.
    const sig = this._present().join(",");
    if (this._presentSig !== undefined && sig !== this._presentSig) this._loadEvents();
    this._presentSig = sig;
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
    this._eventsTimer = setInterval(() => this._loadEvents(), 60e3);
    if (this._hass) this._loadEvents();
    window.addEventListener("keydown", this._onKey);
    this._scheduleRender();
  }

  disconnectedCallback() {
    this._closePlayer();
    window.removeEventListener("keydown", this._onKey);
    clearInterval(this._tick);
    clearInterval(this._snapTimer);
    clearInterval(this._eventsTimer);
  }

  get _cam() {
    const c = this._cfg || {};
    const id = c.camera || "driveway";
    return { id, name: c.name || nice(id), frigate: c.frigate || id, cameraId: `camera.${id}` };
  }

  get _labels() {
    return this._cfg?.labels?.length ? this._cfg.labels : ["cat", "bird", "bear", ...LARGE];
  }

  get _instance() {
    return this._cfg?.frigate_instance || "frigate";
  }

  _occ(label) {
    return this._hass?.states[`binary_sensor.${this._cam.id}_${label}_occupancy`];
  }

  // Display kinds currently on camera, in config order.
  _present() {
    if (!this._hass) return [];
    return [...new Set(this._labels.filter((l) => this._occ(l)?.state === "on").map(kindOf))];
  }

  // Frigate only makes occupancy sensors for the labels it tracks on this camera.
  _tracking() {
    const kinds = [...new Set(this._labels.map(kindOf))];
    return kinds.map((k) => ({ kind: k, tracked: this._labels.some((l) => kindOf(l) === k && this._occ(l)) }));
  }

  async _loadEvents() {
    if (!this._hass || this._loading) return;
    this._loading = true;
    try {
      let res = await this._hass.callWS({
        type: "frigate/events/get",
        instance_id: this._instance,
        labels: this._labels,
        after: Math.floor((Date.now() - HISTORY_DAYS * 864e5) / 1000),
        limit: 1000,
      });
      if (typeof res === "string") res = JSON.parse(res);
      if (!Array.isArray(res)) throw new Error("unexpected reply");
      const cam = String(this._cam.frigate).toLowerCase();
      const open = {};
      const visits = [];
      for (const ev of res.filter((e) => String(e.camera).toLowerCase() === cam).sort((a, b) => a.start_time - b.start_time)) {
        if (!this._labels.includes(ev.label)) continue;
        const kind = kindOf(ev.label);
        const start = ev.start_time * 1000;
        const end = ev.end_time ? ev.end_time * 1000 : null;
        const cur = open[kind];
        if (cur && cur.end !== null && start - cur.end <= VISIT_GAP_MS) {
          cur.end = end === null ? null : Math.max(cur.end, end);
          cur.events.push(ev);
        } else {
          open[kind] = { key: ev.id, kind, start, end, events: [ev] };
          visits.push(open[kind]);
        }
      }
      this._visits = visits.sort((a, b) => b.start - a.start);
      this._loaded = true;
      this._failed = false;
    } catch (_) {
      this._failed = true;
    } finally {
      this._loading = false;
      this._scheduleRender();
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

  // Swap each live frame only once the new one has loaded, so the tile never flashes blank.
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

  // Prefer the event with a clip, so Play shows video rather than a still.
  _bestEvent(v) {
    return v.events.find((e) => e.has_clip) || v.events.find((e) => e.has_snapshot) || v.events[0];
  }

  _openPlayer(visit, idx) {
    this._player = { visit, idx: idx ?? Math.max(0, visit.events.indexOf(this._bestEvent(visit))) };
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
      ? `<video controls autoplay playsinline muted data-sign="${esc(this._media(ev, "clip.mp4"))}"></video>`
      : ev.has_snapshot
        ? `<img data-sign="${esc(this._media(ev, "snapshot.jpg"))}" alt="">`
        : `<div class="noclip">No recording was saved for this sighting.</div>`;
    const seenAs = v.kind === "large" ? ` · Frigate saw a ${ev.label}` : "";
    this._playerEl.innerHTML = `
      <div class="modal" data-action="close-player">
        <div class="sheet" role="dialog" aria-label="Sighting">
          <div class="sheet-head">
            <div><b>${esc(kindInfo(v.kind).name)} · ${esc(this._cam.name)}</b><span>${esc(when)} · ${esc(len)}${ev.has_clip ? "" : " · snapshot only"}${esc(seenAs)}</span></div>
            <button class="icon-btn" data-action="close-player" aria-label="Close">${svg("mdiClose")}</button>
          </div>
          <div class="media">${media}</div>
          <div class="sheet-foot">
            ${n > 1 ? `<button class="btn2" data-action="clip" data-step="-1" ${p.idx === 0 ? "disabled" : ""}>${svg("mdiChevronLeft")}Earlier</button><span class="muted">Clip ${p.idx + 1} of ${n}</span><button class="btn2" data-action="clip" data-step="1" ${p.idx === n - 1 ? "disabled" : ""}>Later${svg("mdiChevronRight")}</button>` : "<span></span>"}
            <button class="btn2" data-action="live">${svg("mdiPlayCircleOutline")}Live</button>
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

  _fmtTime(ms) {
    const tf = this._hass?.locale?.time_format;
    const hour12 = tf === "12" ? true : tf === "24" ? false : undefined;
    return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12 });
  }

  _whenText(ms) {
    const day = dayLabel(ms);
    return `${agoText(ms)} · ${day === "Today" ? "" : `${day} `}${this._fmtTime(ms)}`;
  }

  _onClick(e) {
    const el = e.target.closest?.("[data-action]");
    if (!el || !this._hass) return;
    const action = el.dataset.action;
    if (action === "menu") this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
    else if (action === "play") {
      const v = this._visits.find((x) => x.key === el.dataset.key);
      if (v) this._openPlayer(v);
    } else if (action === "clip") {
      const p = this._player;
      if (p) {
        p.idx = Math.min(p.visit.events.length - 1, Math.max(0, p.idx + Number(el.dataset.step)));
        this._renderPlayer();
      }
    } else if (action === "close-player") {
      if (e.target === el || el.tagName === "BUTTON") this._closePlayer();
    } else if (action === "live") {
      // HA's camera dialog has the live stream and its controls; no need to rebuild WebRTC here.
      this._closePlayer();
      this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: this._cam.cameraId }, bubbles: true, composed: true }));
    } else if (action === "more") {
      this._showAll = !this._showAll;
      this._render();
    }
  }

  _render() {
    if (!this._hass) return;
    const cam = this._cam;
    const st = this._hass.states;
    const camSt = st[cam.cameraId];
    const detect = st[`switch.${cam.id}_detect`];
    const online = live(camSt);
    const detecting = !detect || detect.state !== "off";
    const picture = camSt?.attributes?.entity_picture || "";
    const present = online ? this._present() : [];
    const presentSince = present.length
      ? Math.min(...this._labels.filter((l) => this._occ(l)?.state === "on").map((l) => Date.parse(this._occ(l).last_changed) || Date.now()))
      : null;
    const tracking = this._tracking();
    const tracked = tracking.filter((t) => t.tracked).map((t) => t.kind);
    const untracked = tracking.filter((t) => !t.tracked).map((t) => t.kind);
    const latest = this._visits[0];
    const pluralNames = (ks) => ks.map((k) => kindInfo(k).plural.toLowerCase());

    // Exactly one status: Offline > Detection off > Here now > Can't read > Not set up > Watching.
    let status;
    if (!online) status = { dot: "red", label: `${cam.name} camera offline`, detail: "No video, so nothing is being watched" };
    else if (!detecting) status = { dot: "amber", label: "Detection off", detail: `Turn it on in Security to catch animals on the ${cam.name.toLowerCase()}` };
    else if (present.length) status = { dot: "blue", label: `${listText(present.map((k) => kindInfo(k).name))} on the ${cam.name.toLowerCase()}`, detail: `since ${this._fmtTime(presentSince)}` };
    else if (this._failed && !this._loaded) status = { dot: "amber", label: "Can't load sightings", detail: "The Frigate integration didn't answer" };
    else if (!tracked.length) status = { dot: "amber", label: "Not set up", detail: `Frigate isn't looking for animals on the ${cam.name.toLowerCase()}` };
    else {
      const detail = latest ? `last: ${kindInfo(latest.kind).name.toLowerCase()} ${agoText(latest.start)}` : this._loaded ? `nothing besides dogs in ${HISTORY_DAYS} days` : "loading sightings…";
      status = untracked.length
        ? { dot: "amber", label: `Watching for ${listText(pluralNames(tracked), "and")}`, detail }
        : { dot: "green", label: "Watching", detail };
    }

    // Hero: live while an animal is there, otherwise the latest sighting, otherwise the empty driveway.
    let hero;
    const pills = [];
    if (present.length) {
      pills.push(`<span class="pill now">${svg(kindInfo(present[0]).icon)}${esc(listText(present.map((k) => kindInfo(k).name)))} now</span>`);
      hero = {
        cls: "now",
        img: picture ? `<img data-snap="${esc(picture)}" data-active="1" src="${esc(picture)}" alt="${esc(cam.name)} live">` : "",
        action: `data-action="live"`,
        tile: { icon: kindInfo(present[0]).icon, now: true },
        title: `${listText(present.map((k) => kindInfo(k).name))} here now`,
        sub: `Since ${this._fmtTime(presentSince)} · ${cam.name}`,
        button: `<button class="primary now" data-action="live">${svg("mdiPlayCircleOutline")}Watch live</button>`,
      };
    } else if (latest) {
      const ev = this._bestEvent(latest);
      const len = latest.end ? fmtDur(latest.end - latest.start) : "still there";
      pills.push(`<span class="pill">${svg(kindInfo(latest.kind).icon)}${esc(kindInfo(latest.kind).name)}</span>`);
      if (!ev.has_snapshot) pills.push(`<span class="pill">No snapshot saved</span>`);
      hero = {
        cls: "",
        img: ev.has_snapshot ? `<img data-sign="${esc(this._media(ev, "snapshot.jpg"))}" alt="Latest ${esc(kindInfo(latest.kind).name.toLowerCase())} on the ${esc(cam.name.toLowerCase())}">` : "",
        action: `data-action="play" data-key="${esc(latest.key)}"`,
        tile: { icon: kindInfo(latest.kind).icon },
        title: kindInfo(latest.kind).name,
        sub: `${this._whenText(latest.start)} · ${len}`,
        note: latest.kind === "large" ? `Frigate saw a ${ev.label}. Its model has no deer class, so this is most likely a deer.` : "",
        button: `<button class="primary" data-action="play" data-key="${esc(latest.key)}">${svg("mdiPlay")}${ev.has_clip ? "Play clip" : "View snapshot"}</button>`,
      };
    } else {
      const text = !this._loaded ? (this._failed ? "Can't load sightings" : "Loading sightings…") : `No animals besides dogs in the last ${HISTORY_DAYS} days`;
      hero = {
        cls: online ? "dim" : "off",
        img: online && picture ? `<img data-snap="${esc(picture)}" src="${esc(picture)}" alt="">` : "",
        center: `${svg(this._failed && !this._loaded ? "mdiCloudAlertOutline" : "mdiPaw")}<span>${esc(text)}</span>${online && this._loaded ? `<small>The camera is watching. Sightings show up here.</small>` : ""}`,
        action: `data-action="live"`,
        button: `<button class="primary" data-action="live">${svg("mdiPlayCircleOutline")}Watch live</button>`,
      };
    }
    let why = "";
    if (!online) {
      why = `The ${cam.name.toLowerCase()} camera isn't sending video.`;
      if (latest) pills.push(`<span class="pill bad">${svg("mdiCctvOff")}Camera offline</span>`);
      else {
        hero.center = `${svg("mdiCctvOff")}<span>Offline</span>`;
        hero.button = `<button class="primary" disabled>${svg("mdiPlayCircleOutline")}Watch live</button>`;
      }
    }
    const heroCard = `<section class="card a-hero">
      <div class="head"><span class="eyebrow">${present.length ? "On camera now" : "Latest sighting"}</span><span class="muted">${esc(cam.name)}</span></div>
      <button class="shot ${hero.cls}" ${hero.action} ${!online && !latest ? "disabled" : ""} aria-label="${present.length || !latest ? `Watch ${esc(cam.name)} live` : "Play latest sighting"}">
        ${hero.img}
        ${hero.center ? `<div class="center">${hero.center}</div>` : ""}
        <div class="pills">${pills.join("")}</div>
      </button>
      ${hero.title ? `<div class="meta"><div class="tile ${hero.tile.now ? "now" : ""}">${svg(hero.tile.icon)}</div><div><b>${esc(hero.title)}</b><span>${esc(hero.sub)}</span></div></div>` : ""}
      ${hero.note ? `<div class="note">${esc(hero.note)}</div>` : ""}
      ${hero.button}
      ${why ? `<div class="why">${esc(why)}</div>` : ""}
      ${latest && !present.length && online ? `<div class="links"><button class="link" data-action="live">Watch live</button></div>` : ""}
    </section>`;

    // Sightings: per-kind counts, then a day-grouped list (latest 8 unless expanded).
    const counts = Object.entries(this._visits.reduce((a, v) => ((a[v.kind] = (a[v.kind] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
    const listed = this._showAll ? this._visits : this._visits.slice(0, RECENT_ROWS);
    let lastDay = null;
    const rows = listed
      .map((v) => {
        const day = dayLabel(v.start);
        const header = day !== lastDay ? `<div class="day">${esc(day)}</div>` : "";
        lastDay = day;
        const ev = this._bestEvent(v);
        const info = kindInfo(v.kind);
        const thumb = `<img class="th" data-sign="${esc(this._media(ev, "thumbnail.jpg"))}" alt="${esc(info.name)}">`;
        const clips = v.events.filter((e) => e.has_clip).length;
        const dur = v.end ? fmtDur(v.end - v.start) : "ongoing";
        const seen = v.kind === "large" ? ` <small>seen as ${esc([...new Set(v.events.map((e) => e.label))].join("/"))}</small>` : clips > 1 ? ` <small>${clips} clips</small>` : "";
        return `${header}<button class="ev" data-action="play" data-key="${esc(v.key)}"><span class="t">${this._fmtTime(v.start)}</span>${thumb}<span class="w">${esc(info.name)}${seen}</span><span class="d">${esc(dur)} ${svg("mdiPlay")}</span></button>`;
      })
      .join("");
    const emptyText = !this._loaded
      ? this._failed
        ? "Can't load sightings. The Frigate integration didn't answer; it'll try again in a minute."
        : "Loading sightings…"
      : !tracked.length
        ? `Nothing to show yet. Frigate isn't looking for animals on the ${cam.name.toLowerCase()} (see below).`
        : `No animals besides dogs in the last ${HISTORY_DAYS} days.`;
    const listCard = `<section class="card a-list">
      <div class="head"><span class="eyebrow">Sightings</span><span class="muted">last ${HISTORY_DAYS} days</span></div>
      ${counts.length ? `<div class="summary"><b>${plural(this._visits.length, "sighting")}</b> · ${counts.map(([k, n]) => `${esc(kindInfo(k).name)} ${n}`).join(" · ")}</div>` : ""}
      ${rows || `<div class="empty">${esc(emptyText)}</div>`}
      <div class="links">${this._visits.length > RECENT_ROWS ? `<button class="link" data-action="more">${this._showAll ? "Show less" : `Show all ${this._visits.length}`}</button>` : ""}</div>
    </section>`;

    // What it watches for: the honest limits of the detector, plus any labels Frigate isn't tracking.
    const missingLabels = this._labels.filter((l) => untracked.includes(kindOf(l)));
    const aboutCard = `<section class="card a-about">
      <div class="head"><span class="eyebrow">What it watches for</span></div>
      <div class="kinds">${tracking
        .map((t) => `<span class="kind ${t.tracked ? "" : "off"}">${svg(kindInfo(t.kind).icon)}${esc(kindInfo(t.kind).plural)}${t.tracked ? "" : " <small>not set up</small>"}</span>`)
        .join("")}</div>
      ${
        untracked.length
          ? `<div class="item">${svg("mdiInformationOutline")}<div><b>Frigate isn't looking for ${esc(listText(pluralNames(untracked)))} on the ${esc(cam.name.toLowerCase())}</b><span>Add <code>${esc(missingLabels.join(", "))}</code> to the ${esc(cam.name)} camera's <code>objects.track</code> in the frigate repo, then reload the Frigate integration.</span></div></div>`
          : ""
      }
      <ul class="facts">
        <li>${svg("mdiInformationOutline")}<span><b>Large animal</b> means Frigate saw a horse, cow or sheep. Its model has no deer class, so that's most likely a deer.</span></li>
        <li>${svg("mdiInformationOutline")}<span><b>Left out:</b> dogs (that's ours) and people (see Security). Foxes and coyotes usually register as dogs, so they're left out too.</span></li>
      </ul>
    </section>`;

    const s = status;
    const html = `
      <div class="app">
        <header class="top">
          ${this._narrow ? `<button class="icon-btn" data-action="menu" aria-label="Menu">${svg("mdiMenu")}</button>` : ""}
          <div class="brand">${svg("mdiPaw")}</div>
          <div class="titles"><h1>Wildlife</h1>
            <div class="status"><span class="dot ${s.dot}"></span><b>${esc(s.label)}</b><span class="muted">·</span><span class="muted detail">${esc(s.detail)}</span></div></div>
        </header>
        <main class="grid">${heroCard}${listCard}${aboutCard}</main>
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

if (!customElements.get("wildlife-panel")) customElements.define("wildlife-panel", WildlifePanel);
