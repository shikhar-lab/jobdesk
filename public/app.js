// Leave empty when the website and jobs.json are in the same folder.
var API_BASE = "";
var INDIA = /india|bengaluru|bangalore|mumbai|delhi|gurgaon|gurugram|noida|hyderabad|pune|chennai|kolkata|bhopal|indore|jaipur|ahmedabad/i, REMOTE = /remote|anywhere|worldwide/i;
var CATS = {
  software: /engineer|developer|software|devops|backend|frontend|full.?stack|\bsre\b|platform|mobile|android|\bios\b|cloud|security|python|java\b/i,
  data: /data|analyst|analytics|machine learning|\bml\b|\bai\b|scientist/i,
  design: /design|\bux\b|\bui\b|creative|brand/i,
  sales: /sales|account exec|business development|customer success|partnership/i,
  marketing: /market|growth|\bseo\b|content|communications|social media/i,
  support: /support|customer|operations|admin|recruit|\bhr\b|people|finance|legal/i,
  intern: /intern|trainee|apprentice|working student|werkstudent|graduate/i
};
var CHIPS = [["🏠", "Remote", { remote: true }], ["📍", "India", { loc: "india" }], ["🎓", "Internship", { cat: "intern" }], ["💻", "Software", { cat: "software" }],
  ["📊", "Data", { cat: "data" }], ["💰", "Sales", { cat: "sales" }], ["📣", "Marketing", { cat: "marketing" }], ["🎨", "Design", { cat: "design" }], ["🎧", "Support", { cat: "support" }]];
var LV = { fresher: "Fresher / Intern", mid: "Mid level", senior: "Senior / Lead" };
var PAGE = 20, st = { q: "", lvl: "", loc: "", cat: "", remote: false, fresh: false, src: "", co: "", saved: false, sort: "new", n: PAGE };
var ALL = [], last = 0, demo = false, SAVED = {}, CACHE = {}, t0 = Date.now();
var SAMPLE = [
  { id: "s1", title: "Backend Engineer", company: "Northwind", location: "Remote", source: "Greenhouse", url: "#", seenAt: t0 - 120000 },
  { id: "s2", title: "Data Analyst", company: "Brightleaf", location: "Bhopal, India", source: "Lever", url: "#", seenAt: t0 - 900000 },
  { id: "s3", title: "Marketing Intern", company: "Harbor", location: "Remote", source: "RemoteOK", url: "#", seenAt: t0 - 7200000 }
];
var $ = function (i) { return document.getElementById(i); };
try { SAVED = JSON.parse(localStorage.getItem("jd_saved") || "{}"); } catch (e) {}
function keep() { try { localStorage.setItem("jd_saved", JSON.stringify(SAVED)); } catch (e) {} }
function put(id, h) { if (CACHE[id] !== h) { CACHE[id] = h; $(id).innerHTML = h; } }
function esc(x) { return String(x == null ? "" : x).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function ts(j) {
  if (j.seenAt) return j.seenAt;
  var n = +j.posted; if (j.posted != null && !isNaN(n)) return n < 1e12 ? n * 1000 : n;
  return Date.parse(j.posted) || 0;
}
function ago(t) {
  if (!t) return "";
  var s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  var m = Math.floor(s / 60); if (m < 60) return m + " min ago";
  var h = Math.floor(m / 60); if (h < 24) return h + " hr ago";
  var d = Math.floor(h / 24); return d < 60 ? d + " days ago" : "";
}
function level(j) {
  if (/intern|junior|graduate|trainee|fresher|entry|apprentice|working student|werkstudent/i.test(j.title)) return "fresher";
  if (/senior|staff|principal|lead|head|director|\bvp\b|manager|architect/i.test(j.title)) return "senior";
  return "mid";
}
function hue(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
function pass(j) {
  var t = (j.title + " " + j.company + " " + (j.location || "")).toLowerCase(), l = j.location || "";
  if (st.q && st.q.toLowerCase().split(/\s+/).some(function (w) { return w && t.indexOf(w) < 0; })) return false;
  if (st.loc && (st.loc.toLowerCase() === "india" ? !INDIA.test(l) : l.toLowerCase().indexOf(st.loc.toLowerCase()) < 0)) return false;
  if (st.cat && !CATS[st.cat].test(j.title)) return false;
  if (st.lvl && level(j) !== st.lvl) return false;
  if (st.remote && !REMOTE.test(l) && !/remote/i.test(j.title)) return false;
  if (st.fresh && !(j.seenAt && Date.now() - j.seenAt < 864e5)) return false;
  if (st.src && j.source !== st.src) return false;
  if (st.co && j.company !== st.co) return false;
  if (st.saved && !SAVED[j.id]) return false;
  return true;
}
function on(s) { for (var k in s) if (st[k] !== s[k]) return false; return true; }
function anyFilter() { return !!(st.q || st.lvl || st.loc || st.cat || st.remote || st.fresh || st.src || st.co || st.saved); }
function card(j) {
  var isNew = j.seenAt && Date.now() - j.seenAt < 6e5, sv = !!SAVED[j.id];
  var share = "https://wa.me/?text=" + encodeURIComponent(j.title + " at " + j.company + " " + j.url);
  return '<article class="job"><div class="av" style="--h:' + hue(j.company || "x") + '">' + esc((j.company || "?").charAt(0).toUpperCase()) + '</div><div class="body"><h3>' + esc(j.title) +
    (isNew ? '<span class="new">NEW</span>' : "") + '</h3><span class="sub">' + esc(j.company) + "</span><div class=\"pills\"><span class=\"pill\">" + esc(j.location || "Location not stated") +
    '</span><span class="pill">' + LV[level(j)] + '</span><span class="pill">' + esc(j.source) + "</span>" + (ago(ts(j)) ? '<span class="sub">' + ago(ts(j)) + "</span>" : "") + '</div></div>' +
    '<div class="acts"><a class="apply" target="_blank" rel="noopener noreferrer" href="' + esc(j.url) + '">Apply</a><div class="mini"><button data-s="' + esc(j.id) + '" class="' + (sv ? "on" : "") +
    '" aria-pressed="' + sv + '">' + (sv ? "♥ Saved" : "♡ Save") + '</button><a target="_blank" rel="noopener noreferrer" href="' + share + '">Share</a></div></div></article>';
}
function render() {
  var f = ALL.filter(pass), cos = {};
  ALL.forEach(function (j) { cos[j.company] = (cos[j.company] || 0) + 1; });
  var names = Object.keys(cos).sort(function (a, b) { return cos[b] - cos[a]; });
  $("demo").hidden = !demo;
  $("sub").textContent = ALL.length + " jobs from " + names.length + " companies" + (last ? ". Updated " + ago(last) : "");
  put("chips", CHIPS.map(function (c, i) { return '<button class="chip" data-i="' + i + '" aria-pressed="' + on(c[2]) + '">' + c[0] + " " + c[1] + "</button>"; }).join(""));
  var tk = ALL.slice().sort(function (a, b) { return ts(b) - ts(a); }).slice(0, 15).map(function (j) {
    return '<a target="_blank" rel="noopener noreferrer" href="' + esc(j.url) + '">' + esc(j.title) + " · " + esc(j.company) + "</a>"; }).join("");
  put("tk", tk + tk);
  put("co", names.slice(0, 12).map(function (n) {
    return '<div class="co"><div class="av" style="--h:' + hue(n) + '">' + esc(n.charAt(0).toUpperCase()) + "</div><b>" + esc(n) + "</b><span>" + cos[n] + ' open roles</span><button data-co="' + esc(n) + '">View jobs</button></div>'; }).join(""));
  var srcs = []; ALL.forEach(function (j) { if (srcs.indexOf(j.source) < 0) srcs.push(j.source); }); srcs.sort();
  put("src", '<option value="">All sources</option>' + srcs.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + "</option>"; }).join(""));
  put("cosel", st.co ? '<span class="sel">' + esc(st.co) + ' <button data-x="1" aria-label="Remove company filter">×</button></span>' : "");
  f.sort(st.sort === "az" ? function (a, b) { return (a.company || "").localeCompare(b.company || ""); } : function (a, b) { return ts(b) - ts(a); });
  $("rt").textContent = (st.saved ? "Saved jobs: " : "") + f.length + " jobs";
  put("list", f.slice(0, st.n).map(card).join("") || '<p class="empty">' + (st.saved ? "You have not saved any jobs yet." : "No jobs match. Try clearing the filters.") + "</p>");
  $("more").hidden = f.length <= st.n; $("clear").hidden = !anyFilter();
  $("sc").textContent = Object.keys(SAVED).length; $("savedBtn").setAttribute("aria-pressed", st.saved);
  $("remote").checked = st.remote; $("fresh").checked = st.fresh; $("lvl").value = st.lvl; $("sort").value = st.sort; $("src").value = st.src;
}
function set(o) { for (var k in o) st[k] = o[k]; st.n = PAGE; render(); }
function load() {
  return fetch(API_BASE + "jobs.json", { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (d) { ALL = d.jobs || []; last = d.lastScan || 0; demo = false; })
    .catch(function () { ALL = SAMPLE; last = Date.now(); demo = true; })
    .then(render);
}
$("sf").onsubmit = function (e) { e.preventDefault(); $("results").scrollIntoView(); };
$("q").oninput = function () { set({ q: this.value }); };
$("loc").oninput = function () { set({ loc: this.value.trim() }); };
$("lvl").onchange = function () { set({ lvl: this.value }); };
$("remote").onchange = function () { set({ remote: this.checked }); };
$("fresh").onchange = function () { set({ fresh: this.checked }); };
$("src").onchange = function () { set({ src: this.value }); };
$("sort").onchange = function () { set({ sort: this.value }); };
$("savedBtn").onclick = function () { set({ saved: !st.saved }); };
$("more").onclick = function () { st.n += PAGE; render(); };
$("clear").onclick = function () { $("q").value = ""; $("loc").value = ""; set({ q: "", lvl: "", loc: "", cat: "", remote: false, fresh: false, src: "", co: "", saved: false }); };
$("chips").onclick = function (e) {
  var b = e.target.closest(".chip"); if (!b) return;
  var s = CHIPS[+b.getAttribute("data-i")][2], k;
  if (on(s)) { for (k in s) st[k] = k === "remote" ? false : ""; if (s.loc) $("loc").value = ""; }
  else { for (k in s) st[k] = s[k]; if (s.loc) $("loc").value = s.loc; }
  st.n = PAGE; render();
};
$("co").onclick = function (e) { var b = e.target.closest("button[data-co]"); if (b) { set({ co: b.getAttribute("data-co") }); $("results").scrollIntoView(); } };
$("cosel").onclick = function (e) { if (e.target.closest("button")) set({ co: "" }); };
$("list").onclick = function (e) {
  var b = e.target.closest("button[data-s]"); if (!b) return;
  var id = b.getAttribute("data-s"); if (SAVED[id]) delete SAVED[id]; else SAVED[id] = 1;
  keep(); render();
};
load(); setInterval(load, 60000);
