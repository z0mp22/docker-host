// The weekly coach card on the Coach panel (packages/weekly_coach.yaml, sensor.weekly_coach):
// Monday's headline, the coach's questions with tap answers, the week as a strip of days,
// goals, the full debrief behind a toggle, and the conversation with a message box.
//
// Everything sent goes through script.coach_send (-> Coach workflow -> run-coach.sh). A message
// shows at once as "sending", then "coach is replying" until the reply lands in the sensor
// (usually under a minute). Each message carries a client id (cid) so a retry is never saved twice.

const SENSOR = "sensor.weekly_coach";
const NOTE = "coach_dispatch";
const REPLY_WAIT_MS = 8 * 60e3;
const THREAD_SHOWN = 6;
const KIND = { climb: "Climb", outdoor: "Out", lift: "Lift", fingerboard: "Board", cardio: "Cardio", light: "Easy", rest: "Rest" };
const TREND = { up: "up", holding: "holding", slipping: "slipping", no_signal: "no signal" };
const GOAL = { climbing: "Climbing", mtb: "MTB", snowboard: "Snowboard", physique: "Physique", recovery: "Recovery" };
const LIFT_SCRIPTS = { heavy_1h: "script.lift_session_run_heavy", light_30m: "script.lift_session_run_light", shoulder_pt: "script.lift_session_run_pt" };
const BOARD_SCRIPT = "script.lift_session_run_fingerboard";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayName = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

// Desktop: the week on the left, the conversation and message box on the right. Phone: one column.
export const WEEK_SHELL = `
  <div class="wk-main" data-region="week"></div>
  <div class="wk-side">
    <div data-region="weekthread"></div>
    <div class="wk-compose">
      <div data-region="weekctx"></div>
      <div class="input">
        <textarea class="wk-ta" rows="1" maxlength="600" placeholder="Message your coach"></textarea>
        <button class="send wk-send" data-action="wk-send" aria-label="Send to your coach" disabled></button>
      </div>
    </div>
  </div>
  <div class="wk-report" data-region="report"></div>`;

export const WEEK_CSS = `
.a-week { grid-area: week; display: grid; column-gap: 32px; align-items: start;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); grid-template-areas: "main side" "report side"; }
.wk-main { grid-area: main; min-width: 0; } .wk-side { grid-area: side; min-width: 0; } .wk-report { grid-area: report; min-width: 0; }
.wk-side > [data-region="weekthread"] > .wc-lbl:first-child { margin-top: 0; }
.wc-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.wc-top .open { font-size: 14px; color: var(--violet); font-weight: 600; white-space: nowrap; }
.wc-head { margin-top: 10px; font-size: 21px; line-height: 1.45; font-weight: 500; overflow-wrap: anywhere; }
.wc-q { margin-top: 16px; padding: 16px 18px; border-radius: 20px; background: #151a33; border: 1px solid rgba(167,139,250,.32); }
.wc-q b { font-size: 17px; font-weight: 600; }
.wc-q .ctx { margin-top: 4px; font-size: 14px; color: var(--muted); }
.wc-q .chips { margin-top: 12px; }
.wc-q .chip.on { background: rgba(167,139,250,.22); color: #e4dcff; border-color: rgba(167,139,250,.6); }
.wc-lbl { margin-top: 22px; font-size: 13px; letter-spacing: .12em; font-weight: 600; color: var(--muted); text-transform: uppercase; }
.wc-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
.wc-day { border-radius: 14px; padding: 9px 2px; text-align: center; background: #121a28; border: 1.5px solid var(--line); min-width: 0; position: relative; }
.wc-day span { display: block; font-size: 12.5px; color: var(--muted); }
.wc-day b { display: block; font-size: 14px; font-weight: 600; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wc-day.done { background: rgba(34,197,94,.12); border-color: rgba(34,197,94,.3); }
.wc-day.done b { color: #8fe3ad; }
.wc-day.changed { background: rgba(76,195,255,.10); border-color: rgba(76,195,255,.3); }
.wc-day.changed b { color: #9fdcff; }
.wc-day.skipped b, .wc-day.skipped span { color: #5d6b80; }
.wc-day.unknown { border-color: rgba(245,176,65,.45); }
.wc-day.today { border-color: rgba(167,139,250,.8); }
.wc-day.sel { box-shadow: 0 0 0 2px rgba(167,139,250,.55); }
.wc-day .moved { position: absolute; top: 5px; right: 6px; width: 7px; height: 7px; border-radius: 50%; background: var(--violet); }
.wc-detail { margin-top: 10px; padding: 16px 18px; border-radius: 20px; background: #121a28; border: 1px solid var(--line); }
.wc-detail h4 { margin: 0; font-size: 18px; font-weight: 600; }
.wc-detail .when { font-size: 13px; color: var(--muted); margin-bottom: 4px; }
.wc-detail p { margin: 8px 0 0; font-size: 15.5px; line-height: 1.5; color: #c3cedd; }
.wc-detail .cooked { color: var(--muted); font-size: 14.5px; }
.wc-detail .st { margin-top: 10px; font-size: 14.5px; display: flex; gap: 8px; align-items: center; }
.wc-detail .st.done { color: #8fe3ad; } .wc-detail .st.changed { color: #9fdcff; } .wc-detail .st.unknown { color: #f7c77a; } .wc-detail .st.skipped { color: var(--muted); }
.wc-acts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.wc-goals { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
.wc-goal { padding: 10px 12px; border-radius: 14px; background: #121a28; border: 1px solid var(--line); min-width: 0; }
.wc-goal b { display: block; font-size: 14px; font-weight: 600; }
.wc-goal span { font-size: 13.5px; }
.wc-goal .up { color: #8fe3ad; } .wc-goal .slipping { color: #f7c77a; } .wc-goal .holding, .wc-goal .no_signal { color: var(--muted); }
.wc-goal div { font-size: 12.5px; color: var(--muted); margin-top: 4px; line-height: 1.35; }
.wc-more { margin-top: 12px; display: flex; flex-direction: column; gap: 12px; }
.wc-more h5 { margin: 6px 0 0; font-size: 13px; letter-spacing: .12em; font-weight: 600; color: var(--muted); text-transform: uppercase; }
.wc-more p { margin: 0; font-size: 15px; line-height: 1.5; color: #c3cedd; overflow-wrap: anywhere; }
.wc-more p b { color: var(--text); font-weight: 600; }
.vd { display: inline-block; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 8px; margin-right: 6px; background: #1b2638; color: #c3cedd; text-transform: capitalize; }
.vd.done { background: rgba(34,197,94,.14); color: #8fe3ad; } .vd.skipped { background: rgba(240,97,109,.12); color: #ffb3ba; } .vd.changed { background: rgba(76,195,255,.12); color: #9fdcff; }
.wc-thread { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.msg { max-width: 86%; padding: 11px 14px; border-radius: 18px; font-size: 15.5px; line-height: 1.45; overflow-wrap: anywhere; }
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
.wc-ctx { display: inline-flex; align-items: center; gap: 8px; margin-top: 4px; padding: 6px 10px; border-radius: 10px; background: rgba(167,139,250,.14); color: #d9d0ff; font-size: 13.5px; max-width: 100%; }
.wc-ctx span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wc-ctx button { color: #d9d0ff; font-size: 16px; line-height: 1; }
.a-week .wk-report { margin-top: 14px; padding-top: 14px; border-top: 1px dashed rgba(148,170,200,.16); }
@container (max-width: 980px) {
  .a-week { grid-template-columns: minmax(0, 1fr); grid-template-areas: "main" "side" "report"; }
  .wk-side > [data-region="weekthread"] > .wc-lbl:first-child { margin-top: 22px; }
}
.a-week [data-region="report"] .eyebrow { display: none; }
@container (max-width: 640px) {
  .wc-head { font-size: 17px; line-height: 1.5; }
  .wc-days { gap: 4px; }
  .wc-day { border-radius: 11px; padding: 7px 0; }
  .wc-day span { font-size: 11px; } .wc-day b { font-size: 12px; }
  .wc-goals { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .wc-q { padding: 14px; }
  .msg { font-size: 15px; max-width: 92%; }
}`;

export class WeekCard {
  constructor(panel) {
    this.p = panel;
    this.sel = null;
    this.more = false;
    this.older = false;
    this.pending = []; // { cid, text, mode, ref, at, sent }
    this.replyTo = null; // { type: "q" | "day", id, label }
    this.answered = {}; // qid -> answer text, until the sensor has it
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

  focus() {
    this.p.shadowRoot.querySelector(".a-week")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  model() {
    const a = this.p.hass.states[SENSOR]?.attributes || {};
    const plan = Array.isArray(a.plan) ? a.plan : [];
    const d = a.debrief || {};
    return {
      has: !!d.headline,
      label: a.week_label || "This week",
      sent: a.generated_at ? Date.parse(a.generated_at) : 0,
      d,
      plan,
      answers: a.answers || {},
      thread: Array.isArray(a.thread) ? a.thread : [],
      today: localDate(),
    };
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
    if (item) item.sent = ok;
    if (!ok && item) item.failed = true;
    this.p._render();
  }

  _dispatchFailed(at) {
    const r = this.p._dispatchResult(NOTE, at);
    return r && !r.ok ? r : null;
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
    } else if (act === "wk-other") {
      const q = (m.d.questions || []).find((x) => x.id === el.dataset.q);
      this.replyTo = { type: "q", id: q.id, label: `Answering: ${q.text}` };
      this.ta.focus();
    } else if (act === "wk-about") {
      const row = m.plan.find((r) => r.date === el.dataset.date);
      this.replyTo = { type: "day", id: row.date, label: `About ${dayName(row.date)}: ${row.title}` };
      this.ta.focus();
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
      const msg = this._allMessages(m).find((x) => x.cid === el.dataset.cid);
      if (msg) this._send(msg.mode, msg.text, msg.ref, msg.cid);
      return;
    } else if (act === "wk-mark") {
      this.marks = { ...(this.marks || {}), [el.dataset.date]: el.dataset.value };
      this.p._call("script", "coach_send", { mode: "day", ref: el.dataset.date, value: el.dataset.value });
    } else if (act === "wk-build") {
      this._build(m.plan.find((r) => r.date === el.dataset.date));
      return;
    } else if (act === "wk-more") {
      this.more = !this.more;
    } else if (act === "wk-older") {
      this.older = !this.older;
    }
    this.p._render();
  }

  // A lift or board day starts the lift coach with the session type the week asks for.
  async _build(row) {
    if (!row) return;
    const pm = this.p._model;
    if (row.kind === "fingerboard") {
      await this.p._writePanelState({ b: { at: Math.floor(Date.now() / 1000) } });
      this.p._call("script", "turn_on", { entity_id: BOARD_SCRIPT });
    } else {
      const t = row.lift_type || "heavy_1h";
      if (pm?.fresh && !window.confirm("Replace today's session in Hevy with this one?")) return;
      await this.p._writePanelState({ l: { t, at: Math.floor(Date.now() / 1000) } });
      this.p._call("script", "turn_on", { entity_id: LIFT_SCRIPTS[t] });
    }
    this.p._render();
    this.p.shadowRoot.querySelector(row.kind === "fingerboard" ? ".a-board" : ".a-session")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Thread messages plus the ones still on their way, oldest first.
  _allMessages(m) {
    const seen = new Set(m.thread.map((x) => x.cid).filter(Boolean));
    this.pending = this.pending.filter((x) => !seen.has(x.cid) || Date.now() - x.at < 1000);
    const fromThread = m.thread.map((x) => ({
      ...x,
      mode: x.answers ? "answer" : "message",
      ref: x.answers || x.about_day || "",
      replied: x.role === "athlete" && m.thread.some((y) => y.re === x.id),
    }));
    const local = this.pending
      .filter((x) => !seen.has(x.cid))
      .map((x) => ({ ...x, role: "athlete", local: true }));
    const t = (x) => (typeof x.at === "number" ? x.at : Date.parse(x.at) || 0);
    return [...fromThread, ...local].sort((a, b) => t(a) - t(b));
  }

  // --- Rendering -------------------------------------------------------------

  render() {
    const m = this.model();
    this._m = m;
    const p = this.p;
    if (!m.has) {
      p._set(
        "week",
        `<div class="eyebrow">Your coach</div><h3>No debrief yet</h3>
         <div class="sub">Your coach's debrief arrives Mondays at 9 AM. Run it below to get one now.</div>`,
      );
      p._set("weekctx", "");
      p._set("weekthread", "");
      return;
    }
    const days = this._days(m);
    p._set(
      "week",
      `<div class="wc-top"><div class="eyebrow">${esc(m.label)}</div>
         ${m.sent ? `<span class="muted" style="font-size:13px;white-space:nowrap">From your coach · ${esc(new Date(m.sent).toLocaleDateString([], { weekday: "short" }))}</span>` : ""}</div>
       <div class="wc-head">${esc(m.d.headline)}</div>
       ${this._questions(m)}
       <div class="wc-lbl">This week</div>
       ${days}
       <div class="wc-lbl">Goals</div>
       ${this._goals(m)}
       <button class="disclose ${this.more ? "open" : ""}" data-action="wk-more">${p.icon("mdiChevronDown")} ${this.more ? "Hide" : "Read"} the full debrief</button>
       ${this.more ? this._full(m) : ""}`,
    );
    p._set("weekthread", this._thread(m) || `<div class="wc-lbl">Your coach</div><div class="sub" style="font-size:15px">Ask anything about the week, or tell your coach what changed.</div>`);
    p._set(
      "weekctx",
      this.replyTo
        ? `<div class="wc-ctx"><span>${esc(this.replyTo.label)}</span><button data-action="wk-ctx-clear" aria-label="Clear">×</button></div>`
        : "",
    );
    const ph = this.replyTo?.type === "q" ? "Your answer" : this.replyTo?.type === "day" ? "What's changing?" : "Message your coach";
    if (this.ta && this.ta.placeholder !== ph) this.ta.placeholder = ph;
  }

  // One question at a time, like the pushes; an answer moves to the conversation and the next one shows.
  _questions(m) {
    const open = (m.d.questions || []).filter((q) => !(m.answers[q.id]?.text || this.answered[q.id]));
    return open
      .slice(0, 1)
      .map((q) => {
        const chips = (q.answers || [])
          .map((a, i) => `<button class="chip" data-action="wk-ans" data-q="${esc(q.id)}" data-i="${i}">${esc(a)}</button>`)
          .join("");
        return `<div class="wc-q"><b>${esc(q.text)}</b><div class="ctx">${esc(q.context)}</div>
          <div class="chips">${chips}<button class="chip" data-action="wk-other" data-q="${esc(q.id)}">Something else…</button></div></div>`;
      })
      .join("");
  }

  _days(m) {
    const rows = m.plan;
    if (!rows.length) return "";
    const marks = this.marks || {};
    const status = (r) => marks[r.date] || r.status;
    if (!rows.some((r) => r.date === this.sel)) {
      this.sel = (rows.find((r) => r.date === m.today) || rows.find((r) => r.date > m.today) || rows[rows.length - 1]).date;
    }
    const pills = rows
      .map((r) => {
        const st = r.date < m.today ? status(r) : "planned";
        const cls = [st, r.date === m.today ? "today" : "", r.date === this.sel ? "sel" : ""].join(" ");
        return `<button class="wc-day ${cls}" data-action="wk-day" data-date="${esc(r.date)}" aria-label="${esc(`${r.label}: ${r.title}`)}">
          ${r.changed_at && r.date >= m.today ? '<i class="moved" aria-hidden="true"></i>' : ""}
          <span>${esc(r.weekday?.slice(0, 3) || "")}</span><b>${esc(KIND[r.kind] || r.kind)}</b></button>`;
      })
      .join("");
    return `<div class="wc-days">${pills}</div>${this._detail(m, rows.find((r) => r.date === this.sel), status)}`;
  }

  _detail(m, r, status) {
    const p = this.p;
    const past = r.date < m.today;
    const when = r.date === m.today ? "Today" : dayName(r.date);
    let st = "";
    let acts = "";
    if (past) {
      const s = status(r);
      const txt = {
        done: `Done${r.logged ? ` · ${r.logged}` : ""}`,
        changed: `Changed · ${r.logged || r.status_note || "you did something else"}`,
        skipped: "Skipped",
        unknown: "Nothing in Garmin or Hevy",
        planned: "Not checked yet",
      }[s] || s;
      st = `<div class="st ${esc(s)}">${s === "done" ? p.icon("mdiCheck") : ""}${esc(txt)}</div>`;
      if (s === "unknown" || s === "planned") {
        acts = `<button class="btn2" data-action="wk-mark" data-date="${esc(r.date)}" data-value="done">${p.icon("mdiCheck")} Done</button>
          <button class="btn2" data-action="wk-mark" data-date="${esc(r.date)}" data-value="skipped">Skipped</button>
          <button class="btn2" data-action="wk-about" data-date="${esc(r.date)}">I did something else</button>`;
      }
    } else {
      if (r.changed_at) st = `<div class="st" style="color:var(--violet)">Updated by your coach</div>`;
      const build =
        r.kind === "lift" || r.kind === "fingerboard"
          ? `<button class="btn2" data-action="wk-build" data-date="${esc(r.date)}">${p.icon("mdiDumbbell")} Build in Hevy</button>`
          : "";
      acts = `${build}<button class="btn2" data-action="wk-about" data-date="${esc(r.date)}">Change this day</button>`;
    }
    return `<div class="wc-detail"><div class="when">${esc(when)}</div><h4>${esc(r.title)}</h4>
      <p>${esc(r.focus)}</p><p class="cooked">If you're cooked: ${esc(r.if_cooked)}</p>${st}
      ${acts ? `<div class="wc-acts">${acts}</div>` : ""}</div>`;
  }

  _goals(m) {
    return `<div class="wc-goals">${(m.d.goals || [])
      .map(
        (g) => `<div class="wc-goal"><b>${esc(GOAL[g.goal] || g.goal)}</b><span class="${esc(g.trend)}">${esc(TREND[g.trend] || g.trend)}</span>
          <div>${esc(g.evidence)}</div></div>`,
      )
      .join("")}</div>`;
  }

  _full(m) {
    const d = m.d;
    const last = (d.last_week || [])
      .map((x) => `<p><span class="vd ${esc(x.verdict)}">${esc(x.verdict)}</span><b>${esc(x.item)}.</b> ${esc(x.note)}</p>`)
      .join("");
    const ins = (d.insights || []).map((x) => `<p><b>${esc(x.title)}</b> ${esc(x.body)}</p>`).join("");
    return `<div class="wc-more">
      ${last ? `<h5>Last week's plan</h5>${last}` : ""}
      <h5>What the week showed</h5>${ins}
      <p class="muted">${esc(d.baselines)}</p>
      <p class="muted">${esc(d.leaves_out)}</p></div>`;
  }

  _thread(m) {
    const p = this.p;
    const all = this._allMessages(m);
    const shown = this.older ? all : all.slice(-THREAD_SHOWN);
    const parts = [];
    if (all.length > shown.length) parts.push(`<button class="disclose" data-action="wk-older">${p.icon("mdiChevronDown")} ${all.length - shown.length} earlier</button>`);
    const qText = (id) => (m.d.questions || []).find((q) => q.id === id)?.text;
    for (const x of shown) {
      const at = Date.parse(x.at) || x.at;
      const meta = x.answers || (x.local && x.mode === "answer") ? `Answer · ${esc(qText(x.ref || x.answers) || "")}` : at ? esc(p._fmtTime(at)) : "";
      parts.push(
        `<div class="msg ${x.role}">${esc(x.text)}${
          x.role === "coach" && x.plan_changes?.length ? `<span class="moved">Plan updated: ${esc(x.plan_changes.join(", "))}</span>` : ""
        }<span class="meta">${meta}</span></div>`,
      );
      if (x.role !== "athlete" || x.replied) continue;
      const age = Date.now() - (typeof at === "number" ? at : Date.parse(at));
      const failed = x.reply_failed || x.failed || (x.local && this._dispatchFailed(x.at));
      if (failed) {
        parts.push(`<div class="msg-err">${x.local ? "Didn't send." : "Your coach couldn't reply."}<button data-action="wk-retry" data-cid="${esc(x.cid || "")}">Retry</button></div>`);
      } else if (age < REPLY_WAIT_MS) {
        parts.push(`<div class="typing"><i></i><i></i><i></i>${x.local && !x.sent ? "Sending…" : "Your coach is replying…"}</div>`);
      } else if (x.cid) {
        parts.push(`<div class="msg-err">No reply yet.<button data-action="wk-retry" data-cid="${esc(x.cid)}">Retry</button></div>`);
      }
    }
    if (!parts.length) return "";
    return `<div class="wc-lbl">Conversation</div><div class="wc-thread">${parts.join("")}</div>`;
  }
}
