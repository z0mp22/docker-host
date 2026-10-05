// TV panel: what's on each Roku, a remote, and an app launcher. A dependency-free web component
// registered via panel_custom; HA hands it `hass`, so there is no token handling or build step.

const ICONS = {
  mdiTelevisionPlay: "M21,3H3C1.89,3 1,3.89 1,5V17A2,2 0 0,0 3,19H8V21H16V19H21A2,2 0 0,0 23,17V5C23,3.89 22.1,3 21,3M21,17H3V5H21M16,11L9,15V7",
  mdiTelevision: "M21,17H3V5H21M21,3H3A2,2 0 0,0 1,5V17A2,2 0 0,0 3,19H8V21H16V19H21A2,2 0 0,0 23,17V5A2,2 0 0,0 21,3Z",
  mdiTelevisionOff: "M0.5,2.77L1.78,1.5L21,20.72L19.73,22L16.73,19H16V21H8V19H3A2,2 0 0,1 1,17V5C1,4.5 1.17,4.07 1.46,3.73L0.5,2.77M21,17V5H7.82L5.82,3H21A2,2 0 0,1 23,5V17C23,17.85 22.45,18.59 21.7,18.87L19.82,17H21M3,17H14.73L3,5.27V17Z",
  mdiSofa: "M12.5 7C12.5 5.89 13.39 5 14.5 5H18C19.1 5 20 5.9 20 7V9.16C18.84 9.57 18 10.67 18 11.97V14H12.5V7M6 11.96V14H11.5V7C11.5 5.89 10.61 5 9.5 5H6C4.9 5 4 5.9 4 7V9.15C5.16 9.56 6 10.67 6 11.96M20.66 10.03C19.68 10.19 19 11.12 19 12.12V15H5V12C5 10.9 4.11 10 3 10S1 10.9 1 12V17C1 18.1 1.9 19 3 19V21H5V19H19V21H21V19C22.1 19 23 18.1 23 17V12C23 10.79 21.91 9.82 20.66 10.03Z",
  mdiStairsDown: "M15 6H22V9H18V13H14V17H10V21H3V18H7V14H11V10H15V6M4.83 8.34L10.34 2.83L12.17 4.66L6.66 10.17L8.5 12H3V6.5L4.83 8.34Z",
  mdiMenu: "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",
  mdiPlay: "M8,5.14V19.14L19,12.14L8,5.14Z",
  mdiPause: "M14,19H18V5H14M6,19H10V5H6V19Z",
  mdiStop: "M18,18H6V6H18V18Z",
  mdiRewind10: "M12.5,3C17.15,3 21.08,6.03 22.47,10.22L20.1,11C19.05,7.81 16.04,5.5 12.5,5.5C10.54,5.5 8.77,6.22 7.38,7.38L10,10H3V3L5.6,5.6C7.45,4 9.85,3 12.5,3M10,12V22H8V14H6V12H10M18,14V20C18,21.11 17.11,22 16,22H14A2,2 0 0,1 12,20V14A2,2 0 0,1 14,12H16C17.11,12 18,12.9 18,14M14,14V20H16V14H14Z",
  mdiFastForward10: "M10,12V22H8V14H6V12H10M18,14V20C18,21.11 17.11,22 16,22H14A2,2 0 0,1 12,20V14A2,2 0 0,1 14,12H16C17.11,12 18,12.9 18,14M14,14V20H16V14H14M11.5,3C14.15,3 16.55,4 18.4,5.6L21,3V10H14L16.62,7.38C15.23,6.22 13.46,5.5 11.5,5.5C7.96,5.5 4.95,7.81 3.9,11L1.53,10.22C2.92,6.03 6.85,3 11.5,3Z",
  mdiRewind30: "M19,14V20C19,21.11 18.11,22 17,22H15A2,2 0 0,1 13,20V14A2,2 0 0,1 15,12H17C18.11,12 19,12.9 19,14M15,14V20H17V14H15M11,20C11,21.11 10.1,22 9,22H5V20H9V18H7V16H9V14H5V12H9A2,2 0 0,1 11,14V15.5A1.5,1.5 0 0,1 9.5,17A1.5,1.5 0 0,1 11,18.5V20M12.5,3C17.15,3 21.08,6.03 22.47,10.22L20.1,11C19.05,7.81 16.04,5.5 12.5,5.5C10.54,5.5 8.77,6.22 7.38,7.38L10,10H3V3L5.6,5.6C7.45,4 9.85,3 12.5,3Z",
  mdiFastForward30: "M11.5,3C6.85,3 2.92,6.03 1.53,10.22L3.9,11C4.95,7.81 7.96,5.5 11.5,5.5C13.46,5.5 15.23,6.22 16.62,7.38L14,10H21V3L18.4,5.6C16.55,4 14.15,3 11.5,3M19,14V20C19,21.11 18.11,22 17,22H15A2,2 0 0,1 13,20V14A2,2 0 0,1 15,12H17C18.11,12 19,12.9 19,14M15,14V20H17V14H15M11,20C11,21.11 10.1,22 9,22H5V20H9V18H7V16H9V14H5V12H9A2,2 0 0,1 11,14V15.5A1.5,1.5 0 0,1 9.5,17A1.5,1.5 0 0,1 11,18.5V20Z",
  mdiReplay: "M12,5V1L7,6L12,11V7A6,6 0 0,1 18,13A6,6 0 0,1 12,19A6,6 0 0,1 6,13H4A8,8 0 0,0 12,21A8,8 0 0,0 20,13A8,8 0 0,0 12,5Z",
  mdiFastForward: "M13,6V18L21.5,12M4,18L12.5,12L4,6V18Z",
  mdiRewind: "M11.5,12L20,18V6M11,18V6L2.5,12L11,18Z",
  mdiChevronUp: "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z",
  mdiChevronDown: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  mdiChevronLeft: "M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z",
  mdiChevronRight: "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",
  mdiArrowLeft: "M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z",
  mdiHome: "M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",
  mdiAsterisk: "M21 13H14.4L19.1 17.7L17.7 19.1L13 14.4V21H11V14.3L6.3 19L4.9 17.6L9.4 13H3V11H9.6L4.9 6.3L6.3 4.9L11 9.6V3H13V9.4L17.6 4.8L19 6.3L14.3 11H21V13Z",
  mdiVolumeMinus: "M3,9H7L12,4V20L7,15H3V9M14,11H22V13H14V11Z",
  mdiVolumePlus: "M3,9H7L12,4V20L7,15H3V9M14,11H17V8H19V11H22V13H19V16H17V13H14V11Z",
  mdiVolumeOff: "M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.45 16.63,19.82 17.68,18.96L19.73,21L21,19.73L12,10.73M19,12C19,12.94 18.8,13.82 18.46,14.64L19.97,16.15C20.62,14.91 21,13.5 21,12C21,7.72 18,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.5,12.43 16.5,12.21 16.5,12Z",
  mdiPower: "M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13",
  mdiMagnify: "M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z",
  mdiAlertCircleOutline: "M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z",
  mdiPlex: "M4,2C2.89,2 2,2.89 2,4V20C2,21.11 2.89,22 4,22H20C21.11,22 22,21.11 22,20V4C22,2.89 21.11,2 20,2H4M8.56,6H12.06L15.5,12L12.06,18H8.56L12,12L8.56,6Z",
  mdiApps: "M16,20H20V16H16M16,14H20V10H16M10,8H14V4H10M16,8H20V4H16M10,14H14V10H10M4,14H8V10H4M4,20H8V16H4M10,20H14V16H10M4,8H8V4H4V8Z",
  mdiRecordRec: "M12.5,5A7.5,7.5 0 0,0 5,12.5A7.5,7.5 0 0,0 12.5,20A7.5,7.5 0 0,0 20,12.5A7.5,7.5 0 0,0 12.5,5M7,10H9A1,1 0 0,1 10,11V12C10,12.5 9.62,12.9 9.14,12.97L10.31,15H9.15L8,13V15H7M12,10H14V11H12V12H14V13H12V14H14V15H12A1,1 0 0,1 11,14V11A1,1 0 0,1 12,10M16,10H18V11H16V14H18V15H16A1,1 0 0,1 15,14V11A1,1 0 0,1 16,10M8,11V12H9V11",
  mdiCalendarClock: "M15,13H16.5V15.82L18.94,17.23L18.19,18.53L15,16.69V13M19,8H5V19H9.67C9.24,18.09 9,17.07 9,16A7,7 0 0,1 16,9C17.07,9 18.09,9.24 19,9.67V8M5,21C3.89,21 3,20.1 3,19V5C3,3.89 3.89,3 5,3H6V1H8V3H16V1H18V3H19A2,2 0 0,1 21,5V11.1C22.24,12.36 23,14.09 23,16A7,7 0 0,1 16,23C14.09,23 12.36,22.24 11.1,21H5M16,11.15A4.85,4.85 0 0,0 11.15,16C11.15,18.68 13.32,20.85 16,20.85A4.85,4.85 0 0,0 20.85,16C20.85,13.32 18.68,11.15 16,11.15Z",
  mdiCheckCircleOutline: "M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M12 20C7.59 20 4 16.41 4 12S7.59 4 12 4 20 7.59 20 12 16.41 20 12 20M16.59 7.58L10 14.17L7.41 11.59L6 13L10 17L18 9L16.59 7.58Z",
  mdiWifiOff: "M2.28,3L1,4.27L2.47,5.74C2.04,6 1.61,6.29 1.2,6.6L3,9C3.53,8.6 4.08,8.25 4.66,7.93L6.89,10.16C6.15,10.5 5.44,10.91 4.8,11.4L6.6,13.8C7.38,13.22 8.26,12.77 9.2,12.47L11.75,15C10.5,15.07 9.34,15.5 8.4,16.2L12,21L14.46,17.73L17.74,21L19,19.72M12,3C9.85,3 7.8,3.38 5.9,4.07L8.29,6.47C9.5,6.16 10.72,6 12,6C15.38,6 18.5,7.11 21,9L22.8,6.6C19.79,4.34 16.06,3 12,3M12,9C11.62,9 11.25,9 10.88,9.05L14.07,12.25C15.29,12.53 16.43,13.07 17.4,13.8L19.2,11.4C17.2,9.89 14.7,9 12,9Z",
  mdiArrowRight: "M4,11V13H16L10.5,18.5L11.92,19.92L19.84,12L11.92,4.08L10.5,5.5L16,11H4Z",
  mdiInformationOutline: "M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z",
  mdiCog: "M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z",
  mdiPlayCircleOutline: "M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M10,16.5L16,12L10,7.5V16.5Z",
  mdiPauseCircleOutline: "M13,16V8H15V16H13M9,16V8H11V16H9M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4Z",
  mdiClockOutline: "M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z",
  mdiPlayPause: "M3,5V19L11,12M13,19H16V5H13M18,5V19H21V5",
  mdiDumbbell: "M20.57,14.86L22,13.43L20.57,12L17,15.57L8.43,7L12,3.43L10.57,2L9.14,3.43L7.71,2L5.57,4.14L4.14,2.71L2.71,4.14L4.14,5.57L2,7.71L3.43,9.14L2,10.57L3.43,12L7,8.43L15.57,17L12,20.57L13.43,22L14.86,20.57L16.29,22L18.43,19.86L19.86,21.29L21.29,19.86L19.86,18.43L22,16.29L20.57,14.86Z",
  mdiCheck: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
};

const PLAYING = new Set(["playing", "paused", "buffering"]);
const DEAD = new Set(["unavailable", "unknown"]);
// Two rows at 5 columns, three at 4; the CSS trims the grid to whole rows per width.
const APPS_SHOWN = 12;
const APPS_SHOWN_IDLE = 20;
const SEEK_SECONDS = 30;
const ROOM_KEY = "tv-panel-room";
// How long a quick start shows "Started" after its script finishes.
const QUICK_DONE_MS = 8000;

const svg = (name, cls = "") =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ICONS.mdiTelevision}"/></svg>`;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const num = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function fmtLeft(sec) {
  const min = Math.max(1, Math.round(sec / 60));
  if (min < 60) return `${min} min left`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min left` : `${h} h left`;
}

// What a room's TV is doing, merged from the Roku itself and the Plex client running on it.
// Plex knows titles, artwork and position; the Roku knows the app and whether it's on at all.
function readRoom(states, cfg, now) {
  const r = states[cfg.roku];
  const p = cfg.plex ? states[cfg.plex] : null;
  const online = !!r && !DEAD.has(r.state);
  const room = { ...cfg, online, exists: !!r, state: r?.state || "missing", app: r?.attributes?.app_name || "", sources: r?.attributes?.source_list || [] };
  if (!online) return { ...room, mode: "dead" };
  if (["off", "standby"].includes(r.state)) return { ...room, mode: "off" };

  const plexOn = p && PLAYING.has(p.state);
  const src = plexOn ? p : PLAYING.has(r.state) ? r : null;
  if (!src) {
    const home = !room.app || /^(home|roku( dynamic menu)?)$/i.test(room.app);
    return { ...room, mode: "idle", home };
  }
  const a = src.attributes || {};
  const playing = src.state === "playing" || src.state === "buffering";
  const dur = num(a.media_duration);
  let pos = num(a.media_position);
  if (pos !== null && playing && a.media_position_updated_at) pos += (now - Date.parse(a.media_position_updated_at)) / 1000;
  if (pos !== null && dur) pos = Math.min(pos, dur);

  let title = a.media_title || "";
  let sub = "";
  const meta = [];
  const type = a.media_content_type;
  if (plexOn && (type === "tvshow" || type === "episode") && a.media_series_title) {
    title = a.media_series_title;
    const se = [a.media_season != null ? `S${a.media_season}` : "", a.media_episode != null ? `E${a.media_episode}` : ""].filter(Boolean).join(" · ");
    sub = [se, a.media_title].filter(Boolean).join(" · ");
    meta.push("TV");
  } else if (plexOn && type === "movie") {
    meta.push("Movie");
  } else if (plexOn && a.media_artist) {
    sub = a.media_artist;
  }
  if (plexOn && a.media_content_rating) meta.push(a.media_content_rating);
  if (!title) title = room.app || "Playing";

  return {
    ...room,
    mode: "media",
    via: plexOn ? "plex" : "roku",
    entity: src.entity_id || (plexOn ? cfg.plex : cfg.roku),
    playing,
    title,
    sub,
    meta,
    summary: plexOn ? a.media_summary || "" : "",
    contentId: `${a.media_content_id ?? ""}|${title}`,
    art: a.entity_picture || "",
    poster: plexOn,
    dur,
    pos,
    canSeek: plexOn && dur !== null && pos !== null,
  };
}

function readRecordings(st, now) {
  const a = st?.attributes;
  if (!a) return null;
  const list = (v) => (Array.isArray(v) ? v : []);
  const upcoming = list(a.plex_queue)
    .map((x) => ({ title: x.title, show: x.show, at: Date.parse(x.air_time) }))
    .filter((x) => x.title && x.at > now - 3 * 3600e3)
    .sort((x, y) => x.at - y.at);
  // recorded_at from the sync is sometimes a day off; the filename carries the real air date.
  const recent = list(a.recent_recordings)
    .map((x) => {
      const m = String(x.path || "").match(/ - (\d{4})-(\d{2})-(\d{2}) /);
      return { title: x.title, show: x.show, at: m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : null };
    })
    .filter((x) => x.title);
  return { upcoming, recent };
}

const CSS = `
:host {
  --bg: #080d17; --card: #0f1624; --card-2: #141d2e; --line: rgba(148,170,200,.12);
  --text: #eef3fa; --muted: #8593a8; --violet: #a78bfa; --violet-2: #6d28d9;
  --green: #22c55e; --amber: #f5b041; --red: #f0616d; --grey: #64748b;
  display: block; height: 100%; overflow-y: auto; container-type: inline-size;
  background: radial-gradient(1200px 600px at 10% -10%, rgba(124,58,237,.16), transparent 60%),
              radial-gradient(900px 500px at 110% 110%, rgba(40,110,190,.10), transparent 60%), var(--bg);
  color: var(--text); font-family: "Outfit", "SF Pro Display", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
* { box-sizing: border-box; }
button { font: inherit; color: inherit; border: 0; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; }
button:disabled { cursor: default; }
a { color: inherit; text-decoration: none; }
.ic { width: 24px; height: 24px; fill: currentColor; flex: none; }
.muted { color: var(--muted); }

.app { max-width: 1480px; margin: 0 auto; padding: 28px 28px 40px; }

.top { display: flex; align-items: center; gap: 18px; margin-bottom: 26px; }
.brand { width: 76px; height: 76px; border-radius: 22px; display: grid; place-items: center; flex: none; color: #fff;
  background: linear-gradient(160deg, #c4b5fd, #7c3aed); box-shadow: 0 10px 30px rgba(124,58,237,.35), inset 0 1px 0 rgba(255,255,255,.35); }
.brand.idle { background: linear-gradient(160deg, #3a4a61, #243246); box-shadow: none; }
.brand .ic { width: 38px; height: 38px; }
.titles { flex: 1 1 0; min-width: 0; }
h1 { margin: 0; font-size: 34px; font-weight: 700; letter-spacing: -.01em; line-height: 1.1; }
.status { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 18px; white-space: nowrap; overflow: hidden; }
.status b { font-weight: 600; }
.status .detail { overflow: hidden; text-overflow: ellipsis; }
.dot { width: 12px; height: 12px; border-radius: 50%; flex: none; background: var(--grey); }
.dot.violet { background: var(--violet); box-shadow: 0 0 10px var(--violet); animation: pulse 1.6s ease-in-out infinite; }
.dot.green { background: var(--green); }
.dot.amber { background: var(--amber); }
@keyframes pulse { 50% { opacity: .35; } }
.spacer { flex: 1; }
.chip { display: flex; align-items: center; gap: 10px; height: 54px; padding: 0 22px; border-radius: 20px; max-width: 46%;
  background: var(--card-2); border: 1px solid var(--line); font-weight: 600; font-size: 17px; white-space: nowrap; }
.chip span { overflow: hidden; text-overflow: ellipsis; }
.chip .ic { color: #f472b6; }
.icon-btn { width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; background: var(--card-2); border: 1px solid var(--line); flex: none; }

.grid { display: grid; gap: 22px; grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.9fr); align-items: start; }
.col { display: flex; flex-direction: column; gap: 22px; min-width: 0; }
.card { background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line); border-radius: 30px; padding: 24px 28px; min-width: 0; }
.rooms { order: 0; } .now, .quick { order: 1; } .remote { order: 2; } .apps { order: 3; } .dvr { order: 4; }
.card-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.eyebrow { font-size: 13px; letter-spacing: .12em; font-weight: 600; color: var(--muted); text-transform: uppercase; }
.link-btn { color: var(--violet); font-weight: 600; font-size: 15px; padding: 6px 2px; display: inline-flex; align-items: center; gap: 4px; }
.link-btn .ic { width: 18px; height: 18px; }
.note { font-size: 14px; color: var(--muted); margin-top: 12px; line-height: 1.45; }
.empty { margin-top: 14px; padding: 18px; border-radius: 14px; border: 1px dashed var(--line); color: var(--muted); font-size: 15px; text-align: center; }

/* Rooms */
.room-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-bottom: 22px; }
.room { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 22px; text-align: left; min-width: 0;
  background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1.5px solid var(--line); transition: border-color .2s, background .2s; }
.room:hover { border-color: rgba(148,170,200,.28); }
.room.sel { border-color: rgba(167,139,250,.65); background: linear-gradient(180deg, #1c1833, var(--card)); }
.ric { width: 48px; height: 48px; border-radius: 15px; display: grid; place-items: center; flex: none; background: #243246; color: #aeb9c9; }
.room.media .ric { background: linear-gradient(160deg, #c4b5fd, #7c3aed); color: #fff; box-shadow: 0 8px 22px rgba(124,58,237,.35); }
.room.dead .ric { background: rgba(245,176,65,.14); color: var(--amber); }
.room-t { min-width: 0; flex: 1; }
.room-t b { display: block; font-size: 18px; font-weight: 600; }
.room-t span { display: block; font-size: 14.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.room.media .room-t span { color: #d6cbff; }
.room.dead .room-t span { color: #f7d49a; }

/* Quick start */
.quick-list { display: grid; gap: 12px; margin-top: 14px; }
.qbtn { display: flex; align-items: center; gap: 16px; width: 100%; padding: 14px 18px; border-radius: 22px; text-align: left; color: #fff;
  background: linear-gradient(180deg, #9f7aea, var(--violet-2)); box-shadow: 0 10px 30px rgba(109,40,217,.4), inset 0 1px 0 rgba(255,255,255,.3); transition: transform .12s; }
.qbtn:not(:disabled):active { transform: scale(.98); }
.qbtn .qic { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; flex: none; background: rgba(255,255,255,.16); }
.qbtn .qic .ic { width: 28px; height: 28px; }
.qbtn .qt { min-width: 0; flex: 1; }
.qbtn b { display: block; font-size: 20px; font-weight: 600; }
.qbtn .qt span { display: block; font-size: 14.5px; color: #e6dcff; margin-top: 2px; }
.qbtn .qs { font-size: 14px; font-weight: 600; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; }
.qbtn .qs .ic { width: 18px; height: 18px; }
.qbtn.done { background: linear-gradient(180deg, #2fa866, #1d7a46); box-shadow: 0 10px 30px rgba(34,197,94,.3), inset 0 1px 0 rgba(255,255,255,.25); }
.qbtn:disabled { background: #243044; box-shadow: none; color: #6f7d92; }
.qbtn:disabled .qt span { color: #6f7d92; }
.qbtn.busy:disabled { background: linear-gradient(180deg, #7d62bd, #55239f); color: #fff; }
.qbtn.busy:disabled .qt span { color: #e6dcff; }

/* Now playing */
.now { position: relative; overflow: hidden; padding: 0; }
.backdrop { position: absolute; inset: -40px; background-size: cover; background-position: center; filter: blur(48px) saturate(1.2); opacity: .32; pointer-events: none; }
.now-in { position: relative; padding: 26px 28px; }
.np { display: flex; gap: 26px; margin-top: 16px; align-items: flex-start; }
.art { position: relative; flex: none; width: 180px; aspect-ratio: 2 / 3; border-radius: 18px; overflow: hidden; background: #1a2435; display: grid; place-items: center;
  box-shadow: 0 18px 40px rgba(0,0,0,.45); border: 1px solid rgba(255,255,255,.06); color: #4b5a70; }
.art.wide { width: 220px; aspect-ratio: 4 / 3; }
.art .ic { width: 56px; height: 56px; }
.art img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.np-t { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.np-title { font-size: 34px; font-weight: 700; line-height: 1.1; letter-spacing: -.01em; overflow-wrap: anywhere; }
.np-sub { font-size: 18px; color: #c3cedd; margin-top: 6px; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.tag { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 9px; font-size: 13.5px; font-weight: 600;
  background: rgba(255,255,255,.06); border: 1px solid var(--line); color: #c3cedd; }
.tag .ic { width: 16px; height: 16px; }
.tag.plex { color: #f6c453; }
.summary { margin-top: 14px; font-size: 15px; line-height: 1.5; color: #aab5c5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.prog { margin-top: 20px; }
.bar { height: 8px; border-radius: 4px; background: rgba(148,170,200,.16); overflow: hidden; }
.bar i { display: block; height: 100%; border-radius: 4px; background: linear-gradient(90deg, #7c3aed, var(--violet)); }
.bar.paused i { background: #8593a8; }
.times { display: flex; justify-content: space-between; gap: 10px; margin-top: 8px; font-size: 14.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.times b { color: var(--text); font-weight: 600; }
.controls { display: flex; align-items: center; gap: 14px; margin-top: 22px; }
.ctl { width: 58px; height: 58px; border-radius: 18px; display: grid; place-items: center; background: rgba(255,255,255,.07); border: 1px solid var(--line); }
.ctl:not(:disabled):active { background: rgba(255,255,255,.14); }
.ctl .ic { width: 28px; height: 28px; }
.ctl small { display: none; }
.cta { height: 64px; padding: 0 30px; border-radius: 22px; display: inline-flex; align-items: center; gap: 12px; font-size: 20px; font-weight: 600; color: #fff;
  background: linear-gradient(180deg, #9f7aea, var(--violet-2)); box-shadow: 0 10px 30px rgba(109,40,217,.45), inset 0 1px 0 rgba(255,255,255,.3); }
.cta .ic { width: 28px; height: 28px; }
.cta:disabled { background: #243044; box-shadow: none; color: #6f7d92; }
.cta.round { width: 72px; height: 72px; padding: 0; border-radius: 50%; justify-content: center; }
.cta.round .ic { width: 34px; height: 34px; }
.state-big { font-size: 34px; font-weight: 700; margin-top: 14px; line-height: 1.15; }
.state-sub { font-size: 17px; color: #c3cedd; margin-top: 6px; line-height: 1.45; }
.steps { margin: 14px 0 0; padding-left: 22px; font-size: 16px; line-height: 1.6; color: #dbe3ee; }
.steps b { color: var(--text); }
.idle-row { display: flex; align-items: center; gap: 22px; margin-top: 16px; }
.idle-ic { width: 92px; height: 92px; border-radius: 26px; display: grid; place-items: center; background: #1b2638; color: #aeb9c9; flex: none; }
.idle-ic .ic { width: 46px; height: 46px; }
.idle-ic.off { color: #4b5a70; }
.idle-ic.warn { background: rgba(245,176,65,.12); color: var(--amber); }
.idle-ic img { width: 100%; height: 100%; object-fit: cover; border-radius: 26px; }

/* Remote */
.remote-in { display: flex; flex-direction: column; align-items: center; gap: 18px; margin-top: 18px; }
.remote.off .remote-in { opacity: .45; }
.dpad { position: relative; width: 236px; height: 236px; border-radius: 50%; background: radial-gradient(circle at 50% 35%, #1f2a3d, #151e2d); border: 1px solid var(--line);
  box-shadow: inset 0 2px 0 rgba(255,255,255,.04), 0 12px 30px rgba(0,0,0,.35); }
.dpad .k { position: absolute; width: 72px; height: 72px; display: grid; place-items: center; color: #c3cedd; border-radius: 22px; }
.dpad .k:not(:disabled):active { background: rgba(167,139,250,.18); color: #fff; }
.dpad .k .ic { width: 34px; height: 34px; }
.dpad .up { top: 6px; left: 82px; } .dpad .down { bottom: 6px; left: 82px; }
.dpad .left { left: 6px; top: 82px; } .dpad .right { right: 6px; top: 82px; }
.dpad .ok { position: absolute; left: 68px; top: 68px; width: 100px; height: 100px; border-radius: 50%; font-size: 20px; font-weight: 700; letter-spacing: .04em;
  background: linear-gradient(180deg, #2a3650, #1c2638); border: 1px solid rgba(148,170,200,.22); box-shadow: 0 6px 16px rgba(0,0,0,.35); }
.dpad .ok:not(:disabled):active { background: linear-gradient(180deg, #8b5cf6, var(--violet-2)); }
.keys { display: grid; grid-template-columns: repeat(3, 72px); gap: 14px; justify-content: center; }
.key { height: 60px; border-radius: 18px; display: grid; place-items: center; background: #1a2435; border: 1px solid var(--line); color: #c3cedd; }
.key:not(:disabled):active { background: #2a3650; color: #fff; }
.key .ic { width: 26px; height: 26px; }
.vol { display: flex; align-items: center; gap: 4px; padding: 5px; border-radius: 20px; background: #1a2435; border: 1px solid var(--line); }
.vol button { width: 56px; height: 48px; border-radius: 15px; display: grid; place-items: center; background: #243044; color: #c3cedd; }
.vol button:not(:disabled):active { background: #2f3d55; color: #fff; }
.vol span { padding: 0 12px; font-size: 14px; color: var(--muted); white-space: nowrap; }
.remote button:disabled { opacity: .5; }
.pwr { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; background: #1a2435; border: 1px solid var(--line); color: #c3cedd; }
.pwr.on { color: var(--violet); }
.search { display: flex; gap: 8px; width: 100%; margin-top: 4px; }
.search input { flex: 1; min-width: 0; height: 48px; border-radius: 15px; border: 1px solid var(--line); background: #121a28; color: var(--text); font: inherit; font-size: 16px; padding: 0 14px; outline: none; }
.search input:focus { border-color: rgba(167,139,250,.6); }
.search button { height: 48px; padding: 0 16px; border-radius: 15px; background: #243044; color: #d6cbff; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }

/* Apps */
.app-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
.tile { position: relative; aspect-ratio: 4 / 3; border-radius: 16px; overflow: hidden; background: #1a2435; border: 1.5px solid var(--line); display: grid; place-items: center;
  padding: 8px; text-align: center; font-size: 13.5px; font-weight: 600; color: #c3cedd; transition: transform .12s, border-color .2s; }
.tile:not(:disabled):hover { border-color: rgba(148,170,200,.35); }
.tile:not(:disabled):active { transform: scale(.97); }
.tile img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.tile.cur { border-color: var(--violet); box-shadow: 0 0 0 3px rgba(167,139,250,.25); }
.tile .badge { position: absolute; left: 6px; bottom: 6px; padding: 2px 7px; border-radius: 7px; font-size: 11.5px; font-weight: 700; background: rgba(15,22,36,.85); color: #d6cbff; }
.tile:disabled { opacity: .45; }
.app-grid.few .tile:nth-child(n+11) { display: none; }

/* DVR */
.dvr-list { display: flex; flex-direction: column; margin-top: 10px; }
.sub-h { font-size: 12.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); font-weight: 600; margin: 14px 0 2px; }
.rec { display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 9px 0; }
.rec + .rec { border-top: 1px solid var(--line); }
.rec .aic { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; background: #172234; color: #c3cedd; }
.rec .aic.up { background: rgba(244,114,182,.12); color: #f472b6; }
.rec .aic .ic { width: 20px; height: 20px; }
.rec b { font-size: 15.5px; font-weight: 500; display: block; overflow-wrap: anywhere; }
.rec small { font-size: 13px; color: var(--muted); }
.rec .when { text-align: right; font-size: 14px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }

.toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); padding: 14px 20px; border-radius: 14px; background: #3a1d24; border: 1px solid rgba(240,97,109,.5); color: #ffd3d7; z-index: 10; max-width: 90vw; }

@container (max-width: 1150px) {
  .app-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .app-grid.few .tile:nth-child(n+11) { display: grid; }
}
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
  .chip { order: 5; width: 100%; max-width: none; height: 44px; font-size: 15px; padding: 0 16px; border-radius: 16px; }
  .grid { gap: 14px; }
  .card { border-radius: 24px; padding: 18px 16px; }
  .room-row { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
  .room { flex-direction: column; align-items: flex-start; gap: 10px; padding: 12px; border-radius: 18px; }
  .ric { width: 38px; height: 38px; border-radius: 12px; } .ric .ic { width: 21px; height: 21px; }
  .room-t b { font-size: 16px; }
  .room-t span { font-size: 13px; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .now { padding: 0; }
  .now-in { padding: 18px 16px; }
  .np { gap: 16px; margin-top: 14px; }
  .art { width: 104px; border-radius: 12px; }
  .art.wide { width: 120px; }
  .np-title { font-size: 22px; }
  .np-sub { font-size: 14.5px; margin-top: 4px; }
  .tags { margin-top: 8px; } .tag { height: 24px; font-size: 12px; padding: 0 8px; }
  .summary { display: none; }
  .prog { margin-top: 16px; }
  .times { font-size: 13px; }
  .controls { justify-content: center; gap: 18px; margin-top: 16px; }
  .state-big { font-size: 24px; margin-top: 10px; }
  .state-sub { font-size: 15px; }
  .steps { font-size: 14.5px; padding-left: 20px; }
  .idle-row { gap: 14px; margin-top: 12px; align-items: flex-start; }
  .idle-ic { width: 60px; height: 60px; border-radius: 18px; } .idle-ic .ic { width: 30px; height: 30px; } .idle-ic img { border-radius: 18px; }
  .cta { height: 54px; padding: 0 22px; font-size: 17px; border-radius: 18px; }
  .qbtn { padding: 12px 14px; gap: 12px; border-radius: 18px; }
  .qbtn .qic { width: 44px; height: 44px; border-radius: 14px; }
  .qbtn b { font-size: 17px; }
  .qbtn .qt span { font-size: 13px; }
  .dpad { width: 216px; height: 216px; }
  .dpad .k { width: 66px; height: 66px; } .dpad .up, .dpad .down { left: 75px; } .dpad .left, .dpad .right { top: 75px; }
  .dpad .ok { left: 63px; top: 63px; width: 90px; height: 90px; }
  .keys { grid-template-columns: repeat(3, 66px); gap: 12px; }
  .key { height: 54px; border-radius: 16px; }
  .app-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
  .app-grid.few .tile:nth-child(n+10), .app-grid.roomy .tile:nth-child(n+19) { display: none; }
  .tile { border-radius: 12px; font-size: 12px; }
}
`;

class TvPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._apps = new Map(); // roku entity -> { status, list: [{id, title}] }
    this._icons = new Map(); // "entity|appId" -> blob URL | "" (failed) | null (loading)
    this._art = new Map(); // room name -> { key, url }: keeps the first artwork URL for a title
    this._showAllApps = false;
    this._query = "";
    this._toast = "";
    this._quick = new Map(); // script entity -> { phase: "busy" | "done", at }
    try {
      this._room = localStorage.getItem(ROOM_KEY) || "";
    } catch (_) {
      this._room = "";
    }
    this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
    this.shadowRoot.addEventListener("input", (e) => {
      if (e.target.matches?.("input[name=q]")) this._query = e.target.value;
    });
    this.shadowRoot.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.matches?.("input[name=q]")) {
        e.preventDefault();
        this._search();
      }
    });
    // Broken artwork or app icons fall back to the icon drawn underneath.
    this.shadowRoot.addEventListener("error", (e) => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
  }

  set panel(p) {
    this._config = p?.config || {};
    this._scheduleRender();
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

  get _c() {
    const c = this._config || {};
    return { rooms: c.rooms || [], recordings: c.recordings, links: c.links || {} };
  }

  connectedCallback() {
    loadFont();
    this._tick = setInterval(() => this._render(), 5000);
    this._scheduleRender();
  }

  disconnectedCallback() {
    clearInterval(this._tick);
  }

  _scheduleRender() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this._render();
    });
  }

  // App list in the Roku's home-screen order, with ids for the icons.
  async _loadApps(room) {
    const id = room.roku;
    const have = this._apps.get(id);
    if (have && (have.status === "loading" || have.status === "ok")) return;
    if (have?.status === "error" && Date.now() - have.at < 60000) return;
    this._apps.set(id, { status: "loading", list: have?.list || [] });
    try {
      const res = await this._hass.callWS({ type: "media_player/browse_media", entity_id: id, media_content_type: "apps", media_content_id: "apps" });
      const list = (res?.children || []).filter((c) => c.media_content_id).map((c) => ({ id: String(c.media_content_id), title: c.title }));
      this._apps.set(id, { status: "ok", list });
    } catch (_) {
      this._apps.set(id, { status: "error", at: Date.now(), list: [] });
    }
    this._scheduleRender();
  }

  // Roku serves icons over plain HTTP on the LAN; HA's media proxy makes them work over HTTPS and away from home.
  _icon(entity, appId) {
    const key = `${entity}|${appId}`;
    if (this._icons.has(key)) return this._icons.get(key);
    this._icons.set(key, null);
    const path = `/api/media_player_proxy/${entity}/browse_media/app/${encodeURIComponent(appId)}`;
    const get = this._hass.fetchWithAuth
      ? this._hass.fetchWithAuth(path)
      : fetch(path, { headers: { Authorization: `Bearer ${this._hass.auth?.data?.access_token}` } });
    get
      .then((r) => (r.ok ? r.blob() : Promise.reject(r.status)))
      .then((b) => this._icons.set(key, URL.createObjectURL(b)))
      .catch(() => this._icons.set(key, ""))
      .finally(() => this._scheduleRender());
    return null;
  }

  _showToast(msg) {
    this._toast = msg;
    this._render();
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this._toast = "";
      this._render();
    }, 5000);
  }

  async _call(domain, service, data) {
    try {
      await this._hass.callService(domain, service, data);
    } catch (err) {
      this._showToast(`Couldn't reach the TV: ${err.message || err}`);
    }
  }

  // Quick starts call the script itself (not script.turn_on) so a failure comes back here as a toast.
  async _runQuick(item) {
    const id = item?.script || "";
    if (!id.startsWith("script.") || this._quick.get(id)?.phase === "busy") return;
    navigator.vibrate?.(8);
    this._quick.set(id, { phase: "busy" });
    this._render();
    try {
      await this._hass.callService("script", id.slice("script.".length));
      this._quick.set(id, { phase: "done", at: Date.now() });
    } catch (err) {
      this._quick.delete(id);
      this._showToast(`${item.name || "That"} didn't start: ${err.message || err}`);
    }
    this._render();
    setTimeout(() => this._render(), QUICK_DONE_MS + 100);
  }

  _key(room, command) {
    if (!room?.remote) return;
    navigator.vibrate?.(8);
    this._call("remote", "send_command", { entity_id: room.remote, command });
  }

  _search() {
    const room = this._sel;
    const q = this._query.trim();
    if (!room?.online || !q) return;
    this._call("roku", "search", { entity_id: room.roku, keyword: q });
    this._query = "";
    this._render();
  }

  _onClick(e) {
    const el = e.target.closest?.("[data-action]");
    if (!el || !this._hass || el.disabled) return;
    const room = this._sel;
    const a = el.dataset.action;
    switch (a) {
      case "menu":
        this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
        return;
      case "room":
        this._room = el.dataset.room;
        this._showAllApps = false;
        try {
          localStorage.setItem(ROOM_KEY, this._room);
        } catch (_) {
          /* view preference only */
        }
        this._render();
        return;
      case "key":
        this._key(room, el.dataset.cmd);
        return;
      case "playpause":
        if (room?.mode === "media") this._call("media_player", "media_play_pause", { entity_id: room.entity });
        else this._key(room, "play");
        return;
      case "seek": {
        if (!room?.canSeek) return;
        const to = Math.max(0, Math.min(room.dur - 5, room.pos + Number(el.dataset.by)));
        this._call("media_player", "media_seek", { entity_id: room.entity, seek_position: Math.round(to) });
        return;
      }
      case "power":
        if (room) this._call("media_player", room.mode === "off" ? "turn_on" : "turn_off", { entity_id: room.roku });
        return;
      case "launch":
        if (room?.online) {
          navigator.vibrate?.(8);
          this._call("media_player", "select_source", { entity_id: room.roku, source: el.dataset.app });
        }
        return;
      case "quick":
        this._runQuick(room?.quick?.[Number(el.dataset.i)]);
        return;
      case "search":
        this._search();
        return;
      case "more-apps":
        this._showAllApps = !this._showAllApps;
        this._render();
        return;
      case "go":
        history.pushState(null, "", el.dataset.path);
        window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
        return;
      default:
    }
  }

  _fmtTime(ms) {
    const tf = this._hass?.locale?.time_format;
    const hour12 = tf === "12" ? true : tf === "24" ? false : undefined;
    return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12 });
  }

  _fmtDay(ms) {
    const d = new Date(ms);
    const diff = Math.round((new Date(ms).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    if (diff > 1 && diff < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  _roomLine(r) {
    if (r.mode === "dead") return r.exists ? "Not responding" : "Not set up in HA";
    if (r.mode === "off") return "Off";
    if (r.mode === "idle") return r.home ? "On · home screen" : `On · ${r.app}`;
    return `${r.playing ? "Playing" : "Paused"} · ${r.title}`;
  }

  _artUrl(r) {
    // Plex rotates the token in entity_picture every few minutes; keep one URL per title so the
    // artwork doesn't reload (and flash) on every token change.
    if (!r.art) return "";
    const have = this._art.get(r.name);
    if (have && have.key === r.contentId) return have.url;
    this._art.set(r.name, { key: r.contentId, url: r.art });
    return r.art;
  }

  _nowCard(r) {
    const head = (label) => `<div class="card-head"><span class="eyebrow">${esc(r.name)} · ${esc(label)}</span></div>`;
    if (r.mode === "dead") {
      const steps = r.exists
        ? `<div class="state-sub">If it's on, its mobile-app control is probably set to <b>Limited</b>, which lets apps see it but not control it. On that Roku:</div>
           <ol class="steps"><li>Settings → <b>System</b> → <b>Advanced system settings</b></li><li><b>Control by mobile apps</b> → <b>Network access</b></li><li>Choose <b>Default</b>. Home Assistant reconnects within a minute.</li></ol>`
        : `<div class="state-sub">Add it under Settings → Devices &amp; services → Roku, then set <code>${esc(r.roku)}</code> in this panel's config.</div>`;
      return `<section class="card now"><div class="now-in">${head("Remote control")}
        <div class="idle-row"><div class="idle-ic warn">${svg("mdiWifiOff")}</div>
          <div style="min-width:0"><div class="state-big" style="margin-top:0">Home Assistant can't reach this Roku</div>${steps}</div></div></div></section>`;
    }
    if (r.mode === "off") {
      return `<section class="card now"><div class="now-in">${head("Off")}
        <div class="idle-row"><div class="idle-ic off">${svg("mdiTelevisionOff")}</div>
          <div><div class="state-big" style="margin-top:0">The Roku is off</div><div class="state-sub">Turning it on also wakes the TV if HDMI-CEC is on.</div></div></div>
        <div class="controls"><button class="cta" data-action="power">${svg("mdiPower")} Turn on</button></div></div></section>`;
    }
    if (r.mode === "idle") {
      const appId = (this._apps.get(r.roku)?.list || []).find((x) => x.title === r.app)?.id;
      const icon = !r.home && appId ? this._icon(r.roku, appId) : null;
      return `<section class="card now"><div class="now-in">${head("Nothing playing")}
        <div class="idle-row"><div class="idle-ic">${icon ? `<img src="${esc(icon)}" alt="">` : svg(r.home ? "mdiHome" : "mdiApps")}</div>
          <div style="min-width:0"><div class="state-big" style="margin-top:0">${r.home ? "On the home screen" : `${esc(r.app)} is open`}</div>
          <div class="state-sub">Pick an app below or use the remote.</div></div></div></div></section>`;
    }
    const art = this._artUrl(r);
    const left = r.dur && r.pos !== null ? r.dur - r.pos : null;
    const pct = r.dur && r.pos !== null ? Math.min(100, (r.pos / r.dur) * 100) : null;
    const prog =
      pct === null
        ? ""
        : `<div class="prog"><div class="bar ${r.playing ? "" : "paused"}"><i style="width:${pct.toFixed(2)}%"></i></div>
           <div class="times"><span><b>${fmtClock(r.pos)}</b> / ${fmtClock(r.dur)}</span><span>${fmtLeft(left)}${r.playing ? ` · ends <b>${this._fmtTime(Date.now() + left * 1000)}</b>` : ""}</span></div></div>`;
    const tags = [
      `<span class="tag ${r.via === "plex" ? "plex" : ""}">${svg(r.via === "plex" ? "mdiPlex" : "mdiApps")}${esc(r.via === "plex" ? "Plex" : r.app || "Roku")}</span>`,
      ...r.meta.map((m) => `<span class="tag">${esc(m)}</span>`),
    ].join("");
    const seekBack = r.canSeek
      ? `<button class="ctl" data-action="seek" data-by="-${SEEK_SECONDS}" aria-label="Back ${SEEK_SECONDS} seconds">${svg("mdiRewind30")}</button>`
      : `<button class="ctl" data-action="key" data-cmd="replay" aria-label="Instant replay">${svg("mdiReplay")}</button>`;
    const seekFwd = r.canSeek
      ? `<button class="ctl" data-action="seek" data-by="${SEEK_SECONDS}" aria-label="Forward ${SEEK_SECONDS} seconds">${svg("mdiFastForward30")}</button>`
      : `<button class="ctl" data-action="key" data-cmd="forward" aria-label="Fast forward">${svg("mdiFastForward")}</button>`;
    return `<section class="card now">
      ${art ? `<div class="backdrop" style="background-image:url('${esc(art)}')"></div>` : ""}
      <div class="now-in">${head(r.playing ? "Now playing" : "Paused")}
        <div class="np">
          <div class="art ${r.poster ? "" : "wide"}">${svg(r.via === "plex" ? "mdiPlex" : "mdiTelevisionPlay")}${art ? `<img src="${esc(art)}" alt="">` : ""}</div>
          <div class="np-t">
            <div class="np-title">${esc(r.title)}</div>
            ${r.sub ? `<div class="np-sub">${esc(r.sub)}</div>` : ""}
            <div class="tags">${tags}</div>
            ${r.summary ? `<div class="summary">${esc(r.summary)}</div>` : ""}
          </div>
        </div>
        ${prog}
        <div class="controls">
          ${seekBack}
          <button class="cta round" data-action="playpause" aria-label="${r.playing ? "Pause" : "Play"}">${svg(r.playing ? "mdiPause" : "mdiPlay")}</button>
          ${seekFwd}
        </div>
      </div></section>`;
  }

  _quickCard(r) {
    const items = Array.isArray(r.quick) ? r.quick : [];
    if (!items.length) return "";
    const btns = items
      .map((q, i) => {
        const st = this._quick.get(q.script);
        const busy = st?.phase === "busy";
        const done = st?.phase === "done" && Date.now() - st.at < QUICK_DONE_MS;
        const detail = !r.online ? "Needs Home Assistant to reach this Roku" : busy ? "Starting…" : q.detail || "";
        const right = done ? `<span class="qs">${svg("mdiCheck")}Started</span>` : "";
        return `<button class="qbtn ${busy ? "busy" : ""} ${done ? "done" : ""}" data-action="quick" data-i="${i}" ${r.online && !busy ? "" : "disabled"}>
          <span class="qic">${svg(q.icon || "mdiPlay")}</span>
          <span class="qt"><b>${esc(q.name)}</b><span>${esc(detail)}</span></span>${right}</button>`;
      })
      .join("");
    return `<section class="card quick"><div class="card-head"><span class="eyebrow">Quick start · ${esc(r.name)}</span></div><div class="quick-list">${btns}</div></section>`;
  }

  _remoteCard(r) {
    const off = !r.online;
    const dis = off ? "disabled" : "";
    const k = (cmd, icon, label, cls = "key") => `<button class="${cls}" data-action="key" data-cmd="${cmd}" aria-label="${label}" title="${label}" ${dis}>${svg(icon)}</button>`;
    const powerOn = r.online && r.mode !== "off";
    return `<section class="card remote ${off ? "off" : ""}">
      <div class="card-head"><span class="eyebrow">Remote · ${esc(r.name)}</span>
        <button class="pwr ${powerOn ? "on" : ""}" data-action="power" aria-label="${powerOn ? "Turn off" : "Turn on"}" title="${powerOn ? "Turn off" : "Turn on"}" ${dis}>${svg("mdiPower")}</button></div>
      ${off ? `<div class="note" style="margin-top:6px">The remote works once Home Assistant can reach this Roku.</div>` : ""}
      <div class="remote-in">
        <div class="keys">${k("back", "mdiArrowLeft", "Back")}${k("home", "mdiHome", "Home")}${k("info", "mdiAsterisk", "Options")}</div>
        <div class="dpad">
          ${k("up", "mdiChevronUp", "Up", "k up")}${k("left", "mdiChevronLeft", "Left", "k left")}
          <button class="ok" data-action="key" data-cmd="select" aria-label="OK" ${dis}>OK</button>
          ${k("right", "mdiChevronRight", "Right", "k right")}${k("down", "mdiChevronDown", "Down", "k down")}
        </div>
        <div class="keys">${k("reverse", "mdiRewind", "Rewind")}<button class="key" data-action="playpause" aria-label="Play or pause" title="Play / pause" ${dis}>${svg("mdiPlayPause")}</button>${k("forward", "mdiFastForward", "Fast forward")}</div>
        <div class="vol">
          <button data-action="key" data-cmd="volume_down" aria-label="TV volume down" ${dis}>${svg("mdiVolumeMinus")}</button>
          <span>TV volume</span>
          <button data-action="key" data-cmd="volume_mute" aria-label="Mute TV" ${dis}>${svg("mdiVolumeOff")}</button>
          <button data-action="key" data-cmd="volume_up" aria-label="TV volume up" ${dis}>${svg("mdiVolumePlus")}</button>
        </div>
        <div class="search">
          <input name="q" type="search" placeholder="Search Roku for a show or movie" value="${esc(this._query)}" autocomplete="off" enterkeyhint="search" ${dis}>
          <button data-action="search" ${dis}>${svg("mdiMagnify")}Search</button>
        </div>
      </div></section>`;
  }

  _appsCard(r) {
    const loaded = this._apps.get(r.roku);
    let list = loaded?.list?.length ? loaded.list : r.sources.filter((s) => s !== "Home").map((title) => ({ id: null, title }));
    const total = list.length;
    const head = `<div class="card-head"><span class="eyebrow">Apps · ${esc(r.name)}</span>${
      total > (r.mode === "idle" || r.mode === "off" ? APPS_SHOWN_IDLE : APPS_SHOWN) ? `<button class="link-btn" data-action="more-apps">${this._showAllApps ? "Show fewer" : `All ${total}`}</button>` : ""
    }</div>`;
    if (!total) {
      const msg = loaded?.status === "loading" ? "Loading apps…" : r.online ? "No apps reported by this Roku." : "Apps show up once Home Assistant can reach this Roku.";
      return `<section class="card apps">${head}<div class="empty">${msg}</div></section>`;
    }
    // With nothing playing, launching an app is the main thing to do here, so show more of them.
    const roomy = r.mode === "idle" || r.mode === "off";
    if (!this._showAllApps) list = list.slice(0, roomy ? APPS_SHOWN_IDLE : APPS_SHOWN);
    const tiles = list
      .map((app) => {
        const icon = r.online && app.id ? this._icon(r.roku, app.id) : null;
        const cur = r.online && r.app === app.title;
        return `<button class="tile ${cur ? "cur" : ""}" data-action="launch" data-app="${esc(app.title)}" aria-label="Open ${esc(app.title)}" title="${esc(app.title)}" ${r.online ? "" : "disabled"}>
          <span>${esc(app.title)}</span>${icon ? `<img src="${esc(icon)}" alt="">` : ""}${cur ? `<span class="badge">Open</span>` : ""}</button>`;
      })
      .join("");
    const note = r.online ? "" : `<div class="note">Last known apps. Launching needs the Roku to be reachable.</div>`;
    return `<section class="card apps">${head}<div class="app-grid ${this._showAllApps ? "" : roomy ? "roomy" : "few"}">${tiles}</div>${note}</section>`;
  }

  _dvrCard(rec) {
    const go = this._c.links.recordings;
    const head = `<div class="card-head"><span class="eyebrow">On the DVR</span>${go ? `<button class="link-btn" data-action="go" data-path="${esc(go)}">Recordings${svg("mdiChevronRight")}</button>` : ""}</div>`;
    if (!rec) return `<section class="card dvr">${head}<div class="empty">Recording info is unavailable.</div></section>`;
    const now = Date.now();
    const row = (x, up) => `
      <div class="rec"><div class="aic ${up ? "up" : ""}">${svg(up ? "mdiRecordRec" : "mdiPlayCircleOutline")}</div>
        <div style="min-width:0"><b>${esc(x.title)}</b><small>${esc(x.show || "")}${up && x.at <= now ? " · recording now" : ""}</small></div>
        <div class="when">${x.at ? (up ? `${this._fmtDay(x.at)}<br><small>${this._fmtTime(x.at)}</small>` : this._fmtDay(x.at)) : ""}</div></div>`;
    const up = rec.upcoming.slice(0, 3);
    const recent = rec.recent.slice(0, 3);
    return `<section class="card dvr">${head}
      <div class="sub-h">Coming up</div>
      <div class="dvr-list">${up.length ? up.map((x) => row(x, true)).join("") : `<div class="rec"><span></span><small class="muted">Nothing scheduled.</small></div>`}</div>
      ${recent.length ? `<div class="sub-h">Ready to watch</div><div class="dvr-list">${recent.map((x) => row(x, false)).join("")}</div>` : ""}
    </section>`;
  }

  _render() {
    if (!this._hass) return;
    const now = Date.now();
    const st = this._hass.states;
    const rooms = this._c.rooms.map((cfg) => readRoom(st, cfg, now));
    if (!rooms.length) {
      this.shadowRoot.innerHTML = `<style>${CSS}</style><div class="app"><div class="empty">Add <code>rooms</code> to this panel's config in configuration.yaml.</div></div>`;
      return;
    }
    // Default to whatever is playing, then whatever is reachable; a remembered choice wins.
    let sel = rooms.find((r) => r.name === this._room) || rooms.find((r) => r.mode === "media") || rooms.find((r) => r.online) || rooms[0];
    this._sel = sel;
    for (const r of rooms) if (r.online) this._loadApps(r);

    const playing = rooms.filter((r) => r.mode === "media");
    let status;
    if (playing.length) {
      const p = playing[0];
      status = { dot: p.playing ? "violet" : "", label: p.playing ? "Playing" : "Paused", detail: `${p.title} · ${p.name}${playing.length > 1 ? ` +${playing.length - 1} more` : ""}` };
    } else {
      const on = rooms.filter((r) => r.mode === "idle");
      status = { dot: on.length ? "green" : "", label: "Nothing playing", detail: on.length ? `${on.map((r) => r.name).join(" and ")} ${on.length === 1 ? "is" : "are"} on` : "All TVs are off" };
    }
    const dead = rooms.filter((r) => r.mode === "dead");

    const rec = readRecordings(this._c.recordings ? st[this._c.recordings] : null, now);
    const next = rec?.upcoming.find((x) => x.at > now);
    const chip = next ? { icon: "mdiRecordRec", text: `Next recording · ${this._fmtDay(next.at)} ${this._fmtTime(next.at)}`, title: next.title } : null;

    const roomTiles = rooms
      .map(
        (r) => `<button class="room ${r === sel ? "sel" : ""} ${r.mode}" data-action="room" data-room="${esc(r.name)}" aria-pressed="${r === sel}">
          <div class="ric">${svg(r.mode === "dead" ? "mdiWifiOff" : r.icon || "mdiTelevision")}</div>
          <div class="room-t"><b>${esc(r.name)}</b><span>${esc(this._roomLine(r))}</span></div></button>`,
      )
      .join("");

    const html = `
      <style>${CSS}</style>
      <div class="app">
        <header class="top">
          ${this._narrow ? `<button class="icon-btn" data-action="menu" aria-label="Menu">${svg("mdiMenu")}</button>` : ""}
          <div class="brand ${playing.length ? "" : "idle"}">${svg("mdiTelevisionPlay")}</div>
          <div class="titles">
            <h1>TV</h1>
            <div class="status"><span class="dot ${status.dot}"></span><b>${esc(status.label)}</b><span class="muted">·</span><span class="muted detail">${esc(status.detail)}${
              dead.length ? ` · ${esc(dead.map((r) => r.name).join(", "))} not responding` : ""
            }</span></div>
          </div>
          <div class="spacer"></div>
          ${chip ? `<div class="chip" title="${esc(chip.title)}">${svg(chip.icon)}<span>${esc(chip.text)}</span></div>` : ""}
        </header>
        ${rooms.length > 1 ? `<div class="room-row">${roomTiles}</div>` : ""}
        <main class="grid">
          <div class="col">${this._nowCard(sel)}${this._quickCard(sel)}${this._appsCard(sel)}</div>
          <div class="col">${this._remoteCard(sel)}${this._dvrCard(rec)}</div>
        </main>
        ${this._toast ? `<div class="toast" role="alert">${esc(this._toast)}</div>` : ""}
      </div>`;

    if (html !== this._html) {
      const active = this.shadowRoot.activeElement;
      const typing = active?.name === "q";
      this._html = html;
      this.shadowRoot.innerHTML = html;
      if (typing) {
        const input = this.shadowRoot.querySelector("input[name=q]");
        input?.focus();
        input?.setSelectionRange(input.value.length, input.value.length);
      }
    }
  }
}

function loadFont() {
  if (document.getElementById("tv-panel-font")) return;
  const link = document.createElement("link");
  link.id = "tv-panel-font";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

if (!customElements.get("tv-panel")) customElements.define("tv-panel", TvPanel);
