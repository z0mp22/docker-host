// The Coach panel's three cards (since 2026-11-05):
//
// - Coach: the open question with tap answers, the conversation and a message box. When the panel is
//   stacked (phone, tablet) and the thread has gone quiet, the messages fold into a one-line peek so
//   the day's plan isn't below a scroll of last night's chat.
// - Today: this morning's recovery, a rolling strip from yesterday through the next five days, the
//   selected day, and for today everything to do about it in one place: build the session in Hevy,
//   the session itself once it's there, start/end the basement workout, the shoulder and finger
//   flags, or do something else.
// - Debrief (last): Monday's headline, goals, last week, insights, and "New debrief".
//
// Kinds and goals each carry an emoji and a color everywhere they appear, so the week scans at a glance.
//
// The week comes from sensor.weekly_coach (packages/weekly_coach.yaml). Everything sent to the coach
// goes through script.coach_send; a message shows at once, then "your coach is replying" until the
// reply lands in the sensor. Each message carries a client id (cid) so a retry is never saved twice.

const SENSOR = "sensor.weekly_coach";
const NOTE = "coach_dispatch";
const REPLY_WAIT_MS = 8 * 60e3;
const THREAD_SHOWN = 2; // the last exchange; older ones behind "earlier"
const ACTIVE_MS = 3 * 3600e3; // after this long with no message the thread folds (stacked layout only)
const DAYS_BACK = 1;
const DAYS_AHEAD = 5;
const KIND = { climb: "Climb", outdoor: "Out", lift: "Lift", fingerboard: "Board", cardio: "Cardio", light: "Easy", rest: "Rest" };
const KIND_EMOJI = { climb: "🧗", outdoor: "⛰️", lift: "🏋️", fingerboard: "🖐️", cardio: "🚴", light: "🚶", rest: "😴" };
const TREND = { up: "↗ up", holding: "→ holding", slipping: "↘ slipping", no_signal: "· no signal" };
const GOAL = { climbing: "Climbing", mtb: "MTB", snowboard: "Snowboard", physique: "Physique", recovery: "Recovery" };
const GOAL_EMOJI = { climbing: "🧗", mtb: "🚵", snowboard: "🏂", physique: "💪", recovery: "😴" };
const VERDICT = { done: "✅", skipped: "❌", changed: "🔁", unknown: "❓" };
const SESSIONS = [
  { id: "heavy_1h", label: "1h Heavy", script: "script.lift_session_run_heavy" },
  { id: "light_30m", label: "30m Light", script: "script.lift_session_run_light" },
  { id: "shoulder_pt", label: "PT Day", script: "script.lift_session_run_pt" },
  { id: "fingerboard", label: "Board", script: "script.lift_session_run_fingerboard" },
];
const BASEMENT_KINDS = ["lift", "fingerboard", "cardio"];
const GOALS = [
  ["climbing", "Climbing"],
  ["mtb", "MTB"],
  ["snowboard", "Snowboard legs"],
  ["physique", "Physique"],
];
// Goals a day serves when its plan row doesn't say (mirrors debrief.day_goals).
const KIND_GOALS = { climb: ["climbing"], fingerboard: ["climbing"], lift: ["physique", "climbing"], cardio: ["mtb", "snowboard"], light: [], rest: [] };
const RIDE = /mtb|ride|bik|trail/i;
function dayGoals(r, log) {
  if (r?.goals?.length) return r.goals;
  if (r?.kind === "outdoor") return RIDE.test(`${r.title} ${r.focus}`) ? ["mtb", "snowboard"] : ["climbing"];
  if (r && KIND_GOALS[r.kind] && (r.status !== "changed" || !log)) return KIND_GOALS[r.kind];
  if (!log) return [];
  const k = new Set(log.kinds || []);
  const out = new Set();
  const climbed = /climb|boulder/i.test(log.summary || "");
  if (k.has("climb") || k.has("fingerboard") || (k.has("outdoor") && climbed)) out.add("climbing");
  if (k.has("lift")) out.add("physique").add("climbing");
  if (k.has("cardio") || (k.has("outdoor") && !climbed)) out.add("mtb").add("snowboard");
  return [...out];
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return isoDay(d);
};
const dayName = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
const weekday = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString([], { weekday: "short" });
const session = (id) => SESSIONS.find((s) => s.id === id) || SESSIONS[0];
const m_note = (d) => d.week_shape || "";
// An outdoor day is a ride or a climb, and gets the matching emoji.
const kindEmoji = (r) => (r?.kind === "outdoor" && RIDE.test(`${r.title} ${r.focus}`) ? "🚵" : KIND_EMOJI[r?.kind] || "");
const goalChip = (g) =>
  `<span class="g-${esc(g)}">${GOAL_EMOJI[g] || ""} ${esc((GOALS.find(([k]) => k === g) || [g, GOAL[g] || g])[1])}</span>`;

export const COACH_SHELL = `
  <div data-region="coachtop"></div>
  <div data-region="weekthread"></div>
  <div class="wk-compose">
    <div data-region="weekctx"></div>
    <div class="input">
      <textarea class="wk-ta" rows="1" maxlength="600" placeholder="Message your coach"></textarea>
      <button class="send wk-send" data-action="wk-send" aria-label="Send to your coach" disabled></button>
    </div>
  </div>`;

export const DEBRIEF_SHELL = `
  <div data-region="debrief"></div>
  <div class="wk-report" data-region="report"></div>`;

export const WEEK_CSS = `
.a-coach { grid-area: coach; } .a-today { grid-area: today; } .a-debrief { grid-area: debrief; }
/* Kind and goal colors: one per kind (strip, badge) and one per goal (tiles, chips, debrief). */
.k-climb { --k: #a78bfa; } .k-outdoor { --k: #fb923c; } .k-lift { --k: #f5b041; } .k-fingerboard { --k: #f472b6; }
.k-cardio { --k: #34d399; } .k-light { --k: #7dd3fc; } .k-rest { --k: #64748b; }
.g-climbing { --g: #a78bfa; } .g-mtb { --g: #34d399; } .g-snowboard { --g: #7dd3fc; } .g-physique { --g: #f5b041; } .g-recovery { --g: #94a3b8; }
.wc-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.wc-top .muted { font-size: 13px; white-space: nowrap; }
.wc-head { margin-top: 10px; font-size: 19px; line-height: 1.5; font-weight: 500; overflow-wrap: anywhere; }
.wc-q { margin-top: 16px; padding: 16px 18px; border-radius: 20px; background: #151a33; border: 1px solid rgba(167,139,250,.32); }
.wc-q b { font-size: 17px; font-weight: 600; }
.wc-q .ctx { margin-top: 4px; font-size: 14px; color: var(--muted); }
.wc-q .chips { margin-top: 12px; }
.wc-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; margin-top: 12px; }
.wc-day { border-radius: 14px; padding: 9px 2px 11px; text-align: center; background: #121a28; border: 1.5px solid var(--line); min-width: 0; position: relative; overflow: hidden; }
.wc-day::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: var(--k, transparent); opacity: .85; }
.wc-day span { display: block; font-size: 12.5px; color: var(--muted); }
.wc-day .em { display: block; font-size: 18px; line-height: 1.3; margin-top: 3px; font-style: normal; }
.wc-day b { display: block; font-size: 13px; font-weight: 600; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--k, var(--text)); }
.wc-day.skipped .em, .wc-day.none .em { opacity: .4; }
.wc-day.done { background: rgba(34,197,94,.12); border-color: rgba(34,197,94,.3); } .wc-day.done b { color: #8fe3ad; }
.wc-day.changed { background: rgba(76,195,255,.10); border-color: rgba(76,195,255,.3); } .wc-day.changed b { color: #9fdcff; }
.wc-day.skipped b, .wc-day.skipped span, .wc-day.none b { color: #5d6b80; }
.wc-day.unknown { border-color: rgba(245,176,65,.45); }
.wc-day.today { border-color: rgba(167,139,250,.8); } .wc-day.today span { color: #d9d0ff; }
.wc-day.sel { box-shadow: 0 0 0 2px rgba(167,139,250,.55); }
.wc-day .moved { position: absolute; top: 5px; right: 6px; width: 7px; height: 7px; border-radius: 50%; background: var(--violet); }
.wc-detail { margin-top: 16px; }
.wc-detail h2 { margin: 0; }
.wc-detail p { margin: 8px 0 0; font-size: 16px; line-height: 1.5; color: #c3cedd; }
.wc-detail .cooked { color: var(--muted); font-size: 14.5px; }
.wc-detail .st { margin-top: 12px; font-size: 15px; display: flex; gap: 8px; align-items: center; }
.wc-detail .st .ic { width: 18px; height: 18px; }
.st.done { color: #8fe3ad; } .st.changed { color: #9fdcff; } .st.unknown { color: #f7c77a; } .st.skipped, .st.planned { color: var(--muted); } .st.moved { color: var(--violet); }
.wc-acts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.wc-note { margin-top: 10px; font-size: 16px; line-height: 1.5; color: #c3cedd; }
.wc-bal { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
.wc-bal > div { padding: 10px 12px; border-radius: 14px; background: #121a28; border: 1px solid var(--line); border-left: 3px solid var(--g); min-width: 0; }
.wc-bal b { display: block; font-size: 13px; font-weight: 600; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wc-bal .dots { display: flex; gap: 4px; margin-top: 6px; }
.wc-bal .dots i { width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--g); }
.wc-bal .dots i.d { background: var(--g); }
.wc-bal span { display: block; margin-top: 4px; font-size: 13.5px; font-weight: 600; color: #c3cedd; }
.wc-bal .zero { border-color: rgba(245,176,65,.4); border-left-color: #f5b041; } .wc-bal .zero span { color: #f7c77a; }
.wc-ready { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 0 0 16px; padding: 10px 14px; border-radius: 14px; font-size: 14px;
  background: rgba(34,197,94,.08); border: 1px solid rgba(34,197,94,.28); color: #c3cedd; }
.wc-ready b { color: #8fe3ad; font-weight: 600; }
.wc-ready.down { background: rgba(245,176,65,.08); border-color: rgba(245,176,65,.35); } .wc-ready.down b { color: #f7c77a; }
.wc-ready.wait { background: #121a28; border-color: var(--line); } .wc-ready.wait b { color: var(--muted); }
.wc-ready .nums { display: flex; gap: 8px; flex-wrap: wrap; }
.wc-ready .nums span { padding: 2px 8px; border-radius: 8px; background: rgba(148,170,200,.08); font-variant-numeric: tabular-nums; }
.wc-ready .nums .off { color: #f7c77a; }
.kb { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; padding: 3px 10px; border-radius: 9px; font-size: 13px; font-weight: 600;
  color: var(--k); background: color-mix(in srgb, var(--k) 14%, transparent); }
.wc-replan { margin-top: 10px; }
.wc-detail .lead { font-size: 17px; color: var(--text); }
.wc-how { margin: 12px 0 0; padding: 0; list-style: none; counter-reset: h; display: flex; flex-direction: column; gap: 8px; }
.wc-how li { counter-increment: h; display: flex; gap: 10px; font-size: 15.5px; line-height: 1.45; color: #c3cedd; }
.wc-how li::before { content: counter(h); flex: none; width: 24px; height: 24px; border-radius: 8px; display: grid; place-items: center; font-size: 13px; font-weight: 700; color: #fff;
  background: linear-gradient(160deg, #b3a1ff, var(--violet-2)); }
.wc-why { margin-top: 14px; padding: 12px 14px; border-radius: 14px; background: #121a28; border: 1px solid var(--line); font-size: 15px; line-height: 1.5; color: #c3cedd; }
.wc-why b { color: var(--text); font-weight: 600; }
.wc-serves { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.wc-serves span { font-size: 12.5px; font-weight: 600; padding: 4px 10px; border-radius: 8px; color: var(--g); background: color-mix(in srgb, var(--g) 14%, transparent); }
.wc-cooked { margin-top: 10px; padding: 10px 14px; border-radius: 14px; border: 1px dashed rgba(148,170,200,.22); font-size: 14.5px; line-height: 1.45; color: var(--muted); }
.wc-cooked b { color: #c3cedd; font-weight: 600; }
.wc-sec { margin-top: 18px; padding-top: 18px; border-top: 1px dashed rgba(148,170,200,.16); }
.wc-flags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.fl { height: 36px; padding: 0 12px; border-radius: 12px; background: #172234; border: 1px solid var(--line); font-size: 14px; color: #c3cedd; display: inline-flex; align-items: center; gap: 8px; }
.fl .ic { width: 18px; height: 18px; }
.fl.on { background: rgba(245,176,65,.12); border-color: rgba(245,176,65,.4); color: #f7d49a; }
.ses { margin-top: 10px; display: flex; flex-direction: column; }
.ses-row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; font-size: 16px; }
.ses-row + .ses-row { border-top: 1px dashed rgba(148,170,200,.14); }
.ses-row span:last-child { color: #c7b8ff; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
.wc-other { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
.wc-other .btn2 { padding: 0 8px; }
.wc-goals { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.wc-goal { padding: 10px 12px; border-radius: 14px; background: #121a28; border: 1px solid var(--line); border-left: 3px solid var(--g, var(--line)); min-width: 0; }
.wc-goal b { font-size: 14px; font-weight: 600; } .wc-goal span { font-size: 13.5px; margin-left: 6px; }
.wc-goal .up { color: #8fe3ad; } .wc-goal .slipping { color: #f7c77a; } .wc-goal .holding, .wc-goal .no_signal { color: var(--muted); }
.wc-goal div { font-size: 12.5px; color: var(--muted); margin-top: 4px; line-height: 1.35; }
.wc-more { margin-top: 12px; display: flex; flex-direction: column; gap: 12px; }
.wc-more h5 { margin: 6px 0 0; font-size: 13px; letter-spacing: .12em; font-weight: 600; color: var(--muted); text-transform: uppercase; }
.wc-more p { margin: 0; font-size: 15px; line-height: 1.5; color: #c3cedd; overflow-wrap: anywhere; }
.wc-more p b { color: var(--text); font-weight: 600; }
.vd { display: inline-block; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 8px; margin-right: 6px; background: #1b2638; color: #c3cedd; text-transform: capitalize; }
.vd.done { background: rgba(34,197,94,.14); color: #8fe3ad; } .vd.skipped { background: rgba(240,97,109,.12); color: #ffb3ba; } .vd.changed { background: rgba(76,195,255,.12); color: #9fdcff; }
.wc-thread { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
.msg { max-width: 88%; padding: 11px 14px; border-radius: 18px; font-size: 15.5px; line-height: 1.45; overflow-wrap: anywhere; }
.msg.coach { align-self: flex-start; background: #172234; border: 1px solid var(--line); border-bottom-left-radius: 6px; }
.msg.athlete { align-self: flex-end; background: rgba(109,95,240,.28); border-bottom-right-radius: 6px; }
.msg .meta { display: block; margin-top: 4px; font-size: 12px; color: var(--muted); }
.msg .moved { display: block; margin-top: 6px; font-size: 12.5px; color: var(--violet); }
.typing { align-self: flex-start; font-size: 13.5px; color: var(--muted); display: flex; gap: 8px; align-items: center; padding: 4px 6px; }
.typing i { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); animation: pulse 1.2s infinite; }
.typing i:nth-child(2) { animation-delay: .2s; } .typing i:nth-child(3) { animation-delay: .4s; }
.msg-err { align-self: flex-end; font-size: 13px; color: #ffb3ba; display: flex; gap: 10px; align-items: center; }
.msg-err button { color: var(--accent); font-weight: 600; font-size: 13px; }
.wk-compose { margin-top: 12px; }
.wc-peek { display: none; width: 100%; margin-top: 12px; padding: 10px 14px; border-radius: 14px; background: #121a28; border: 1px solid var(--line); text-align: left; color: #c3cedd; font-size: 14px; }
.wc-peek .t { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wc-peek .meta { display: block; margin-top: 2px; font-size: 12px; color: var(--muted); }
.wc-dhead { margin-top: 10px; font-size: 18px; line-height: 1.5; font-weight: 500; overflow-wrap: anywhere; }
.a-debrief .wk-report { margin-top: 18px; padding-top: 14px; border-top: 1px dashed rgba(148,170,200,.16); }
.a-debrief .wk-report .eyebrow { display: none; }
.wc-ctx { display: inline-flex; align-items: center; gap: 8px; margin-top: 4px; padding: 6px 10px; border-radius: 10px; background: rgba(167,139,250,.14); color: #d9d0ff; font-size: 13.5px; max-width: 100%; }
.wc-ctx span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wc-ctx button { color: #d9d0ff; font-size: 16px; line-height: 1; }
/* Stacked (coach above today): a quiet thread folds to the peek so the plan is near the top. */
@container (max-width: 980px) {
  .wc-thread.quiet { display: none; }
  .wc-peek.quiet { display: block; }
}
@container (max-width: 640px) {
  .wc-dhead { font-size: 16.5px; }
  .wc-day .em { font-size: 16px; }
  .wc-head { font-size: 17px; }
  .wc-days { gap: 4px; }
  .wc-day { border-radius: 11px; padding: 7px 0; }
  .wc-day span { font-size: 11px; } .wc-day b { font-size: 12px; }
  .wc-other { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .wc-bal { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .wc-q { padding: 14px; }
  .msg { font-size: 15px; max-width: 92%; }
}`;

export class WeekCard {
  constructor(panel) {
    this.p = panel;
    this.sel = null;
    this.showThread = false; // the folded (quiet) thread opened by tapping the peek
    this.older = false;
    this.other = false;
    this.pending = []; // { cid, text, mode, ref, at, sent, failed }
    this.replyTo = null; // { type: "q" | "day", id, label }
    this.answered = {}; // qid -> answer text, until the sensor has it
    this.marks = {}; // date -> done | skipped, until the sensor has it
    this.ready = {}; // date -> eased | kept, until the sensor has it
  }

  bind(root) {
    this.ta = root.querySelector(".wk-ta");
    this.sendBtn = root.querySelector(".wk-send");
    this.sendBtn.innerHTML = this.p.icon("mdiSend");
    this.ta.addEventListener("input", () => this._onDraft());
  }

  _onDraft() {
    this.ta.style.height = "auto";
    this.ta.style.height = `${Math.min(this.ta.scrollHeight + 2, 180)}px`;
    this.sendBtn.disabled = !this.ta.value.trim();
  }

  // /coach?week and the end-of-workout push (/coach?feedback) land on the conversation.
  focusCompose() {
    this.p.shadowRoot.querySelector(".a-coach")?.scrollIntoView({ behavior: "smooth", block: "start" });
    this.ta?.focus({ preventScroll: true });
  }

  model() {
    const a = this.p.hass.states[SENSOR]?.attributes || {};
    const d = a.debrief || {};
    const plan = Array.isArray(a.plan) ? a.plan : [];
    return {
      has: !!d.headline,
      sent: a.generated_at ? Date.parse(a.generated_at) : 0,
      d,
      plan,
      byDate: Object.fromEntries(plan.map((r) => [r.date, r])),
      answers: a.answers || {},
      thread: Array.isArray(a.thread) ? a.thread : [],
      // What Garmin and Hevy logged each recent day, planned or not (synced every 30 min).
      logged: a.logged_days || {},
      weekNote: a.week_note || m_note(d),
      readiness: a.readiness || null,
      today: isoDay(new Date()),
    };
  }

  // Today's plan row (for the panel header), or null.
  todayRow() {
    const m = this.model();
    return m.byDate[m.today] || null;
  }

  // --- Sending ---------------------------------------------------------------

  async _send(mode, text, ref, cid) {
    cid = cid || `c${Date.now().toString(36)}`;
    const existing = this.pending.find((x) => x.cid === cid);
    if (existing) Object.assign(existing, { at: Date.now(), sent: false, failed: false });
    else this.pending.push({ cid, text, mode, ref: ref || "", at: Date.now(), sent: false });
    this.p._render();
    const ok = await this.p._call("script", "coach_send", { mode, text: text || "", ref: ref || "", cid });
    const item = this.pending.find((x) => x.cid === cid);
    if (item) Object.assign(item, { sent: ok, failed: !ok });
    this.p._render();
  }

  async _start(type) {
    const s = session(type);
    const pm = this.p._model;
    const board = type === "fingerboard";
    if ((board ? pm.board.fresh : pm.fresh) && !window.confirm(`Replace today's ${board ? "board" : "lift"} session in Hevy?`)) return;
    const now = Math.floor(Date.now() / 1000);
    await this.p._writePanelState(board ? { b: { at: now } } : { l: { t: type, at: now } });
    this.p._call("script", "turn_on", { entity_id: s.script });
    this.other = false;
    this.p._render();
  }

  async onClick(el) {
    const m = this._m;
    const act = el.dataset.action;
    if (act === "wk-day") {
      this.sel = el.dataset.date;
    } else if (act === "wk-ans") {
      const q = (m.d.questions || []).find((x) => x.id === el.dataset.q);
      const text = q?.answers?.[Number(el.dataset.i)];
      if (!text) return;
      this.answered[q.id] = text;
      this._send("answer", text, q.id);
      return;
    } else if (act === "wk-other-answer") {
      const q = (m.d.questions || []).find((x) => x.id === el.dataset.q);
      this.replyTo = { type: "q", id: q.id, label: `Answering: ${q.text}` };
      this.focusCompose();
    } else if (act === "wk-about") {
      const row = m.byDate[el.dataset.date];
      this.replyTo = { type: "day", id: el.dataset.date, label: `About ${dayName(el.dataset.date)}${row ? `: ${row.title}` : ""}` };
      this.focusCompose();
    } else if (act === "wk-ctx-clear") {
      this.replyTo = null;
    } else if (act === "wk-send") {
      const text = this.ta.value.trim();
      if (!text) return;
      const r = this.replyTo;
      if (r?.type === "q") this.answered[r.id] = text;
      this.ta.value = "";
      this.replyTo = null;
      this._onDraft();
      this._send(r?.type === "q" ? "answer" : "message", text, r?.id);
      return;
    } else if (act === "wk-retry") {
      const msg = this._messages(m).find((x) => x.cid === el.dataset.cid);
      if (msg) this._send(msg.mode, msg.text, msg.ref, msg.cid);
      return;
    } else if (act === "wk-mark") {
      this.marks[el.dataset.date] = el.dataset.value;
      this.p._call("script", "coach_send", { mode: "day", ref: el.dataset.date, value: el.dataset.value });
    } else if (act === "wk-ready") {
      this.ready[el.dataset.date] = el.dataset.value;
      this.p._call("script", "coach_send", { mode: "day", ref: el.dataset.date, value: el.dataset.value });
    } else if (act === "wk-replan") {
      if (!window.confirm("Your coach rewrites today through next week's same day, keeping what you've agreed. Go?")) return;
      this._send("replan", "Re-plan the rest of my week.");
      return;
    } else if (act === "wk-gen") {
      this._start(el.dataset.type);
      return;
    } else if (act === "wk-other") {
      this.other = !this.other;
    } else if (act === "wk-peek") {
      this.showThread = !this.showThread;
    } else if (act === "wk-older") {
      this.older = !this.older;
    }
    this.p._render();
  }

  // Thread messages plus the ones still on their way, in time order.
  _messages(m) {
    const seen = new Set(m.thread.map((x) => x.cid).filter(Boolean));
    this.pending = this.pending.filter((x) => !seen.has(x.cid));
    const fromThread = m.thread.map((x) => ({
      ...x,
      mode: x.answers ? "answer" : "message",
      ref: x.answers || x.about_day || "",
      replied: x.role === "athlete" && m.thread.some((y) => y.re === x.id),
    }));
    const local = this.pending.map((x) => ({ ...x, role: "athlete", local: true }));
    const t = (x) => (typeof x.at === "number" ? x.at : Date.parse(x.at) || 0);
    return [...fromThread, ...local].sort((a, b) => t(a) - t(b));
  }

  // --- Rendering -------------------------------------------------------------

  render(pm, job, busy) {
    const m = this.model();
    this._m = m;
    this._renderCoach(m);
    this._renderToday(m, pm, job, busy);
    this._renderDebrief(m);
  }

  _renderCoach(m) {
    const p = this.p;
    p._set("coachtop", `<div class="eyebrow">💬 Your coach</div>${m.has ? this._question(m) : ""}`);
    p._set("weekthread", this._thread(m));
    p._set(
      "weekctx",
      this.replyTo ? `<div class="wc-ctx"><span>${esc(this.replyTo.label)}</span><button data-action="wk-ctx-clear" aria-label="Clear">×</button></div>` : "",
    );
    const ph = this.replyTo?.type === "q" ? "Your answer" : this.replyTo?.type === "day" ? "What's changing?" : "Message your coach";
    if (this.ta && this.ta.placeholder !== ph) this.ta.placeholder = ph;
  }

  _renderDebrief(m) {
    if (!m.has) {
      this.p._set("debrief", `<div class="eyebrow">📋 Debrief</div><h3>No debrief yet</h3>
        <div class="sub">Your coach's debrief arrives Mondays at 9 AM. Get one now below.</div>`);
      return;
    }
    const sent = m.sent ? new Date(m.sent).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) : "";
    this.p._set(
      "debrief",
      `<div class="wc-top"><div class="eyebrow">📋 This week's debrief</div><span class="muted">${esc(sent)}</span></div>
       <div class="wc-dhead">${esc(m.d.headline)}</div>
       ${this._full(m)}`,
    );
  }

  // One question at a time, like the pushes; an answer moves into the conversation and the next one shows.
  _question(m) {
    const q = (m.d.questions || []).find((x) => !(m.answers[x.id]?.text || this.answered[x.id]));
    if (!q) return "";
    const chips = (q.answers || [])
      .map((a, i) => `<button class="chip" data-action="wk-ans" data-q="${esc(q.id)}" data-i="${i}">${esc(a)}</button>`)
      .join("");
    return `<div class="wc-q"><b>${esc(q.text)}</b><div class="ctx">${esc(q.context)}</div>
      <div class="chips">${chips}<button class="chip" data-action="wk-other-answer" data-q="${esc(q.id)}">Something else…</button></div></div>`;
  }

  _thread(m) {
    const p = this.p;
    const all = this._messages(m);
    if (!all.length) return "";
    const t = (x) => (typeof x.at === "number" ? x.at : Date.parse(x.at) || 0);
    const last = all[all.length - 1];
    // Quiet: nothing on its way and no message for ACTIVE_MS. A reply in flight, a draft about a day or
    // question, or a fresh check-in keeps it open.
    const quiet = !this.showThread && !this.replyTo && !all.some((x) => x.local) && last.role === "coach" && Date.now() - t(last) > ACTIVE_MS;
    const peek = `<button class="wc-peek ${quiet ? "quiet" : ""}" data-action="wk-peek">
      <span class="t">${last.role === "coach" ? "Coach" : "You"}: ${esc(last.text)}</span>
      <span class="meta">▾ ${all.length} message${all.length === 1 ? "" : "s"} · last ${esc(p._fmtTime(t(last)))} ${esc(weekday(isoDay(new Date(t(last)))))}</span></button>`;
    const shown = this.older ? all : all.slice(-THREAD_SHOWN);
    const parts = [];
    if (all.length > shown.length) parts.push(`<button class="disclose" data-action="wk-older">${p.icon("mdiChevronDown")} ${all.length - shown.length} earlier</button>`);
    const qText = (id) => (m.d.questions || []).find((q) => q.id === id)?.text;
    for (const x of shown) {
      const at = typeof x.at === "number" ? x.at : Date.parse(x.at);
      const meta =
        x.mode === "answer" ? `Answer · ${esc(qText(x.ref) || "")}` : x.checkin ? `⌚ Saw it in Garmin · ${esc(p._fmtTime(at))}` : at ? esc(p._fmtTime(at)) : "";
      parts.push(
        `<div class="msg ${x.role}">${esc(x.text)}${
          x.role === "coach" && x.plan_changes?.length ? `<span class="moved">📅 Plan updated: ${esc(x.plan_changes.join(", "))}</span>` : ""
        }<span class="meta">${meta}</span></div>`,
      );
      if (x.role !== "athlete" || x.replied) continue;
      const failed = x.reply_failed || x.failed || (x.local && this._dispatchFailed(x.at));
      if (failed) {
        parts.push(`<div class="msg-err">${x.local ? "Didn't send." : "Your coach couldn't reply."}<button data-action="wk-retry" data-cid="${esc(x.cid || "")}">Retry</button></div>`);
      } else if (Date.now() - at < REPLY_WAIT_MS) {
        parts.push(`<div class="typing"><i></i><i></i><i></i>${x.local && !x.sent ? "Sending…" : "Your coach is replying…"}</div>`);
      } else if (x.cid) {
        parts.push(`<div class="msg-err">No reply yet.<button data-action="wk-retry" data-cid="${esc(x.cid)}">Retry</button></div>`);
      }
    }
    if (this.showThread) parts.push(`<button class="disclose" data-action="wk-peek">${p.icon("mdiChevronDown")} Fold the conversation</button>`);
    return `${peek}<div class="wc-thread ${quiet ? "quiet" : ""}">${parts.join("")}</div>`;
  }

  _dispatchFailed(at) {
    const r = this.p._dispatchResult(NOTE, at);
    return r && !r.ok;
  }

  _full(m) {
    const d = m.d;
    const goals = (d.goals || [])
      .map(
        (g) => `<div class="wc-goal g-${esc(g.goal)}"><b>${GOAL_EMOJI[g.goal] || ""} ${esc(GOAL[g.goal] || g.goal)}</b><span class="${esc(g.trend)}">${esc(
          TREND[g.trend] || g.trend,
        )}</span><div>${esc(g.evidence)}</div></div>`,
      )
      .join("");
    const last = (d.last_week || [])
      .map((x) => `<p><span class="vd ${esc(x.verdict)}">${VERDICT[x.verdict] || ""} ${esc(x.verdict)}</span><b>${esc(x.item)}.</b> ${esc(x.note)}</p>`)
      .join("");
    const ins = (d.insights || []).map((x) => `<p>🔎 <b>${esc(x.title)}</b> ${esc(x.body)}</p>`).join("");
    return `<div class="wc-more">
      <h5>🎯 Goals</h5><div class="wc-goals">${goals}</div>
      ${last ? `<h5>🗒️ Last week's plan</h5>${last}` : ""}
      <h5>📈 What the week showed</h5>${ins}
      <p class="muted">📊 ${esc(d.baselines)}</p>
      <p class="muted">🙅 ${esc(d.leaves_out)}</p></div>`;
  }

  // --- Today ---------------------------------------------------------------------

  _renderToday(m, pm, job, busy) {
    const days = [];
    for (let i = -DAYS_BACK; i <= DAYS_AHEAD; i++) days.push(addDays(m.today, i));
    if (!days.includes(this.sel)) this.sel = m.today;
    const status = (r) => this.marks[r.date] || r.status;
    // Past days show how they went; today only once something is logged.
    const shown = (r) => (r.date < m.today || ["done", "changed"].includes(status(r)) ? status(r) : "planned");
    const pills = days
      .map((date) => {
        const r = m.byDate[date];
        const log = m.logged[date];
        const st = r ? shown(r) : log ? "changed" : "none";
        const kind = r?.kind || (log ? (log.kinds || [])[0] : null);
        const cls = [st, kind ? `k-${kind}` : "", date === m.today ? "today" : "", date === this.sel ? "sel" : ""].join(" ");
        const em = r ? kindEmoji(r) : log ? KIND_EMOJI[kind] || "✔️" : "";
        return `<button class="wc-day ${cls}" data-action="wk-day" data-date="${date}" aria-label="${esc(`${dayName(date)}: ${r ? r.title : "nothing planned"}`)}">
          ${r?.changed_at && date >= m.today ? '<i class="moved" aria-hidden="true"></i>' : ""}
          <span>${date === m.today ? "Today" : esc(weekday(date))}</span><i class="em" aria-hidden="true">${em || "·"}</i><b>${
            r ? esc(KIND[r.kind] || r.kind) : log ? esc(log.short) : "—"
          }</b></button>`;
      })
      .join("");
    const isToday = this.sel === m.today;
    this.p._set(
      "today",
      `${this._readiness(m)}
       <div class="eyebrow">🗓️ Your week</div>
       ${m.weekNote ? `<div class="wc-note">${esc(m.weekNote)}</div>` : ""}
       ${this._balance(m, days)}
       <div class="wc-days">${pills}</div>
       <div class="eyebrow" style="margin-top:22px">${isToday ? `Today · ${esc(dayName(m.today))}` : esc(dayName(this.sel))}</div>
       ${this._detail(m, m.byDate[this.sel], status)}
       ${isToday ? this._todayActions(m, m.byDate[m.today], pm, job, busy) : ""}`,
    );
  }

  // This morning's HRV + resting HR against his own normal. When both are off and today is a hard day,
  // he decides: keep the session or take its easy version (same choice as the morning push).
  // Before Garmin has last night's numbers (the sync looks every 15 min from 5 AM) it says it's waiting,
  // so a plan that hasn't moved reads as "checked, still on" rather than "never looked".
  _readiness(m) {
    const r = m.readiness;
    if (!r || r.date !== m.today) {
      if (!m.byDate[m.today]) return "";
      return `<div class="wc-ready wait"><b>⏳ Waiting on last night's HRV</b><span>Syncs from Garmin every 15 min from 5 AM; today's plan stands until it's in.</span></div>`;
    }
    const n = (x) => (x == null ? "?" : Math.round(x));
    // Amber past readiness.py's HRV_DOWN / RHR_UP, the single-day "off" lines.
    const hrvOff = (r.hrv_down_pct || 0) >= 12;
    const rhrOff = (r.rhr_up || 0) >= 3;
    const nums = `<span class="nums"><span class="${hrvOff ? "off" : ""}">HRV ${n(r.hrv)} vs ${n(r.base_hrv)}</span><span class="${rhrOff ? "off" : ""}">RHR ${n(r.rhr)} vs ${n(r.base_rhr)}</span></span>`;
    const plain = `HRV ${n(r.hrv)} (your normal ${n(r.base_hrv)}) · resting HR ${n(r.rhr)} (${n(r.base_rhr)})`;
    const decision = this.ready[r.date] || r.decision;
    if (r.ask && !decision) {
      return `<div class="alert warn" style="margin:0 0 18px"><span><b>🟠 Recovery's down today.</b> ${esc(plain)}${r.yesterday_off ? ", two days running" : ""}.
        ${r.session ? `I'd do the easy version of ${esc(r.session)}: ${esc(r.suggestion || "keep it short and easy")}.` : ""}
        <span class="wc-acts" style="display:flex">
          <button class="btn2" data-action="wk-ready" data-date="${esc(r.date)}" data-value="kept">💪 Keep it</button>
          <button class="btn2" data-action="wk-ready" data-date="${esc(r.date)}" data-value="eased">🪶 Ease it</button></span></span></div>`;
    }
    const [cls, line] =
      decision === "eased" ? ["down", "🪶 Eased this morning"]
      : decision === "kept" ? ["", "💪 You kept today's session"]
      : r.verdict === "ease" ? ["down", "🟠 Recovery's down"]
      : ["", "🟢 Recovery on track · plan stands"];
    return `<div class="wc-ready ${cls}" title="${esc(plain)}"><b>${line}</b>${nums}</div>`;
  }

  // Sessions per goal across the strip's days: done (logged) and still planned. A goal with nothing
  // this week shows in amber, so an all-easy week can't hide.
  _balance(m, days) {
    const count = Object.fromEntries(GOALS.map(([g]) => [g, { done: 0, planned: 0 }]));
    for (const date of days) {
      const r = m.byDate[date];
      const log = m.logged[date];
      const st = this.marks[date] || r?.status || (log ? "done" : null);
      if (["skipped", "unknown"].includes(st) || (date < m.today && !log && st !== "done")) continue;
      const bucket = st === "done" || st === "changed" || (log && !r) ? "done" : "planned";
      for (const g of dayGoals(r, log)) count[g][bucket] += 1;
    }
    const tiles = GOALS.map(([g, label]) => {
      const c = count[g];
      const total = c.done + c.planned;
      const txt = !total ? "Nothing this week" : [c.done ? `${c.done} done` : "", c.planned ? `${c.planned} planned` : ""].filter(Boolean).join(" · ");
      const dots = "<i class=\"d\"></i>".repeat(c.done) + "<i></i>".repeat(c.planned);
      return `<div class="g-${g} ${total ? "" : "zero"}"><b>${GOAL_EMOJI[g]} ${esc(label)}</b>${total ? `<div class="dots" aria-hidden="true">${dots}</div>` : ""}<span>${esc(txt)}</span></div>`;
    }).join("");
    return `<div class="wc-bal">${tiles}</div>
      <div class="wc-replan"><button class="disclose" data-action="wk-replan" style="margin-top:0">${this.p.icon("mdiRefresh")} Re-plan my week</button></div>`;
  }

  _detail(m, r, status) {
    const p = this.p;
    const date = this.sel;
    const past = date < m.today;
    const log = m.logged[date];
    if (!r && log) {
      return `<div class="wc-detail"><h2>Not on the plan</h2>
        <div class="st changed">Logged · ${esc(log.summary)}</div></div>`;
    }
    if (!r) {
      const [title, sub] = past
        ? ["Nothing was planned", "This day was before the current plan."]
        : date === m.today
          ? ["Nothing planned today", "Ask your coach, or pick a session under “Do something else today”."]
          : ["Not planned yet", "Ask your coach to plan it, or Monday's debrief will."];
      return `<div class="wc-detail"><h2>${title}</h2><p class="cooked">${sub}</p>
        ${past ? "" : `<div class="wc-acts"><button class="btn2" data-action="wk-about" data-date="${date}">${date === m.today ? "Ask your coach" : "Plan this day"}</button></div>`}</div>`;
    }
    let st = "";
    let acts = "";
    if (past) {
      const s = status(r);
      const txt = {
        done: `✅ Done${r.logged ? ` · ${r.logged}` : ""}`,
        changed: `🔁 Changed · ${r.logged || r.status_note || "you did something else"}`,
        skipped: "⏭️ Skipped",
        unknown: "❓ Nothing in Garmin or Hevy",
        planned: "⏳ Not checked yet",
      }[s] || s;
      st = `<div class="st ${esc(s)}">${esc(txt)}</div>`;
      if (s === "unknown" || s === "planned") {
        acts = `<button class="btn2" data-action="wk-mark" data-date="${date}" data-value="done">${p.icon("mdiCheck")} Done</button>
          <button class="btn2" data-action="wk-mark" data-date="${date}" data-value="skipped">Skipped</button>
          <button class="btn2" data-action="wk-about" data-date="${date}">Did something else</button>`;
      }
    } else {
      const s = status(r);
      if (date === m.today && ["done", "changed"].includes(s)) {
        st = `<div class="st ${esc(s)}">${esc(`${s === "done" ? "✅ Done" : "🔁 Changed"}${r.logged ? ` · ${r.logged}` : ""}`)}</div>`;
      } else if (r.changed_at) st = `<div class="st moved">📅 Moved here by your coach</div>`;
      // Today's change lives under "Do something else today".
      if (date !== m.today) acts = `<button class="btn2" data-action="wk-about" data-date="${date}">Change this day</button>`;
    }
    const how = (r.how || []).length ? `<ol class="wc-how">${r.how.map((x) => `<li><span>${esc(x)}</span></li>`).join("")}</ol>` : "";
    const goals = dayGoals(r, m.logged[date]);
    const serves = goals.length ? `<div class="wc-serves">${goals.map(goalChip).join("")}</div>` : "";
    return `<div class="wc-detail k-${esc(r.kind)}"><span class="kb">${kindEmoji(r)} ${esc(KIND[r.kind] || r.kind)}</span>
      <h2>${esc(r.title)}</h2><p class="lead">${esc(r.focus)}</p>
      ${serves}
      ${how}
      ${r.why ? `<div class="wc-why"><b>💡 Why today.</b> ${esc(r.why)}</div>` : ""}
      ${r.if_cooked ? `<div class="wc-cooked"><b>🪫 If you're cooked:</b> ${esc(r.if_cooked)}</div>` : ""}${st}
      ${acts ? `<div class="wc-acts">${acts}</div>` : ""}</div>`;
  }

  // Everything to do about today: the session (build it, or see it once it's in Hevy), the basement,
  // the flags, and doing something else.
  _todayActions(m, r, pm, job, busy) {
    const p = this.p;
    const kind = r?.kind;
    const bjob = p._boardJob(pm);
    const bbusy = bjob && ["sending", "queued", "slow"].includes(bjob.state);
    const parts = [];

    if (busy || bbusy) {
      const label = busy ? session(job.type).label : "board";
      parts.push(`<div class="wc-sec"><div class="eyebrow">Building your ${esc(label)} session</div>
        <div class="sub">Pulling sleep, recovery and recent training from Garmin and Hevy. You'll get a push.</div>
        <div class="progress"><div></div></div></div>`);
    }
    if (pm.fresh && !busy) parts.push(`<div class="wc-sec">${p.sessionHtml(pm)}</div>`);
    if (pm.board.fresh && !bbusy) parts.push(`<div class="wc-sec"><div class="eyebrow">Board session · in Hevy</div>${p._boardBlocks(pm.board.blocks)}</div>`);

    const wantsLift = kind === "lift" && !pm.fresh && !busy;
    const wantsBoard = kind === "fingerboard" && !pm.board.fresh && !bbusy;
    const flags = `<div class="wc-flags">
      <button class="fl ${pm.flagOn ? "on" : ""}" data-action="flag" aria-pressed="${pm.flagOn}">${p.icon("mdiShieldAlertOutline")} Shoulder flag ${pm.flagOn ? "on" : "off"}</button>
      <button class="fl ${pm.fingerFlagOn ? "on" : ""}" data-action="finger-flag" aria-pressed="${pm.fingerFlagOn}">${p.icon("mdiAlertOutline")} Finger flag ${pm.fingerFlagOn ? "on" : "off"}</button></div>`;
    if (wantsLift || wantsBoard) {
      const s = session(wantsBoard ? "fingerboard" : r.lift_type || "heavy_1h");
      const blocked = wantsBoard && pm.fingerFlagOn;
      parts.push(`<div class="wc-sec">
        <button class="cta" data-action="wk-gen" data-type="${s.id}" ${blocked ? "disabled" : ""}>${p.icon(wantsBoard ? "mdiHandBackRightOutline" : "mdiWeightLifter")} Build ${esc(s.label)} in Hevy</button>
        <div class="hint">${blocked ? "Finger flag is on: no board work today" : "Your lift coach picks the exercises from today's recovery and your goals"}</div>
        ${this._jobAlert(wantsBoard ? bjob : job)}${flags}</div>`);
    }

    if (BASEMENT_KINDS.includes(kind) || pm.fresh || pm.board.fresh) parts.push(`<div class="wc-sec">${p.workoutHtml(pm)}</div>`);

    const others = SESSIONS.map(
      (s) => `<button class="btn2" data-action="wk-gen" data-type="${s.id}" ${(s.id === "fingerboard" && pm.fingerFlagOn) || busy || bbusy ? "disabled" : ""}>${esc(s.label)}</button>`,
    ).join("");
    parts.push(`<div class="wc-sec" style="padding-top:12px">
      <button class="disclose ${this.other ? "open" : ""}" data-action="wk-other" style="margin-top:0">${p.icon("mdiChevronDown")} Do something else today</button>
      ${
        this.other
          ? `<div class="wc-other">${others}</div>${wantsLift || wantsBoard ? "" : flags}
             <div class="wc-acts"><button class="btn2" data-action="wk-about" data-date="${m.today}">Tell your coach what changed</button></div>`
          : ""
      }</div>`);
    return parts.join("");
  }

  _jobAlert(j) {
    const p = this.p;
    if (!j) return "";
    if (j.state === "failed") return `<div class="alert err">${p.icon("mdiAlertOutline")}<span><b>${esc(j.result.title)}.</b> ${esc(j.result.message)}</span></div>`;
    if (j.state === "slow" || j.state === "expired")
      return `<div class="alert warn">${p.icon("mdiAlertOutline")}<span>The request at ${esc(p._fmtTime(j.at))} hasn't produced a session. Check the “Run Lift Session” workflow on GitHub.</span></div>`;
    return "";
  }
}
