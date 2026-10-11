// Read-only query for scripts/udm-traffic.py. Runs ON the UDM (mongo 3.6 shell, ES5) via
// collect.sh, which is the forced command of docker-host's restricted SSH key.
// Prints one JSON object of raw aggregates; all interpretation happens on docker-host.
//
// Sources (UniFi Network app's own Mongo, port 27117):
//   ace_stat.stat_hourly / stat_5minutes / stat_daily
//     o:"gw"    wan-rx_bytes (download) / wan-tx_bytes (upload), whole house
//     o:"user"  rx_bytes = sent BY the client, tx_bytes = received by it. Wi-Fi clients only:
//               wired clients read 0 (the UDM only counts per switch port).
//     o:"site_traffic_flow"  blocked_count_by_policy {"<type>-<base64url ObjectId>": n},
//               blocked_count_by_client {mac: n}
//   ace_audit.traffic_flow  one row per blocked flow (policy type 4 = zone firewall rule,
//               26 = dropped at the router from the internet)
//   ace.firewall_policy, ace.user  rule definitions and known clients
var HOUR = 3600000, DAY = 86400000;
var now = Date.now();
var start48 = Math.floor(now / HOUR) * HOUR - 47 * HOUR;

function n(v) { return v === undefined || v === null ? 0 : Number(v); }
function str(id) { return id && id.str ? id.str : String(id || ""); }

var stat = db.getSiblingDB("ace_stat");

// Hourly rows for complete hours, then 5-minute rows after the last hourly row, so the
// newest (partial) hour is included too.
function rows(o, since, extra) {
  var q = { o: o, time: { $gte: since } };
  for (var k in extra) q[k] = extra[k];
  var out = [], last = 0;
  stat.stat_hourly.find(q).forEach(function (d) { out.push(d); last = Math.max(last, n(d.time) + HOUR); });
  q.time = { $gte: Math.max(since, last) };
  stat.stat_5minutes.find(q).forEach(function (d) { out.push(d); });
  return out;
}

var oldestHourly = stat.stat_hourly.find({ o: "gw" }).sort({ time: 1 }).limit(1).toArray();
var oldest5 = stat.stat_5minutes.find({ o: "gw" }).sort({ time: 1 }).limit(1).toArray();

var wan = rows("gw", start48, {}).map(function (d) {
  return [n(d.time), n(d["wan-rx_bytes"]), n(d["wan-tx_bytes"])];
});
var wanDaily = stat.stat_daily.find({ o: "gw", time: { $gte: now - 30 * DAY } }).sort({ time: 1 }).map(function (d) {
  return [n(d.time), n(d["wan-rx_bytes"]), n(d["wan-tx_bytes"])];
});

var users24 = {};
rows("user", now - 24 * HOUR, {}).forEach(function (d) {
  var u = users24[d.user] || (users24[d.user] = [0, 0]);
  u[0] += n(d.rx_bytes);
  u[1] += n(d.tx_bytes);
});
var usersDaily = {};
stat.stat_daily.find({ o: "user", time: { $gte: now - 30 * DAY } }).sort({ time: 1 }).forEach(function (d) {
  (usersDaily[d.user] || (usersDaily[d.user] = [])).push([n(d.time), n(d.rx_bytes), n(d.tx_bytes)]);
});

var flows = rows("site_traffic_flow", start48, {}).map(function (d) {
  var p = {}, c = {}, k;
  for (k in d.blocked_count_by_policy || {}) p[k] = n(d.blocked_count_by_policy[k]);
  for (k in d.blocked_count_by_client || {}) c[k] = n(d.blocked_count_by_client[k]);
  return [n(d.time), p, c];
});

var audit = db.getSiblingDB("ace_audit").traffic_flow;
var since24 = now - 24 * HOUR;
var oldestFlow = audit.find().sort({ time: 1 }).limit(1).toArray();
var inbound = { dropped: 0, sources: 0, ports: [], regions: [], since: Math.max(since24, oldestFlow.length ? n(oldestFlow[0].time) : now) };
audit.aggregate([
  { $match: { time: { $gte: since24 }, "policies.type": 26 } },
  { $group: { _id: { ip: "$source.ip", port: "$destination.port", region: "$source.region" }, c: { $sum: "$count" } } }
], { allowDiskUse: false }).forEach(function (d) {
  inbound.dropped += n(d.c);
  inbound.ports.push([d._id.port, d._id.ip, d._id.region || "", n(d.c)]);
});
// Folded into port/region/source totals here so the output stays small.
var byPort = {}, byRegion = {}, srcs = {};
inbound.ports.forEach(function (r) {
  byPort[r[0]] = (byPort[r[0]] || 0) + r[3];
  byRegion[r[2]] = (byRegion[r[2]] || 0) + r[3];
  srcs[r[1]] = 1;
});
inbound.sources = Object.keys(srcs).length;
inbound.ports = Object.keys(byPort).map(function (k) { return [Number(k), byPort[k]]; });
inbound.regions = Object.keys(byRegion).map(function (k) { return [k, byRegion[k]]; });

// What each blocked device was trying to reach (rule blocks only).
var tried = {};
audit.aggregate([
  { $match: { time: { $gte: since24 }, "policies.type": 4 } },
  { $group: { _id: { mac: "$source.mac", ip: "$destination.ip", dom: { $arrayElemAt: ["$destination.domains", 0] } }, c: { $sum: "$count" } } }
]).forEach(function (d) {
  (tried[d._id.mac] || (tried[d._id.mac] = [])).push([d._id.dom || d._id.ip, n(d.c)]);
});

var zones = {};
db.firewall_zone.find().forEach(function (z) { zones[str(z._id)] = z.zone_key; });
var policies = db.firewall_policy.find({ predefined: { $ne: true } }).map(function (p) {
  return {
    id: str(p._id), name: p.name, action: p.action, enabled: !!p.enabled, index: n(p.index),
    src_zone: zones[p.source && p.source.zone_id] || "", dst_zone: zones[p.destination && p.destination.zone_id] || "",
    macs: (p.source && p.source.client_macs) || [], port: (p.destination && p.destination.port) || ""
  };
});

var users = db.user.find({}, { mac: 1, name: 1, hostname: 1, oui: 1, first_seen: 1, last_seen: 1, is_wired: 1, last_ip: 1, last_connection_network_name: 1 }).map(function (u) {
  return [u.mac, u.name || "", u.hostname || "", u.oui || "", n(u.first_seen), n(u.last_seen), !!u.is_wired, u.last_ip || "", u.last_connection_network_name || ""];
});

print(JSON.stringify({
  now: now,
  stats_since: Math.min(oldestHourly.length ? n(oldestHourly[0].time) : now, oldest5.length ? n(oldest5[0].time) : now),
  wan: wan, wan_daily: wanDaily,
  users_24h: users24, users_daily: usersDaily,
  flows: flows, inbound: inbound, tried: tried,
  policies: policies, users: users
}));
