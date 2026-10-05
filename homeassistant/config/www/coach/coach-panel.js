// Coaching panel: a dependency-free web component registered via panel_custom.
// It only drives the existing scripts (which dispatch the GitHub workflows that
// write to Hevy); generation itself is unchanged.

const ICONS = {
  mdiAlertOutline: "M12,2L1,21H23M12,6L19.53,19H4.47M11,10V14H13V10M11,16V18H13V16",
  mdiArmFlexOutline: "M7 7.76V16.25H11.08L11.68 15.34C12.84 13.55 14.93 12.75 16.47 12.75C17 12.75 17.45 12.84 17.79 13C18.7 13.41 18.95 14.18 19 14.74C19.08 15.87 18.5 17.03 17.5 17.71C16.6 18.33 14.44 19 11.87 19C10.12 19 7.61 18.69 5.12 17.3C5.41 14.85 6 10.88 7 7.76M7 3C4 7.09 3 18.34 3 18.34C5.9 20.31 9.08 21 11.87 21C14.86 21 17.39 20.21 18.64 19.36C21.64 17.32 21.94 12.71 18.64 11.18C18 10.89 17.26 10.75 16.47 10.75C14.17 10.75 11.5 11.96 10 14.25H9V7.09H11L12 4L7 3Z",
  mdiCalendarWeek: "M6 1H8V3H16V1H18V3H19C20.11 3 21 3.9 21 5V19C21 20.11 20.11 21 19 21H5C3.89 21 3 20.1 3 19V5C3 3.89 3.89 3 5 3H6V1M5 8V19H19V8H5M7 10H17V12H7V10Z",
  mdiChartLine: "M16,11.78L20.24,4.45L21.97,5.45L16.74,14.5L10.23,10.75L5.46,19H22V21H2V3H4V17.54L9.5,8L16,11.78Z",
  mdiCheck: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
  mdiChevronDown: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  mdiDumbbell: "M20.57,14.86L22,13.43L20.57,12L17,15.57L8.43,7L12,3.43L10.57,2L9.14,3.43L7.71,2L5.57,4.14L4.14,2.71L2.71,4.14L4.14,5.57L2,7.71L3.43,9.14L2,10.57L3.43,12L7,8.43L15.57,17L12,20.57L13.43,22L14.86,20.57L16.29,22L18.43,19.86L19.86,21.29L21.29,19.86L19.86,18.43L22,16.29L20.57,14.86Z",
  mdiLightningBolt: "M11 15H6L13 1V9H18L11 23V15Z",
  mdiMenu: "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",
  mdiPlay: "M8,5.14V19.14L19,12.14L8,5.14Z",
  mdiRefresh: "M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",
  mdiSend: "M2,21L23,12L2,3V10L17,12L2,14V21Z",
  mdiShieldAlertOutline: "M21,11C21,16.55 17.16,21.74 12,23C6.84,21.74 3,16.55 3,11V5L12,1L21,5V11M12,21C15.75,20 19,15.54 19,11.22V6.3L12,3.18L5,6.3V11.22C5,15.54 8.25,20 12,21M11,7H13V13H11V7M11,15H13V17H11V15Z",
  mdiWeightLifter: "M12 5C10.89 5 10 5.89 10 7S10.89 9 12 9 14 8.11 14 7 13.11 5 12 5M22 1V6H20V4H4V6H2V1H4V3H20V1H22M15 11.26V23H13V18H11V23H9V11.26C6.93 10.17 5.5 8 5.5 5.5L5.5 5H7.5L7.5 5.5C7.5 8 9.5 10 12 10S16.5 8 16.5 5.5L16.5 5H18.5L18.5 5.5C18.5 8 17.07 10.17 15 11.26Z",
};

const SESSION = "sensor.lift_session_latest";
const FLAG = "input_boolean.lift_shoulder_flag";
const FEEDBACK = "input_text.lift_feedback";
const PANEL_STATE = "input_text.coach_panel_state";
const SLOW_MS = 15 * 60e3;
const EXPIRE_MS = 60 * 60e3;
const REPORT_BUSY_MS = 10 * 60e3;
// Basement set-up (packages/workout.yaml): lights to 80% + workout playlist on the basement Roku.
const WORKOUT = { script: "script.basement_workout", light: "light.basement", roku: "media_player.basement_roku" };
const WORKOUT_DONE_MS = 8000;

const TYPES = [
  { id: "heavy_1h", label: "1h Heavy", desc: "Full session", icon: "mdiWeightLifter", script: "script.lift_session_run_heavy" },
  { id: "light_30m", label: "30m Light", desc: "Short & easy", icon: "mdiLightningBolt", script: "script.lift_session_run_light" },
  { id: "shoulder_pt", label: "PT Day", desc: "Shoulder rehab", icon: "mdiArmFlexOutline", script: "script.lift_session_run_pt" },
];
const REPORTS = {
  last: { script: "script.coaching_report_run_since_last", label: "since the last report" },
  "7d": { script: "script.coaching_report_run_full_7d", label: "full 7-day window" },
};
const QUICK_FEEDBACK = ["Felt easy", "Too heavy", "Knee bugged me", "Shoulder felt good", "Loved the supersets", "Short on time"];
const WARN_FLAG = /poor|very low|\blow\b|elevated|fatigue|knee|pain|sore|injur|bugs?\b|flag_active: true/i;

const svg = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ""}"/></svg>`;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const typeInfo = (id) => TYPES.find((t) => t.id === id) || { id, label: id || "Session", desc: "", icon: "mdiDumbbell" };
const stripMd = (s) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`/g, "").trim();
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// summary_text is markdown written by the model, so parse leniently and fall back to raw lines.
function parseSummary(text) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let title = null;
  const items = [];
  for (const raw of lines) {
    const heading = raw.match(/^\*\*(.+?)\*\*:?$/) || raw.match(/^#+\s*(.+)$/);
    if (heading) {
      if (!title && !items.length) title = stripMd(heading[1]);
      else items.push({ kind: "note", heading: true, text: stripMd(heading[1]) });
      continue;
    }
    const bullet = raw.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (!bullet) {
      items.push({ kind: "note", text: stripMd(raw) });
      continue;
    }
    let body = stripMd(bullet[1]);
    let label = null;
    const lm = body.match(/^([A-Z])(\d+)[.):]?\s+(.*)$/);
    if (lm) {
      label = lm[1];
      body = lm[3];
    }
    const parts = body.split(/\s+[—–-]\s+/);
    const name = parts[0].replace(/\s*\(([^)]+)\)\s*$/, " · $1");
    if (parts.length < 2) {
      items.push({ kind: "ex", label, name });
      continue;
    }
    let spec = parts.slice(1).join(" — ");
    let rest = null;
    const rm = spec.match(/(?:→|->)?\s*rest\s+([^|,;]+)$/i);
    if (rm) {
      rest = rm[1].trim();
      spec = spec.slice(0, rm.index).replace(/[\s|,;→-]+$/, "").trim();
    }
    const segs = spec.split("|").map((s) => s.trim()).filter(Boolean);
    const [reps, load] = (segs[0] || "").split(/\s+@\s+/);
    items.push({ kind: "ex", label, name, reps: reps || "", load: load || "", extra: segs.slice(1).join(" · "), rest });
  }
  return { title, items };
}

const CSS = `
:host {
  --bg: #080d17; --card: #0f1624; --card-2: #141d2e; --line: rgba(148,170,200,.12);
  --text: #eef3fa; --muted: #8593a8; --accent: #4cc3ff; --violet: #a78bfa; --violet-2: #6d5ff0;
  --green: #22c55e; --amber: #f5b041; --red: #f0616d;
  display: block; height: 100%; overflow-y: auto; container-type: inline-size;
  background: radial-gradient(1200px 600px at 10% -10%, rgba(40,110,190,.18), transparent 60%),
              radial-gradient(900px 500px at 110% 110%, rgba(120,90,200,.10), transparent 60%), var(--bg);
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
  background: linear-gradient(160deg, #b3a1ff, var(--violet-2)); box-shadow: 0 10px 30px rgba(109,95,240,.35), inset 0 1px 0 rgba(255,255,255,.35); }
.brand .ic { width: 38px; height: 38px; }
.titles { flex: 1 1 0; min-width: 0; }
h1 { margin: 0; font-size: 34px; font-weight: 700; line-height: 1.1; }
.status { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 18px; white-space: nowrap; overflow: hidden; }
.status b { font-weight: 600; }
.status .detail { overflow: hidden; text-overflow: ellipsis; }
.dot { width: 12px; height: 12px; border-radius: 50%; flex: none; background: #64748b; }
.dot.green { background: var(--green); box-shadow: 0 0 10px var(--green); }
.dot.amber { background: var(--amber); box-shadow: 0 0 10px var(--amber); }
.dot.red { background: var(--red); box-shadow: 0 0 10px var(--red); }
.dot.blue { background: var(--accent); box-shadow: 0 0 10px var(--accent); animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .35; } }
.icon-btn { width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; background: var(--card-2); border: 1px solid var(--line); flex: none; }

.grid { display: grid; gap: 22px; align-items: start; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
  grid-template-areas: "session workout" "session gen" "session feedback" "session report"; grid-template-rows: auto auto auto 1fr; }
.grid.gen-first { grid-template-columns: minmax(0, 1fr) minmax(0, 1.45fr); grid-template-areas: "workout session" "gen session" "feedback session" "report session"; }
.card { background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line); border-radius: 30px; padding: 26px 28px; min-width: 0; }
.a-workout { grid-area: workout; } .a-session { grid-area: session; } .a-gen { grid-area: gen; } .a-feedback { grid-area: feedback; } .a-report { grid-area: report; }
.eyebrow { font-size: 13px; letter-spacing: .12em; font-weight: 600; color: var(--muted); text-transform: uppercase; }
h2 { margin: 6px 0 0; font-size: 26px; font-weight: 600; line-height: 1.2; }
h3 { margin: 6px 0 0; font-size: 21px; font-weight: 600; }
.sub { margin-top: 6px; font-size: 17px; color: var(--muted); }

.pills { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.pill { display: inline-flex; align-items: center; height: 32px; padding: 0 12px; border-radius: 10px; font-size: 14px; font-weight: 600; background: #1b2638; color: #c3cedd; }
.pill.stale { background: rgba(245,176,65,.14); color: var(--amber); }
.pill.fresh { background: rgba(34,197,94,.14); color: var(--green); }
.blocks { display: flex; flex-direction: column; gap: 14px; margin-top: 22px; }
.block { border-radius: 22px; background: #121a28; border: 1px solid var(--line); padding: 8px 18px; position: relative; }
.block::before { content: attr(data-badge); position: absolute; left: -1px; top: 16px; width: 34px; height: 34px; border-radius: 0 12px 12px 0; display: grid; place-items: center;
  font-weight: 700; font-size: 15px; color: #fff; background: linear-gradient(160deg, #b3a1ff, var(--violet-2)); }
.ex { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 16px; padding: 12px 0 12px 30px; align-items: center; }
.ex + .ex { border-top: 1px dashed rgba(148,170,200,.14); }
.ex-name { font-size: 19px; font-weight: 600; overflow-wrap: anywhere; }
.ex-sets { font-size: 22px; font-weight: 600; color: #c7b8ff; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ex-sets small { font-size: .68em; color: var(--muted); font-weight: 500; }
.ex-meta { font-size: 15px; color: var(--muted); }
.ex-rest { font-size: 14px; color: var(--muted); text-align: right; white-space: nowrap; }
.note { font-size: 15px; color: #c3cedd; line-height: 1.5; padding: 0 4px; overflow-wrap: anywhere; }
.note.heading { font-size: 13px; letter-spacing: .12em; font-weight: 600; color: var(--muted); text-transform: uppercase; margin-top: 4px; }
.raw { white-space: pre-wrap; font-size: 15px; line-height: 1.55; color: #c3cedd; margin-top: 18px; overflow-wrap: anywhere; }
.why { margin-top: 22px; padding: 18px 20px; border-radius: 20px; background: #111a29; border: 1px solid var(--line); }
.why p { margin: 8px 0 0; font-size: 16px; line-height: 1.55; color: #c3cedd; overflow-wrap: anywhere; }
.link { margin-top: 10px; color: var(--violet); font-weight: 600; font-size: 15px; }
.flags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.flag { font-size: 13.5px; padding: 7px 11px; border-radius: 10px; background: #1a2436; color: #b8c4d4; border: 1px solid var(--line); overflow-wrap: anywhere; }
.flag.warn { background: rgba(245,176,65,.10); color: #f7c77a; border-color: rgba(245,176,65,.25); }
.hevy { margin-top: 18px; display: flex; align-items: center; gap: 10px; color: var(--muted); font-size: 15px; }
.hevy .ic { color: var(--green); width: 20px; height: 20px; }
.empty { margin-top: 18px; color: var(--muted); font-size: 17px; }
.progress { height: 6px; border-radius: 3px; background: #1e2740; overflow: hidden; margin-top: 16px; }
.progress div { height: 100%; width: 40%; border-radius: 3px; background: linear-gradient(90deg, var(--violet-2), #b3a1ff); animation: slide 1.4s ease-in-out infinite; }
@keyframes slide { from { transform: translateX(-100%); } to { transform: translateX(260%); } }
.skel { height: 64px; border-radius: 18px; background: linear-gradient(90deg, #121a28, #18233a, #121a28); background-size: 200% 100%; animation: shimmer 1.6s infinite; }
@keyframes shimmer { to { background-position: -200% 0; } }

.seg { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 18px; }
.opt { border-radius: 20px; padding: 16px 14px; background: #121a28; border: 1.5px solid var(--line); text-align: left; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.opt:disabled { opacity: .55; }
.opt .oic { width: 44px; height: 44px; border-radius: 14px; background: #243246; display: grid; place-items: center; color: #fff; }
.opt b { font-size: 18px; font-weight: 600; }
.opt span { font-size: 14px; color: var(--muted); margin-top: -6px; }
.opt.sel { border-color: rgba(167,139,250,.6); background: #181a33; }
.opt.sel .oic { background: linear-gradient(160deg, #b3a1ff, var(--violet-2)); box-shadow: 0 8px 22px rgba(109,95,240,.35); }
.modifier { margin-top: 14px; display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 18px; background: #121a28; border: 1px solid var(--line); }
.modifier.on { background: rgba(245,176,65,.08); border-color: rgba(245,176,65,.3); }
.modifier > .ic { color: var(--amber); }
.modifier .t { flex: 1; min-width: 0; }
.modifier .t b { font-size: 17px; font-weight: 600; }
.modifier .t div { font-size: 14px; color: var(--muted); margin-top: 2px; }
.toggle { width: 60px; height: 36px; border-radius: 18px; background: #253145; position: relative; flex: none; }
.toggle::after { content: ""; position: absolute; top: 4px; left: 4px; width: 28px; height: 28px; border-radius: 50%; background: #fff; transition: transform .2s; box-shadow: 0 2px 6px rgba(0,0,0,.35); }
.toggle.on { background: linear-gradient(90deg, #e39a2a, var(--amber)); }
.toggle.on::after { transform: translateX(24px); }
.cta { margin-top: 18px; width: 100%; height: 64px; border-radius: 22px; display: flex; align-items: center; justify-content: center; gap: 12px; font-size: 20px; font-weight: 600; color: #fff;
  background: linear-gradient(180deg, #9d86ff, #5140d6); box-shadow: 0 10px 30px rgba(91,74,224,.4), inset 0 1px 0 rgba(255,255,255,.3); }
.cta:disabled { background: #1f2740; box-shadow: none; color: #c7b8ff; border: 1px solid rgba(167,139,250,.35); }
.hint { margin-top: 10px; text-align: center; font-size: 14px; color: var(--muted); }
.alert { margin-top: 14px; padding: 12px 14px; border-radius: 14px; font-size: 14.5px; line-height: 1.45; display: flex; gap: 10px; align-items: flex-start; overflow-wrap: anywhere; }
.alert .ic { width: 20px; height: 20px; margin-top: 1px; }
.alert.err { background: rgba(240,97,109,.10); border: 1px solid rgba(240,97,109,.35); color: #ffd3d7; }
.alert.warn { background: rgba(245,176,65,.08); border: 1px solid rgba(245,176,65,.3); color: #f7d49a; }
.alert.ok { background: rgba(34,197,94,.08); border: 1px solid rgba(34,197,94,.3); color: #b9f2cc; }

.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.chip { height: 38px; padding: 0 14px; border-radius: 12px; background: #172234; border: 1px solid var(--line); font-size: 15px; color: #c3cedd; }
.input { margin-top: 12px; display: flex; gap: 10px; align-items: flex-end; }
textarea { flex: 1; min-width: 0; min-height: 56px; max-height: 180px; resize: none; border-radius: 18px; background: #0c1320; border: 1px solid rgba(148,170,200,.2);
  padding: 15px 16px; font: inherit; font-size: 16px; color: var(--text); line-height: 1.4; outline: none; }
textarea:focus { border-color: rgba(167,139,250,.6); }
textarea::placeholder { color: #5d6b80; }
.send { width: 56px; height: 56px; border-radius: 18px; display: grid; place-items: center; color: #fff; flex: none; background: linear-gradient(180deg, #9d86ff, #5140d6); }
.send:disabled { background: #1f2740; color: #56607a; }
.count { font-size: 12px; color: var(--muted); text-align: right; margin-top: 6px; }

.report-row { display: flex; align-items: center; gap: 14px; margin-top: 12px; }
.report-row .t { flex: 1; min-width: 0; font-size: 15px; color: var(--muted); line-height: 1.45; }
.btn2 { height: 48px; padding: 0 18px; border-radius: 16px; background: #172234; border: 1px solid var(--line); color: var(--accent); font-weight: 600; font-size: 16px;
  display: flex; align-items: center; justify-content: center; gap: 8px; white-space: nowrap; flex: none; }
.btn2:disabled { color: #56607a; }
.btn2 .ic { width: 20px; height: 20px; }
.disclose { margin-top: 12px; font-size: 14px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
.disclose .ic { width: 18px; height: 18px; transition: transform .2s; }
.disclose.open .ic { transform: rotate(180deg); }
.wk { display: flex; align-items: center; gap: 18px; }
.wk-t { flex: 1; min-width: 0; }
.wk .sub { font-size: 15px; }
.cta.wk-btn { margin-top: 0; width: auto; flex: none; padding: 0 26px; }
.cta.wk-btn.quiet { background: #172234; border: 1px solid var(--line); box-shadow: none; color: var(--accent); }
.cta.wk-btn.quiet:disabled { color: #56607a; }
.cta.wk-btn.done { background: linear-gradient(180deg, #2fa866, #1d7a46); box-shadow: 0 10px 30px rgba(34,197,94,.3), inset 0 1px 0 rgba(255,255,255,.25); color: #fff; border: 0; }
.toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); padding: 14px 20px; border-radius: 14px; background: #3a1d24; border: 1px solid rgba(240,97,109,.5); color: #ffd3d7; z-index: 10; max-width: 90vw; }

@container (max-width: 980px) {
  .grid { grid-template-columns: minmax(0, 1fr); grid-template-rows: none; grid-template-areas: "workout" "session" "gen" "feedback" "report"; }
  .grid.gen-first { grid-template-columns: minmax(0, 1fr); grid-template-areas: "workout" "gen" "session" "feedback" "report"; }
}
@container (max-width: 640px) {
  .app { padding: 14px 14px 24px; }
  .top { gap: 12px; margin-bottom: 16px; }
  .brand, .icon-btn { width: 44px; height: 44px; border-radius: 14px; }
  .brand .ic { width: 24px; height: 24px; }
  h1 { font-size: 22px; }
  .status { font-size: 14px; margin-top: 3px; }
  .dot { width: 10px; height: 10px; }
  .grid { gap: 14px; }
  .card { border-radius: 24px; padding: 18px 16px; }
  h2 { font-size: 20px; } h3 { font-size: 18px; } .sub { font-size: 14px; }
  .blocks { gap: 10px; margin-top: 16px; }
  .block { padding: 4px 12px; border-radius: 18px; }
  .block::before { width: 26px; height: 28px; font-size: 13px; top: 12px; }
  .ex { padding: 10px 0 10px 22px; gap: 2px 10px; }
  .ex-name { font-size: 16px; } .ex-sets { font-size: 17px; } .ex-meta { font-size: 13px; } .ex-rest { font-size: 12.5px; }
  .why { padding: 14px; } .why p { font-size: 14.5px; }
  .flag { font-size: 12.5px; }
  .seg { gap: 8px; margin-top: 14px; }
  .opt { padding: 12px 10px; border-radius: 16px; gap: 8px; }
  .opt .oic { width: 36px; height: 36px; border-radius: 12px; }
  .opt .oic .ic { width: 20px; height: 20px; }
  .opt b { font-size: 15px; } .opt span { font-size: 12px; }
  .modifier { padding: 12px; } .modifier .t b { font-size: 15px; } .modifier .t div { font-size: 12.5px; }
  .cta { height: 56px; font-size: 18px; border-radius: 18px; }
  .chip { height: 36px; font-size: 13.5px; padding: 0 11px; }
  textarea { font-size: 16px; min-height: 50px; padding: 13px 14px; }
  .send { width: 50px; height: 50px; border-radius: 16px; }
  .report-row { flex-wrap: wrap; }
  .wk { flex-wrap: wrap; gap: 12px; }
  .wk .sub { font-size: 13.5px; }
  .cta.wk-btn { width: 100%; }
  .btn2 { width: 100%; }
}
`;

class CoachPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._regions = {};
    this._notes = {};
    this._expanded = false;
    this._moreReports = false;
    this._type = null;
    this._fb = null;
    this._toast = "";
    this._workout = null; // { phase: "busy" | "done", at }
    this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
  }

  set hass(hass) {
    this._hass = hass;
    this._ensureSetup();
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
    this._ensureSetup();
    this._tick = setInterval(() => this._render(), 5000);
  }

  disconnectedCallback() {
    clearInterval(this._tick);
    this._unsubNotes?.();
    this._unsubNotes = null;
    this._subscribing = false;
  }

  _ensureSetup() {
    if (!this._shell) this._buildShell();
    if (!this._hass || !this.isConnected || this._unsubNotes || this._subscribing) return;
    // Dispatch results come back as persistent notifications from the scripts; that's
    // the only signal of whether GitHub accepted a run.
    this._subscribing = true;
    this._hass.connection
      .subscribeMessage(
        (ev) => {
          const n = ev.notifications || {};
          if (ev.type === "removed") for (const id of Object.keys(n)) delete this._notes[id];
          else Object.assign(this._notes, n);
          this._scheduleRender();
        },
        { type: "persistent_notification/subscribe" },
      )
      .then((unsub) => {
        if (this._subscribing) this._unsubNotes = unsub;
        else unsub();
      })
      .catch(() => {})
      .finally(() => {
        this._subscribing = false;
      });
  }

  // The feedback textarea lives in the static shell so live re-renders never
  // replace it (that would drop focus and close the phone keyboard mid-sentence).
  _buildShell() {
    this._shell = true;
    this.shadowRoot.innerHTML = `
      <style>${CSS}</style>
      <div class="app">
        <header class="top" data-region="header"></header>
        <main class="grid">
          <section class="card a-workout" data-region="workout"></section>
          <section class="card a-gen" data-region="gen"></section>
          <section class="card a-session" data-region="session"></section>
          <section class="card a-feedback">
            <div class="eyebrow">Coach feedback</div>
            <h3>How did it go?</h3>
            <div class="sub">Likes, dislikes, how it felt — remembered for future sessions.</div>
            <div class="chips">${QUICK_FEEDBACK.map((c) => `<button class="chip" data-action="chip" data-text="${esc(c)}">${esc(c)}</button>`).join("")}</div>
            <div class="input">
              <textarea rows="1" maxlength="255" placeholder="e.g. “Face pulls felt great”"></textarea>
              <button class="send" data-action="send" aria-label="Send feedback" disabled>${svg("mdiSend")}</button>
            </div>
            <div data-region="fbstatus"></div>
          </section>
          <section class="card a-report" data-region="report"></section>
        </main>
        <div data-region="toast"></div>
      </div>`;
    for (const el of this.shadowRoot.querySelectorAll("[data-region]")) this._regions[el.dataset.region] = { el, html: null };
    this._grid = this.shadowRoot.querySelector(".grid");
    this._textarea = this.shadowRoot.querySelector("textarea");
    this._sendBtn = this.shadowRoot.querySelector(".send");
    this._textarea.addEventListener("input", () => this._onDraft());
  }

  _set(region, html) {
    const r = this._regions[region];
    if (r.html !== html) {
      r.html = html;
      r.el.innerHTML = html;
    }
  }

  _onDraft() {
    const ta = this._textarea;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight + 2, 180)}px`;
    this._sendBtn.disabled = !ta.value.trim() || this._fb?.state === "sending";
  }

  _scheduleRender() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this._render();
    });
  }

  _panelState() {
    try {
      return JSON.parse(this._hass.states[PANEL_STATE]?.state) || {};
    } catch (_) {
      return {};
    }
  }

  async _writePanelState(patch) {
    if (!this._hass.states[PANEL_STATE]) return;
    const value = JSON.stringify({ ...this._panelState(), ...patch });
    await this._hass.callService("input_text", "set_value", { entity_id: PANEL_STATE, value });
  }

  // Result of the script's dispatch for a request made at `sinceMs`: null (no answer yet),
  // or { ok, title, message }.
  _dispatchResult(notificationId, sinceMs) {
    const n = this._notes[notificationId];
    if (!n || Date.parse(n.created_at) < sinceMs - 5000) return null;
    const title = String(n.title || "");
    return { ok: !/FAILED|Nothing to submit/i.test(title), title, message: String(n.message || "").replace(/\s+/g, " ").trim() };
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
    try {
      await this._hass.callService(domain, service, data);
      return true;
    } catch (err) {
      this._showToast(`${domain}.${service} failed: ${err.message || err}`);
      return false;
    }
  }

  async _onClick(e) {
    const el = e.target.closest?.("[data-action]");
    if (!el || !this._hass || el.disabled) return;
    const m = this._model;
    switch (el.dataset.action) {
      case "menu":
        this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
        return;
      case "type":
        this._type = el.dataset.type;
        this._render();
        return;
      case "flag":
        this._call("input_boolean", m.flagOn ? "turn_off" : "turn_on", { entity_id: FLAG });
        return;
      case "generate": {
        const t = typeInfo(this._selectedType(m));
        if (m.fresh && !window.confirm(`Replace today's session in Hevy with a new ${t.label} session?`)) return;
        await this._writePanelState({ l: { t: t.id, at: Math.floor(Date.now() / 1000) } });
        this._call("script", "turn_on", { entity_id: t.script });
        this._render();
        return;
      }
      case "expand":
        this._expanded = !this._expanded;
        this._render();
        return;
      case "report": {
        const w = el.dataset.window;
        await this._writePanelState({ r: { w, at: Math.floor(Date.now() / 1000) } });
        this._call("script", "turn_on", { entity_id: REPORTS[w].script });
        this._render();
        return;
      }
      case "workout":
        this._runWorkout();
        return;
      case "more-reports":
        this._moreReports = !this._moreReports;
        this._render();
        return;
      case "chip": {
        const ta = this._textarea;
        const add = el.dataset.text;
        const cur = ta.value.trim();
        const next = cur ? `${cur.replace(/[.!]?$/, ".")} ${add}.` : `${add}.`;
        if (next.length <= 255) ta.value = next;
        this._onDraft();
        return;
      }
      case "send": {
        const text = this._textarea.value.trim();
        if (!text) return;
        this._fb = { state: "sending", at: Date.now(), text };
        this._onDraft();
        this._render();
        const ok =
          (await this._call("input_text", "set_value", { entity_id: FEEDBACK, value: text })) &&
          (await this._call("script", "turn_on", { entity_id: "script.lift_feedback_submit" }));
        if (!ok) {
          this._fb = null;
        } else {
          this._textarea.value = "";
        }
        this._onDraft();
        this._render();
        return;
      }
      default:
        return;
    }
  }

  // Calls the script itself (not script.turn_on) so a failure comes back here as a toast.
  async _runWorkout() {
    if (this._workout?.phase === "busy") return;
    navigator.vibrate?.(8);
    this._workout = { phase: "busy" };
    this._render();
    try {
      await this._hass.callService("script", WORKOUT.script.slice("script.".length));
      this._workout = { phase: "done", at: Date.now() };
    } catch (err) {
      this._workout = null;
      this._showToast(`Workout didn't start: ${err.message || err}`);
    }
    this._render();
    setTimeout(() => this._render(), WORKOUT_DONE_MS + 100);
  }

  // What the basement is doing right now, from the light and the Roku themselves.
  // Primary when today's session is ready (working out is the next step); otherwise Generate is.
  _renderWorkout(m) {
    const st = this._hass.states;
    const light = st[WORKOUT.light];
    const roku = st[WORKOUT.roku];
    const dead = (e) => !e || ["unavailable", "unknown"].includes(e.state);
    const rokuDead = dead(roku);
    let lightText = "light not responding";
    if (!dead(light)) {
      const b = Number(light.attributes?.brightness);
      lightText = light.state !== "on" ? "lights off" : b ? `lights ${Math.round((b / 255) * 100)}%` : "lights on";
    }
    let tvText;
    const app = roku?.attributes?.app_name || "";
    if (rokuDead) tvText = "Roku not responding";
    else if (["off", "standby"].includes(roku.state)) tvText = "TV off";
    else if (roku.state === "playing") tvText = `${app || "Roku"} playing`;
    else if (app && !/^(home|roku( dynamic menu)?)$/i.test(app)) tvText = `${app} open`;
    else tvText = "TV on";
    const w = this._workout;
    const busy = w?.phase === "busy";
    const done = w?.phase === "done" && Date.now() - w.at < WORKOUT_DONE_MS;
    const label = busy ? `${svg("mdiRefresh")} Starting…` : done ? `${svg("mdiCheck")} Started` : `${svg("mdiPlay")} Start workout`;
    this._set(
      "workout",
      `<div class="wk">
        <div class="wk-t"><div class="eyebrow">Basement</div><h3>Lights 80% · workout playlist</h3>
          <div class="sub">Now: ${esc(lightText)} · ${esc(tvText)}</div></div>
        <button class="cta wk-btn ${done ? "done" : m.fresh ? "" : "quiet"}" data-action="workout" ${busy || rokuDead ? "disabled" : ""}>${label}</button>
      </div>
      ${rokuDead ? `<div class="alert warn">${svg("mdiAlertOutline")}<span>Home Assistant can't reach the basement Roku, so the playlist can't start. Check that it's plugged in and on Wi-Fi.</span></div>` : ""}`,
    );
  }

  _selectedType(m) {
    return this._type || m.sessionType || "light_30m";
  }

  _fmtTime(ms) {
    const tf = this._hass?.locale?.time_format;
    const hour12 = tf === "12" ? true : tf === "24" ? false : undefined;
    return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12 });
  }

  _ago(ms) {
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return `${s} s ago`;
    const min = Math.round(s / 60);
    return min < 60 ? `${min} min ago` : `${Math.round(min / 60)} h ago`;
  }

  _readModel() {
    const st = this._hass.states;
    const a = st[SESSION]?.attributes || {};
    const today = localDate();
    const sessionDate = a.session_date || null;
    let ageDays = null;
    if (sessionDate) {
      const [y, mo, d] = sessionDate.split("-").map(Number);
      ageDays = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(y, mo - 1, d).getTime()) / 864e5);
    }
    return {
      has: !!sessionDate,
      sessionDate,
      ageDays,
      fresh: sessionDate === today,
      generatedAt: a.generated_at ? Date.parse(a.generated_at) : 0,
      sessionType: a.session_type || null,
      summary: a.summary_text || "",
      rationale: a.rationale || "",
      flags: Array.isArray(a.flags_considered) ? a.flags_considered : [],
      exerciseCount: a.exercise_count,
      routineId: a.routine_id,
      flagOn: st[FLAG]?.state === "on",
      panel: this._panelState(),
    };
  }

  _liftJob(m) {
    const req = m.panel.l;
    if (!req?.at) return null;
    const at = req.at * 1000;
    if (m.generatedAt >= at) return null;
    const age = Date.now() - at;
    const result = this._dispatchResult("lift_session_dispatch", at);
    if (result && !result.ok) return { state: "failed", at, type: req.t, result };
    if (age > 24 * 3600e3) return null;
    if (age > EXPIRE_MS) return { state: "expired", at, type: req.t };
    if (!result) return { state: age > SLOW_MS ? "slow" : age > 60e3 ? "queued" : "sending", at, type: req.t };
    return { state: age > SLOW_MS ? "slow" : "queued", at, type: req.t };
  }

  _render() {
    if (!this._hass || !this._shell) return;
    const m = this._readModel();
    this._model = m;
    const job = this._liftJob(m);
    const busy = job && ["sending", "queued", "slow"].includes(job.state);
    this._grid.classList.toggle("gen-first", !m.fresh || !!busy);

    this._renderHeader(m, job, busy);
    this._renderWorkout(m);
    this._renderGen(m, job, busy);
    this._renderSession(m, job, busy);
    this._renderFeedbackStatus();
    this._renderReport(m);
    this._set("toast", this._toast ? `<div class="toast" role="alert">${esc(this._toast)}</div>` : "");
  }

  _renderHeader(m, job, busy) {
    let s;
    if (busy) {
      const t = typeInfo(job.type).label;
      s = { dot: "blue", label: "Generating", detail: `${t} session · ${job.state === "sending" ? "sending to GitHub" : `started ${this._ago(job.at)}`}` };
    } else if (job?.state === "failed") s = { dot: "red", label: "Didn't start", detail: "GitHub rejected the request" };
    else if (m.fresh) s = { dot: "green", label: "Session ready", detail: `${typeInfo(m.sessionType).label}${m.routineId ? " · saved to Hevy" : ""}` };
    else if (m.has) s = { dot: "amber", label: "No session today", detail: m.ageDays === 1 ? "Last one was yesterday" : `Last one was ${m.ageDays} days ago` };
    else s = { dot: "", label: "No session yet", detail: "Generate your first one" };
    this._set(
      "header",
      `${this._narrow ? `<button class="icon-btn" data-action="menu" aria-label="Menu">${svg("mdiMenu")}</button>` : ""}
      <div class="brand">${svg("mdiDumbbell")}</div>
      <div class="titles"><h1>Coach</h1>
        <div class="status"><span class="dot ${s.dot}"></span><b>${esc(s.label)}</b><span class="muted">·</span><span class="muted detail">${esc(s.detail)}</span></div>
      </div>`,
    );
  }

  _renderGen(m, job, busy) {
    const sel = typeInfo(busy ? job.type : this._selectedType(m));
    const opts = TYPES.map(
      (t) => `<button class="opt ${t.id === sel.id ? "sel" : ""}" data-action="type" data-type="${t.id}" aria-pressed="${t.id === sel.id}" ${busy ? "disabled" : ""}>
        <div class="oic">${svg(t.icon)}</div><b>${t.label}</b><span>${t.desc}</span></button>`,
    ).join("");
    let hint = m.fresh ? "Replaces today's session in Hevy (“Next Lift Session”)" : "Writes to “Next Lift Session” in Hevy";
    let alert = "";
    if (job?.state === "sending") hint = "Sending to GitHub…";
    else if (job?.state === "queued") hint = `Queued ${this._ago(job.at)} · you'll get a push when it's ready`;
    else if (job?.state === "slow")
      alert = `<div class="alert warn">${svg("mdiAlertOutline")}<span>Still no session ${this._ago(job.at).replace(" ago", "")} after the request. The “Run Lift Session” workflow on GitHub may have failed.</span></div>`;
    else if (job?.state === "failed")
      alert = `<div class="alert err">${svg("mdiAlertOutline")}<span><b>${esc(job.result.title)}.</b> ${esc(job.result.message)}</span></div>`;
    else if (job?.state === "expired")
      alert = `<div class="alert warn">${svg("mdiAlertOutline")}<span>The ${esc(typeInfo(job.type).label)} request at ${this._fmtTime(job.at)} never produced a session. Check the “Run Lift Session” workflow on GitHub.</span></div>`;
    this._set(
      "gen",
      `<div class="eyebrow">${m.fresh ? "Need a different one?" : "Plan today"}</div>
      <h3>Generate a session</h3>
      <div class="seg">${opts}</div>
      <div class="modifier ${m.flagOn ? "on" : ""}">
        ${svg("mdiShieldAlertOutline")}
        <div class="t"><b>Shoulder flag</b><div>${m.flagOn ? "On · coach keeps load off the shoulder" : "Off · turn on if the shoulder is acting up"}</div></div>
        <button class="toggle ${m.flagOn ? "on" : ""}" data-action="flag" aria-pressed="${m.flagOn}" aria-label="Shoulder flag"></button>
      </div>
      <button class="cta" data-action="generate" ${busy ? "disabled" : ""}>${busy ? `${svg("mdiRefresh")} Generating…` : `${svg(sel.icon)} ${job?.state === "failed" ? "Try again" : `Generate ${sel.label}`}`}</button>
      ${alert}
      <div class="hint">${esc(hint)}</div>`,
    );
  }

  _renderSession(m, job, busy) {
    if (busy) {
      this._set(
        "session",
        `<div class="eyebrow">Coach is working</div>
        <h2>Building your ${esc(typeInfo(job.type).label)} session…</h2>
        <div class="sub">Pulling sleep, recovery and recent training from Garmin and Hevy.</div>
        <div class="progress"><div></div></div>
        <div class="blocks">${'<div class="skel"></div>'.repeat(3)}</div>`,
      );
      return;
    }
    if (!m.has) {
      this._set("session", `<div class="eyebrow">Session</div><h2>No session yet</h2><div class="empty">Pick a session type and tap Generate.</div>`);
      return;
    }
    const parsed = parseSummary(m.summary);
    const exercises = parsed.items.filter((i) => i.kind === "ex");
    let body;
    if (!exercises.length) {
      body = `<div class="raw">${esc(stripMd(m.summary))}</div>`;
    } else {
      const parts = [];
      let block = null;
      let n = 0;
      for (const it of parsed.items) {
        if (it.kind === "note") {
          block = null;
          parts.push({ note: it });
          continue;
        }
        if (block && it.label && block.label === it.label) block.items.push(it);
        else {
          block = { label: it.label, badge: it.label || String(++n), items: [it] };
          parts.push({ block });
        }
      }
      body = `<div class="blocks">${parts
        .map((p) =>
          p.note
            ? `<div class="note ${p.note.heading ? "heading" : ""}">${esc(p.note.text)}</div>`
            : `<div class="block" data-badge="${esc(p.block.badge)}">${p.block.items
                .map(
                  (e) => `<div class="ex"><div class="ex-name">${esc(e.name)}</div>
                  <div class="ex-sets">${esc(e.reps || "")}${e.load ? ` <small>@ ${esc(e.load)}</small>` : ""}</div>
                  <div class="ex-meta">${esc(e.extra || "")}</div><div class="ex-rest">${e.rest ? `rest ${esc(e.rest)}` : ""}</div></div>`,
                )
                .join("")}</div>`,
        )
        .join("")}</div>`;
    }
    const supersets = new Set(exercises.filter((e) => e.label).map((e) => e.label)).size;
    const count = m.exerciseCount ?? exercises.length;
    const dateLabel = m.fresh
      ? "Today"
      : `${new Date(`${m.sessionDate}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · ${m.ageDays === 1 ? "yesterday" : `${m.ageDays} days ago`}`;
    const sentences = m.rationale.split(/(?<=[.!?])\s+/);
    const longWhy = sentences.length > 2;
    const why = this._expanded || !longWhy ? m.rationale : sentences.slice(0, 2).join(" ");
    const flags = this._expanded ? m.flags : m.flags.slice(0, 6);
    const hiddenFlags = m.flags.length - flags.length;
    const flagText = (f) => (this._expanded ? f : f.replace(/\s+—.*$/, ""));
    this._set(
      "session",
      `<div class="eyebrow">${m.fresh ? "Today's session" : "Last session"}</div>
      <h2>${esc(parsed.title || `${typeInfo(m.sessionType).label} session`)}</h2>
      <div class="pills">
        <span class="pill ${m.fresh ? "fresh" : "stale"}">${esc(dateLabel)}</span>
        <span class="pill">${esc(typeInfo(m.sessionType).label)}</span>
        ${count ? `<span class="pill">${plural(count, "exercise")}${supersets ? ` · ${plural(supersets, "superset")}` : ""}</span>` : ""}
      </div>
      ${body}
      ${
        m.rationale || m.flags.length
          ? `<div class="why">
        <div class="eyebrow">Why this session</div>
        ${m.rationale ? `<p>${esc(why)}</p>` : ""}
        ${m.flags.length ? `<div class="flags">${flags.map((f) => `<span class="flag ${WARN_FLAG.test(f) ? "warn" : ""}">${esc(flagText(f))}</span>`).join("")}</div>` : ""}
        ${longWhy || hiddenFlags ? `<button class="link" data-action="expand">${this._expanded ? "Show less" : `Read full reasoning${hiddenFlags ? ` · ${plural(hiddenFlags, "more factor")}` : ""}`}</button>` : ""}
      </div>`
          : ""
      }
      ${m.routineId ? `<div class="hevy">${svg("mdiCheck")} Saved to Hevy as “Next Lift Session”</div>` : ""}`,
    );
  }

  _renderFeedbackStatus() {
    const fb = this._fb;
    let html = "";
    if (fb) {
      const result = this._dispatchResult("lift_feedback_dispatch", fb.at);
      if (!result) html = `<div class="hint" style="text-align:left">Sending…</div>`;
      else if (result.ok) html = `<div class="alert ok">${svg("mdiCheck")}<span>Logged — the coach will factor this into future sessions.</span></div>`;
      else {
        html = `<div class="alert err">${svg("mdiAlertOutline")}<span><b>${esc(result.title)}.</b> ${esc(result.message)}</span></div>`;
        if (!this._textarea.value) {
          this._textarea.value = fb.text;
          this._onDraft();
        }
      }
      if (result) {
        fb.state = "done";
        if (Date.now() - fb.at > 20000) this._fb = null;
      }
    }
    this._set("fbstatus", html);
    this._sendBtn.disabled = !this._textarea.value.trim() || this._fb?.state === "sending";
  }

  _renderReport(m) {
    const req = m.panel.r;
    let status = "";
    let busy = false;
    if (req?.at) {
      const at = req.at * 1000;
      const result = this._dispatchResult("coaching_report_dispatch", at);
      const age = Date.now() - at;
      if (result && !result.ok) status = `<div class="alert err">${svg("mdiAlertOutline")}<span><b>${esc(result.title)}.</b> ${esc(result.message)}</span></div>`;
      else if (age < REPORT_BUSY_MS) {
        busy = true;
        status = `<div class="alert ok">${svg("mdiCheck")}<span>${result ? `Queued ${this._ago(at)} (${esc(REPORTS[req.w]?.label || "")}) — the email should arrive in a few minutes.` : "Sending to GitHub…"}</span></div>`;
      } else {
        status = `<div class="hint" style="text-align:left">Last requested here ${new Date(at).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} at ${this._fmtTime(at)}</div>`;
      }
    }
    this._set(
      "report",
      `<div class="eyebrow">Weekly coaching report</div>
      <div class="report-row">
        <div class="t">Emails a report covering everything since the last one. Also runs automatically Mondays at 9 AM.</div>
        <button class="btn2" data-action="report" data-window="last" ${busy ? "disabled" : ""}>${svg("mdiChartLine")} Run report</button>
      </div>
      ${status}
      <button class="disclose ${this._moreReports ? "open" : ""}" data-action="more-reports">${svg("mdiChevronDown")} More options</button>
      ${
        this._moreReports
          ? `<div class="report-row"><div class="t">Force the legacy fixed window: the 7 days ending yesterday.</div>
             <button class="btn2" data-action="report" data-window="7d" ${busy ? "disabled" : ""}>${svg("mdiCalendarWeek")} Full 7-day</button></div>`
          : ""
      }`,
    );
  }
}

function loadFont() {
  if (document.getElementById("coach-panel-font") || document.getElementById("irrigation-panel-font")) return;
  const link = document.createElement("link");
  link.id = "coach-panel-font";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

if (!customElements.get("coach-panel")) customElements.define("coach-panel", CoachPanel);
